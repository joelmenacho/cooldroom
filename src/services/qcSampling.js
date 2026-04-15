import { db } from "../db/index.js";
import { nowISO, daysBetween } from "./inventory.js";

/**
 * Crea una sesión de muestreo (normalmente 5 pallets por carga).
 * Si existe planId (Despacho), lo guarda para unir reporte diario.
 */
export async function createQCSamplingSession({
  stage = "PROCESS", // PROCESS | DISPATCH
  planId = null,
  containerNo = "",
  pg = "",
  client = "",
  orderNumber = "",
  qcBy = "",
  targetCount = 5,
}) {
  const by = String(qcBy || "").trim();
  if (!by) throw new Error("Ingrese su nombre (QC)");

  const cNo = String(containerNo || "").trim();
  const p = String(pg || "").trim();
  const cl = String(client || "").trim();

  // Si hay planId, podemos autocompletar datos
  let plan = null;
  if (planId !== null && planId !== undefined && String(planId) !== "") {
    plan = await db.plans.get(Number(planId));
  }

  const sessionId = await db.qcSessions.add({
    stage: String(stage || "PROCESS").toUpperCase() === "DISPATCH" ? "DISPATCH" : "PROCESS",
    orderNumber: String(orderNumber || "").trim(),
    planId: plan ? plan.id : (planId === "" ? null : planId),
    containerNo: plan ? plan.containerNo : cNo,
    pg: plan ? (plan.pg || p) : p,
    client: plan ? (plan.client || cl) : cl,
    qcBy: by,
    targetCount: Number(targetCount) || 5,
    createdAt: nowISO(),
    status: "OPEN",
  });
  return sessionId;
}

export async function closeQCSamplingSession(sessionId) {
  const id = Number(sessionId);
  if (!Number.isFinite(id)) throw new Error("Sesión inválida");
  await db.qcSessions.update(id, { status: "CLOSED", closedAt: nowISO() });
}

export async function getQCSamplingSession(sessionId) {
  const id = Number(sessionId);
  if (!Number.isFinite(id)) return null;
  return await db.qcSessions.get(id);
}

export async function listMyOpenSessions({ qcBy = "", stage = null } = {}) {
  const by = String(qcBy || "").trim();
  if (!by) return [];

  const q = db.qcSessions
    .where("qcBy")
    .equals(by)
    .and((s) => (s.status || "OPEN") === "OPEN");

  const st = stage ? String(stage).toUpperCase() : null;
  const arr = await q.toArray();
  const filtered = st ? arr.filter((s) => String(s.stage || (s.planId ? "DISPATCH" : "PROCESS")).toUpperCase() === st) : arr;

  return filtered.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

export async function listSessionSamples(sessionId) {
  const id = Number(sessionId);
  if (!Number.isFinite(id)) return [];
  const samples = await db.qcSamples.where("sessionId").equals(id).toArray();
  // join rápido con pallets (snapshot + info actual)
  const palletIds = Array.from(new Set(samples.map((s) => s.palletId)));
  const pallets = await db.pallets.bulkGet(palletIds);
  const map = new Map();
  palletIds.forEach((pid, idx) => map.set(pid, pallets[idx] || null));
  return samples
    .map((s) => ({ ...s, pallet: map.get(s.palletId) }))
    .sort((a, b) => String(b.timestamp || "").localeCompare(String(a.timestamp || "")));
}

/**
 * Guarda un pallet como muestra dentro de una sesión.
 * Guarda snapshot (cliente/pg/días/pucho/cajas) para el reporte.
 */
export async function addSampleToSession({
  sessionId,
  palletId,
  qcBy,
  result = "OK",
  note = "",
  // Muestreo por cajas (evidencia)
  sampleBoxesCount = null, // ej. 2..5
  sampleWindowLabels = [], // array de rótulos "ventana" escaneados
  retainedInPlant = false, // si estas cajas se quedan en planta como evidencia
  retainedBoxesCount = null,
  expected = null, // { client, bag, box, variety, size, windowLabel, orderNumber }
}) {
  const sid = Number(sessionId);
  if (!Number.isFinite(sid)) throw new Error("Sesión inválida");
  const pId = String(palletId || "").trim();
  if (!pId) throw new Error("Pallet vacío");

  const by = String(qcBy || "").trim();
  if (!by) throw new Error("Ingrese su nombre (QC)");

  const session = await db.qcSessions.get(sid);
  if (!session) throw new Error("Sesión no encontrada");
  if ((session.status || "OPEN") !== "OPEN") throw new Error("Sesión cerrada");

  const pallet = await db.pallets.get(pId);
  if (!pallet) throw new Error("Pallet no encontrado (registrar en Entrada primero)");

  const already = await db.qcSamples.where({ sessionId: sid, palletId: pId }).first();
  if (already) throw new Error("Este pallet ya está registrado como muestra");

  const baseDate = pallet.assignedAt || pallet.receivedAt;
  const days = baseDate ? daysBetween(baseDate) : null;

  const st = String(session.stage || (session.planId ? "DISPATCH" : "PROCESS")).toUpperCase() === "DISPATCH" ? "DISPATCH" : "PROCESS";
  const exp = expected || {};

  // Normalización muestreo por cajas
  const boxesN = sampleBoxesCount === null || sampleBoxesCount === undefined || sampleBoxesCount === "" ? null : Number(sampleBoxesCount);
  const boxesCount = Number.isFinite(boxesN) ? boxesN : null;
  const wl = Array.isArray(sampleWindowLabels)
    ? sampleWindowLabels.map((x) => String(x || "").trim()).filter(Boolean)
    : String(sampleWindowLabels || "").split(/[;,\n]+/).map((x) => x.trim()).filter(Boolean);
  const retained = !!retainedInPlant;
  const retainedN = retainedBoxesCount === null || retainedBoxesCount === undefined || retainedBoxesCount === "" ? null : Number(retainedBoxesCount);
  const retainedCnt = Number.isFinite(retainedN) ? retainedN : (retained ? boxesCount : null);

  await db.transaction("rw", db.qcSamples, db.movements, async () => {
    await db.qcSamples.add({
      sessionId: sid,
      palletId: pId,
      stage: st,
      timestamp: nowISO(),
      result: String(result || "OK"),
      note: String(note || "").trim(),

      // Muestreo por cajas (evidencia)
      sampleBoxesCount: boxesCount,
      sampleWindowLabels: wl,
      retainedInPlant: retained,
      retainedBoxesCount: retainedCnt,
      // snapshot
      client: pallet.client || session.client || "",
      pg: pallet.pg || session.pg || "",
      containerNo: session.containerNo || "",
      isPucho: !!pallet.isPucho,
      totalBoxes: pallet.totalBoxes ?? null,
      daysInColdroom: days,

      // QC snapshot (proceso/ despacho)
      qcProcessStatus: pallet.qcProcessStatus || pallet.qcStatus || "PENDING",
      qcDispatchStatus: pallet.qcDispatchStatus || "PENDING",

      qcBy: by,
      bagCode: pallet.bagCode || "",
      boxType: pallet.boxType || "",
      variety: pallet.variety || "",
      calibre: pallet.calibre || "",

      // "Esperado" (programa comercial) si aplica
      expectedClient: String(exp.client || "").trim(),
      expectedBag: String(exp.bag || "").trim(),
      expectedBox: String(exp.box || "").trim(),
      expectedVariety: String(exp.variety || "").trim(),
      expectedSize: String(exp.size || "").trim(),
      expectedWindowLabel: String(exp.windowLabel || "").trim(),
      expectedOrderNumber: String(exp.orderNumber || session.orderNumber || "").trim(),
    });

    await db.movements.add({
      palletId: pId,
      type: "QC_SAMPLE",
      timestamp: nowISO(),
      planId: session.planId ?? null,
      fromLocationId: pallet.locationId || null,
      toLocationId: pallet.locationId || null,
      worker: by,
      note: `MUESTRA(${String(result || "OK")}) ${String(note || "").trim()}`.trim(),
      containerNo: session.containerNo || "",
      pg: pallet.pg || session.pg || "",
      client: pallet.client || session.client || "",
      stage: st,
    });
  });
}

export async function listMySamplesToday(qcBy) {
  const by = String(qcBy || "").trim();
  if (!by) return [];
  const today = new Date().toISOString().slice(0, 10);
  const all = await db.qcSamples.where("qcBy").equals(by).toArray();
  return all
    .filter((s) => String(s.timestamp || "").slice(0, 10) === today)
    .sort((a, b) => String(b.timestamp || "").localeCompare(String(a.timestamp || "")));
}
