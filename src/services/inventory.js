import Dexie from "dexie";
import { db } from "../db/index.js";

export function nowISO() { return new Date().toISOString(); }

export function daysBetween(isoA, isoB = nowISO()) {
  if (!isoA) return null;
  const a = new Date(isoA).getTime();
  const b = new Date(isoB).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  const diff = b - a;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Entrada de pallet (solo registrar, sin ubicar)
 */
export async function registerPalletIn({ id, productName, variety = "", worker, shift }) {
  const palletId = (id || "").trim();
  if (!palletId) throw new Error("ID de pallet requerido");
  if (!productName?.trim()) throw new Error("Producto requerido");
  if (!worker?.trim()) throw new Error("Trabajador requerido");
  if (!["DAY", "NIGHT"].includes(shift)) throw new Error("Turno inválido");

  const exists = await db.pallets.get(palletId);
  if (exists) throw new Error("Este pallet ya fue registrado");

  await db.transaction("rw", db.pallets, db.movements, async () => {
    await db.pallets.add({
      id: palletId,
      productName: productName.trim(),
      variety: variety.trim(),
      worker: worker.trim(),
      shift,
      receivedAt: nowISO(),
      status: "IN",       // IN | ASSIGNED | OUT
      locationId: null,
      assignedAt: null,

      // Metadata operacional (se completa por import NISIRA o por Calidad/Despacho)
      client: "",
      pg: "",

      // Calidad (legacy + separado)
      qcStatus: "PENDING", // legacy: PENDING | OK | BLOCKED
      qcReason: "",
      qcAt: null,
      qcBy: "",

      // Calidad Proceso
      qcProcessStatus: "PENDING",
      qcProcessReason: "",
      qcProcessAt: null,
      qcProcessBy: "",

      // Calidad Despacho
      qcDispatchStatus: "PENDING",
      qcDispatchReason: "",
      qcDispatchAt: null,
      qcDispatchBy: "",

      // Empaque
      bagCode: "",
      boxType: "",
      calibre: "",

      // Puchos
      totalBoxes: null,
      isPucho: false,
    });

    await db.movements.add({
      palletId,
      type: "IN",
      timestamp: nowISO(),
      fromLocationId: null,
      toLocationId: null,
      worker: worker.trim(),
      shift
    });
  });
}

/**
 * Entrada + asignación directa a una ubicación elegida (manual por operario)
 * - Valida que la ubicación exista y esté libre
 * - Deja el pallet en estado ASSIGNED
 * - Registra movimientos IN y ASSIGN
 */
export async function registerPalletInAndAssign({
  id,
  productName,
  variety = "",
  worker,
  shift,
  locationId
}) {
  const palletId = (id || "").trim();
  const locId = (locationId || "").trim();

  if (!palletId) throw new Error("ID de pallet requerido");
  if (!productName?.trim()) throw new Error("Producto requerido");
  if (!worker?.trim()) throw new Error("Trabajador requerido");
  if (!["DAY", "NIGHT"].includes(shift)) throw new Error("Turno inválido");
  if (!locId) throw new Error("Debe seleccionar una ubicación");

  const exists = await db.pallets.get(palletId);
  if (exists) throw new Error("Este pallet ya fue registrado");

  await db.transaction("rw", db.pallets, db.locations, db.movements, async () => {
    const loc = await db.locations.get(locId);
    if (!loc) throw new Error("Ubicación no existe");
    if (loc.occupiedBy) throw new Error(`Ubicación ocupada: ${locId}`);

    await db.pallets.add({
      id: palletId,
      productName: productName.trim(),
      variety: variety.trim(),
      worker: worker.trim(),
      shift,
      receivedAt: nowISO(),
      status: "ASSIGNED",
      locationId: locId,
      assignedAt: nowISO(),

      client: "",
      pg: "",

      qcStatus: "PENDING",
      qcReason: "",
      qcAt: null,
      qcBy: "",

      totalBoxes: null,
      isPucho: false,
    });

    await db.locations.update(locId, { occupiedBy: palletId, updatedAt: nowISO() });

    await db.movements.bulkAdd([
      {
        palletId,
        type: "IN",
        timestamp: nowISO(),
        fromLocationId: null,
        toLocationId: null,
        worker: worker.trim(),
        shift
      },
      {
        palletId,
        type: "ASSIGN",
        timestamp: nowISO(),
        fromLocationId: null,
        toLocationId: locId,
        worker: worker.trim(),
        shift
      }
    ]);
  });
}

/**
 * Preview FIFO: siguiente libre por zona (floor+side)
 */
export async function previewNextFree({ floor, side }) {
  const loc = await db.locations
    .where("[floor+side+orderNo]")
    .between([floor, side, Dexie.minKey], [floor, side, Dexie.maxKey])
    .and((l) => !l.occupiedBy)
    .first();
  return loc || null;
}

/**
 * Asignación FIFO por zona: piso + lado
 */
export async function assignFIFO({ palletId, floor, side, worker = "OPERARIO", shift = "DAY" }) {
  const id = (palletId || "").trim();
  if (!id) throw new Error("Pallet vacío");
  if (![1,2,3].includes(Number(floor))) throw new Error("Piso inválido");
  if (!["L","R"].includes(side)) throw new Error("Lado inválido");

  let assignedLocationId = null;

  await db.transaction("rw", db.pallets, db.locations, db.movements, async () => {
    const pallet = await db.pallets.get(id);
    if (!pallet) throw new Error("Pallet no registrado (hacer Entrada primero)");
    if (pallet.status === "OUT") throw new Error("Pallet ya salió");
    if (pallet.locationId) throw new Error(`Pallet ya ubicado en ${pallet.locationId}`);

    const next = await previewNextFree({ floor: Number(floor), side });
    if (!next) throw new Error("Zona llena (no hay espacio libre)");

    const fresh = await db.locations.get(next.id);
    if (fresh.occupiedBy) throw new Error(`Ubicación ocupada: ${fresh.id}`);

    await db.locations.update(fresh.id, { occupiedBy: id, updatedAt: nowISO() });
    await db.pallets.update(id, {
      status: "ASSIGNED",
      locationId: fresh.id,
      assignedAt: nowISO(),
    });

    await db.movements.add({
      palletId: id,
      type: "ASSIGN",
      timestamp: nowISO(),
      fromLocationId: null,
      toLocationId: fresh.id,
      worker,
      shift
    });

    assignedLocationId = fresh.id;
  });

  return { assignedLocationId };
}

/**
 * Salida / liberación
 */
export async function releasePallet({ palletId, worker = "OPERARIO", shift = "DAY" }) {
  const id = (palletId || "").trim();
  if (!id) throw new Error("Pallet vacío");

  await db.transaction("rw", db.pallets, db.locations, db.movements, async () => {
    const pallet = await db.pallets.get(id);
    if (!pallet) throw new Error("Pallet no encontrado");
    if (pallet.status === "OUT") throw new Error("Pallet ya está en salida");

    const locId = pallet.locationId;

    if (locId) {
      const loc = await db.locations.get(locId);
      if (loc?.occupiedBy === id) {
        await db.locations.update(locId, { occupiedBy: null, updatedAt: nowISO() });
      }
    }

    await db.pallets.update(id, { status: "OUT", locationId: null });

    await db.movements.add({
      palletId: id,
      type: "OUT",
      timestamp: nowISO(),
      fromLocationId: locId || null,
      toLocationId: null,
      worker,
      shift
    });
  });
}

/**
 * Actualizar metadata del pallet (cliente, PG, cajas, etc.)
 * - pensado para completar datos sin depender de NISIRA en la operación
 */
export async function updatePalletMeta({
  palletId,
  client,
  pg,
  totalBoxes,
  isPucho,
}) {
  const id = (palletId || "").trim();
  if (!id) throw new Error("Pallet vacío");

  const pallet = await db.pallets.get(id);
  if (!pallet) throw new Error("Pallet no encontrado");

  const patch = {};
  if (client !== undefined) patch.client = String(client || "").trim();
  if (pg !== undefined) patch.pg = String(pg || "").trim();
  if (totalBoxes !== undefined) {
    const n = totalBoxes === null || totalBoxes === "" ? null : Number(totalBoxes);
    if (n === null) patch.totalBoxes = null;
    else if (!Number.isFinite(n) || n < 0) throw new Error("Total cajas inválido");
    else patch.totalBoxes = n;
  }
  if (isPucho !== undefined) patch.isPucho = !!isPucho;

  await db.pallets.update(id, patch);
}

/**
 * Calidad: liberar o bloquear pallet.
 */
export async function setQCStatus({ palletId, qcStatus, qcReason = "", qcBy = "QC" }) {
  const id = (palletId || "").trim();
  if (!id) throw new Error("Pallet vacío");
  if (!["OK", "BLOCKED"].includes(qcStatus)) throw new Error("Estado QC inválido");

  const pallet = await db.pallets.get(id);
  if (!pallet) throw new Error("Pallet no encontrado");

  await db.transaction("rw", db.pallets, db.movements, async () => {
    await db.pallets.update(id, {
      qcStatus,
      qcReason: qcStatus === "BLOCKED" ? String(qcReason || "").trim() : "",
      qcAt: nowISO(),
      qcBy: String(qcBy || "QC").trim(),
    });

    await db.movements.add({
      palletId: id,
      type: qcStatus === "OK" ? "QC_OK" : "QC_BLOCK",
      timestamp: nowISO(),
      fromLocationId: pallet.locationId || null,
      toLocationId: pallet.locationId || null,
      qcBy: String(qcBy || "QC").trim(),
      reason: qcStatus === "BLOCKED" ? String(qcReason || "").trim() : "",
    });
  });
}

/**
 * Buscar por palletId exacto o por texto en producto/variedad
 */
export async function quickSearch(term) {
  const q = (term || "").trim();
  if (!q) return [];

  const exact = await db.pallets.get(q);
  if (exact) return [exact];

  const lower = q.toLowerCase();
  return await db.pallets
    .filter((p) =>
      (p.productName || "").toLowerCase().includes(lower) ||
      (p.variety || "").toLowerCase().includes(lower)
    )
    .toArray();
}
