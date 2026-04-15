import { db } from "../db/index.js";
import { nowISO, daysBetween } from "./inventory.js";

export const QC_STAGE = { PROCESS: "PROCESS", DISPATCH: "DISPATCH" };

export const QC_STATUS = {
  PENDING: "PENDING",
  OK: "OK",
  BLOCKED: "BLOCKED",
};

export async function getPallet(palletId) {
  const id = (palletId || "").trim();
  if (!id) throw new Error("Pallet vacío");
  return await db.pallets.get(id);
}

export async function updatePalletMeta(palletId, patch) {
  const id = (palletId || "").trim();
  if (!id) throw new Error("Pallet vacío");
  const clean = { ...patch };
  // normalizaciones
  if (clean.client !== undefined) clean.client = String(clean.client || "").trim();
  if (clean.pg !== undefined) clean.pg = String(clean.pg || "").trim();
  if (clean.productName !== undefined) clean.productName = String(clean.productName || "").trim();
  if (clean.variety !== undefined) clean.variety = String(clean.variety || "").trim();
  if (clean.bagCode !== undefined) clean.bagCode = String(clean.bagCode || "").trim();
  if (clean.boxType !== undefined) clean.boxType = String(clean.boxType || "").trim();
  if (clean.calibre !== undefined) clean.calibre = String(clean.calibre || "").trim();
  if (clean.totalBoxes !== undefined && clean.totalBoxes !== null) {
    const n = Number(clean.totalBoxes);
    clean.totalBoxes = Number.isFinite(n) ? n : null;
  }
  if (clean.isPucho !== undefined) clean.isPucho = !!clean.isPucho;

  await db.pallets.update(id, clean);
}

export async function setQCStage({ palletId, stage = QC_STAGE.PROCESS, status, reason = "", qcBy = "" }) {
  const id = String(palletId || "").trim();
  if (!id) throw new Error("Pallet vacío");
  const st = String(stage || QC_STAGE.PROCESS).toUpperCase();
  if (![QC_STAGE.PROCESS, QC_STAGE.DISPATCH].includes(st)) throw new Error("Stage QC inválido");
  if (![QC_STATUS.PENDING, QC_STATUS.OK, QC_STATUS.BLOCKED].includes(status)) {
    throw new Error("Estado QC inválido");
  }

  const pallet = await db.pallets.get(id);
  if (!pallet) throw new Error("Pallet no encontrado (registrar en Entrada primero)");

  const by = String(qcBy || "").trim();

  const patch = {};
  const r = String(reason || "").trim();

  if (st === QC_STAGE.PROCESS) {
    patch.qcProcessStatus = status;
    patch.qcProcessReason = status === QC_STATUS.BLOCKED ? r : "";
    patch.qcProcessBy = by;
    patch.qcProcessAt = nowISO();

    // compat (legacy): mantenemos qcStatus como espejo de proceso
    patch.qcStatus = status;
    patch.qcReason = status === QC_STATUS.BLOCKED ? r : "";
    patch.qcBy = by;
    patch.qcAt = nowISO();
  } else {
    patch.qcDispatchStatus = status;
    patch.qcDispatchReason = status === QC_STATUS.BLOCKED ? r : "";
    patch.qcDispatchBy = by;
    patch.qcDispatchAt = nowISO();
  }

  await db.transaction("rw", db.pallets, db.movements, async () => {
    await db.pallets.update(id, patch);

    const type =
      st === QC_STAGE.PROCESS
        ? (status === QC_STATUS.OK ? "QC_PROCESS_OK" : (status === QC_STATUS.BLOCKED ? "QC_PROCESS_BLOCK" : "QC_PROCESS_PENDING"))
        : (status === QC_STATUS.OK ? "QC_DISPATCH_OK" : (status === QC_STATUS.BLOCKED ? "QC_DISPATCH_BLOCK" : "QC_DISPATCH_PENDING"));

    await db.movements.add({
      palletId: id,
      type,
      timestamp: nowISO(),
      fromLocationId: pallet.locationId || null,
      toLocationId: pallet.locationId || null,
      worker: by || (st === QC_STAGE.PROCESS ? "QC_PROCESO" : "QC_DESPACHO"),
      reason: status === QC_STATUS.BLOCKED ? r : "",
      stage: st,
    });
  });
}

// Wrapper legacy: QC único (lo tratamos como PROCESO)
export async function setQC({ palletId, status, reason = "", qcBy = "" }) {
  return setQCStage({ palletId, stage: QC_STAGE.PROCESS, status, reason, qcBy });
}

export async function createPlan({
  containerNo,
  pg = "",
  client = "",
  maxDays = 10,
  allowExpired = false,
  requireQcOk = false,
}) {
  const c = String(containerNo || "").trim();
  if (!c) throw new Error("Contenedor requerido");

  const planId = await db.plans.add({
    containerNo: c,
    pg: String(pg || "").trim(),
    client: String(client || "").trim(),
    maxDays: Number(maxDays) || 10,
    allowExpired: !!allowExpired,
    requireQcOk: !!requireQcOk,
    status: "OPEN",
    createdAt: nowISO(),
  });
  return planId;
}

export async function updatePlan(planId, patch) {
  const id = Number(planId);
  if (!Number.isFinite(id)) throw new Error("Plan inválido");
  await db.plans.update(id, { ...patch });
}

export async function listOpenPlans() {
  return await db.plans.where("status").equals("OPEN").reverse().sortBy("createdAt");
}

export async function getPlan(planId) {
  const id = Number(planId);
  if (!Number.isFinite(id)) return null;
  return await db.plans.get(id);
}

export async function closePlan(planId) {
  const id = Number(planId);
  if (!Number.isFinite(id)) throw new Error("Plan inválido");
  await db.plans.update(id, { status: "CLOSED", closedAt: nowISO() });
}

// "LOAD" = salida por despacho (libera ubicación + deja trazabilidad con plan)
export async function loadPalletForPlan({ planId, palletId, worker = "DESPACHO", shift = "DAY" }) {
  const pId = (palletId || "").trim();
  if (!pId) throw new Error("Pallet vacío");
  const plan = await getPlan(planId);
  if (!plan) throw new Error("Plan no encontrado");
  if (plan.status !== "OPEN") throw new Error("Plan ya cerrado");

  await db.transaction("rw", db.pallets, db.locations, db.movements, async () => {
    const pallet = await db.pallets.get(pId);
    if (!pallet) throw new Error("Pallet no registrado en el sistema");
    if (pallet.status === "OUT") throw new Error("Pallet ya salió");

    // QC (separado):
    const qcProc = pallet.qcProcessStatus || pallet.qcStatus || QC_STATUS.PENDING;
    const qcDisp = pallet.qcDispatchStatus || QC_STATUS.PENDING;

    // Siempre bloquea si PROCESO o DESPACHO están BLOQUEADOS
    if (qcProc === QC_STATUS.BLOCKED) {
      throw new Error(`QC PROCESO BLOQUEADO: ${pallet.qcProcessReason || pallet.qcReason || ""}`.trim());
    }
    if (qcDisp === QC_STATUS.BLOCKED) {
      throw new Error(`QC DESPACHO BLOQUEADO: ${pallet.qcDispatchReason || ""}`.trim());
    }

    // Por defecto, Despacho NO es obligatorio (modo muestreo). Si el plan marca QC obligatorio, exige QC DESPACHO OK.
    if (plan.requireQcOk && qcDisp !== QC_STATUS.OK) {
      throw new Error(`QC despacho pendiente: se requiere LIBERADO para este contenedor`);
    }

    // Validación por cliente
    if (plan.client && pallet.client && plan.client !== pallet.client) {
      throw new Error(`Cliente no coincide (Plan: ${plan.client} | Pallet: ${pallet.client})`);
    }

    // Validación por PG (si pallet tiene PG distinto, bloquea)
    if (plan.pg && pallet.pg && plan.pg !== pallet.pg) {
      throw new Error(`PG no coincide (Plan: ${plan.pg} | Pallet: ${pallet.pg})`);
    }

    // Si pallet no tiene PG, lo “marca” con el PG del plan (esto evita mezcla entre pedidos)
    if (plan.pg && !pallet.pg) {
      await db.pallets.update(pId, { pg: plan.pg });
    }

    // Si pallet no tiene cliente, lo marca con el cliente del plan
    if (plan.client && !pallet.client) {
      await db.pallets.update(pId, { client: plan.client });
    }

    // Aging: por defecto bloquea > maxDays (exportación)
    const baseDate = pallet.assignedAt || pallet.receivedAt;
    const days = baseDate ? daysBetween(baseDate) : null;
    if (days !== null && days > (Number(plan.maxDays) || 10) && !plan.allowExpired) {
      throw new Error(`Vencido para exportación: ${days} días en cámara (máx ${plan.maxDays})`);
    }

    // Libera ubicación si la tiene
    const locId = pallet.locationId;
    if (locId) {
      const loc = await db.locations.get(locId);
      if (loc?.occupiedBy === pId) {
        await db.locations.update(locId, { occupiedBy: null, updatedAt: nowISO() });
      }
    }

    await db.pallets.update(pId, { status: "OUT", locationId: null });

    await db.movements.add({
      palletId: pId,
      type: "LOAD",
      timestamp: nowISO(),
      fromLocationId: locId || null,
      toLocationId: null,
      worker: String(worker || "").trim(),
      shift,
      planId: Number(planId),
      containerNo: plan.containerNo,
      pg: plan.pg,
      client: plan.client,
    });
  });
}

export async function listLoadsByDateISO(dateISO /* YYYY-MM-DD */) {
  const day = String(dateISO || "").slice(0, 10);
  if (!day) return [];
  const all = await db.movements.where("type").equals("LOAD").toArray();
  return all.filter((m) => String(m.timestamp || "").slice(0, 10) === day);
}
