import Dexie from "dexie";

// Importante: mantenemos el mismo nombre de DB para no perder datos,
// pero subimos la versión para añadir campos de Calidad y Despacho.
export const db = new Dexie("coldroom_inventory_v1");

// v1 (legacy)
db.version(1).stores({
  pallets: "id, productName, variety, status, locationId, receivedAt",
  locations: "id, [floor+side+orderNo], floor, side, row, slot, orderNo, occupiedBy, updatedAt",
  movements: "++id, palletId, type, timestamp, toLocationId, fromLocationId",
});

// v2: añade QC + Despacho (planes) + más índices útiles
db.version(2)
  .stores({
    pallets: "id, productName, variety, status, locationId, receivedAt, assignedAt, client, pg, qcStatus",
    locations: "id, [floor+side+orderNo], floor, side, row, slot, orderNo, occupiedBy, updatedAt",
    movements: "++id, palletId, type, timestamp, planId, toLocationId, fromLocationId",
    plans: "++id, containerNo, pg, client, status, createdAt",
  })
  .upgrade(async (tx) => {
    // Backfill de campos nuevos sin romper datos antiguos
    await tx.table("pallets").toCollection().modify((p) => {
      if (p.client === undefined) p.client = "";
      if (p.pg === undefined) p.pg = "";

      // QC
      if (p.qcStatus === undefined) p.qcStatus = "PENDING"; // PENDING | OK | BLOCKED
      if (p.qcReason === undefined) p.qcReason = "";
      if (p.qcAt === undefined) p.qcAt = null;
      if (p.qcBy === undefined) p.qcBy = "";

      // Cámara / ubicación
      if (p.assignedAt === undefined) p.assignedAt = p.locationId ? (p.receivedAt || null) : null;

      // Puchos
      if (p.totalBoxes === undefined) p.totalBoxes = null;
      if (p.isPucho === undefined) p.isPucho = false;
    });
  });

// v3: Muestreos de calidad + flags del plan (QC obligatorio, permitir vencidos)
db.version(3)
  .stores({
    pallets: "id, productName, variety, status, locationId, receivedAt, assignedAt, client, pg, qcStatus",
    locations: "id, [floor+side+orderNo], floor, side, row, slot, orderNo, occupiedBy, updatedAt",
    movements: "++id, palletId, type, timestamp, planId, toLocationId, fromLocationId",
    plans: "++id, containerNo, pg, client, status, createdAt, requireQcOk",
    qcSessions: "++id, planId, containerNo, pg, qcBy, createdAt",
    // Nota: en v3 no indexamos qcBy aún. v4 agrega el índice para reportes.
    qcSamples: "++id, sessionId, palletId, timestamp",
  })
  .upgrade(async (tx) => {
    // Backfill flags del plan
    await tx.table("plans").toCollection().modify((pl) => {
      if (pl.requireQcOk === undefined) pl.requireQcOk = false; // por defecto: NO obligatorio (permite muestreo)
      if (pl.allowExpired === undefined) pl.allowExpired = false;
    });
  });

// v4: índices extra para reportes (qcSamples por qcBy/fecha)
db.version(4)
  .stores({
  pallets: "id, productName, variety, status, locationId, receivedAt, assignedAt, client, pg, qcStatus",
  locations: "id, [floor+side+orderNo], floor, side, row, slot, orderNo, occupiedBy, updatedAt",
  movements: "++id, palletId, type, timestamp, planId, toLocationId, fromLocationId",
  plans: "++id, containerNo, pg, client, status, createdAt, requireQcOk",
  qcSessions: "++id, planId, containerNo, pg, qcBy, createdAt",
  qcSamples: "++id, sessionId, palletId, qcBy, timestamp",
})
  .upgrade(async (tx) => {
    // Backfill qcBy en muestras antiguas (si existieran)
    await tx.table("qcSamples").toCollection().modify((s) => {
      if (s.qcBy === undefined) s.qcBy = String(s.worker || s.createdBy || "");
    });
  });


// v5: Campos de muestreo (bolsa/caja/calibre) para QC
db.version(5)
  .stores({
    pallets: "id, productName, variety, status, locationId, receivedAt, assignedAt, client, pg, qcStatus, bagCode, boxType, calibre",
    locations: "id, [floor+side+orderNo], floor, side, row, slot, orderNo, occupiedBy, updatedAt",
    movements: "++id, palletId, type, timestamp, planId, toLocationId, fromLocationId",
    plans: "++id, containerNo, pg, client, status, createdAt, requireQcOk",
    qcSessions: "++id, planId, containerNo, pg, qcBy, createdAt",
    qcSamples: "++id, sessionId, palletId, qcBy, timestamp",
  })
  .upgrade(async (tx) => {
    await tx.table("pallets").toCollection().modify((p) => {
      if (p.bagCode === undefined) p.bagCode = "";
      if (p.boxType === undefined) p.boxType = "";
      if (p.calibre === undefined) p.calibre = "";
      // variedad ya existía, pero por si viene vacío
      if (p.variety === undefined) p.variety = "";
    });

    await tx.table("qcSamples").toCollection().modify((s) => {
      if (s.bagCode === undefined) s.bagCode = "";
      if (s.boxType === undefined) s.boxType = "";
      if (s.variety === undefined) s.variety = "";
      if (s.calibre === undefined) s.calibre = "";
    });
  });


// v6: Separa Calidad de Proceso vs Calidad de Despacho (dos estados QC) + stage en muestreos
db.version(6)
  .stores({
    pallets: "id, productName, variety, status, locationId, receivedAt, assignedAt, client, pg, qcProcessStatus, qcDispatchStatus, bagCode, boxType, calibre",
    locations: "id, [floor+side+orderNo], floor, side, row, slot, orderNo, occupiedBy, updatedAt",
    movements: "++id, palletId, type, timestamp, planId, toLocationId, fromLocationId",
    plans: "++id, containerNo, pg, client, status, createdAt, requireQcOk",
    qcSessions: "++id, stage, planId, containerNo, pg, qcBy, createdAt",
    qcSamples: "++id, sessionId, palletId, stage, qcBy, timestamp",
  })
  .upgrade(async (tx) => {
    // Pallets: si venimos con qcStatus único, lo tratamos como QC de PROCESO
    await tx.table("pallets").toCollection().modify((p) => {
      if (p.qcProcessStatus === undefined) p.qcProcessStatus = p.qcStatus || "PENDING";
      if (p.qcProcessReason === undefined) p.qcProcessReason = p.qcReason || "";
      if (p.qcProcessAt === undefined) p.qcProcessAt = p.qcAt || null;
      if (p.qcProcessBy === undefined) p.qcProcessBy = p.qcBy || "";

      if (p.qcDispatchStatus === undefined) p.qcDispatchStatus = "PENDING";
      if (p.qcDispatchReason === undefined) p.qcDispatchReason = "";
      if (p.qcDispatchAt === undefined) p.qcDispatchAt = null;
      if (p.qcDispatchBy === undefined) p.qcDispatchBy = "";
    });

    // Sesiones: stage
    await tx.table("qcSessions").toCollection().modify((s) => {
      if (s.stage === undefined) s.stage = s.planId ? "DISPATCH" : "PROCESS";
      if (s.client === undefined) s.client = "";
    });

    // Muestras: stage derivado de la sesión + defaults de "esperado" (programa comercial)
    const sessions = await tx.table("qcSessions").toArray();
    const map = new Map(sessions.map((x) => [x.id, x]));
    await tx.table("qcSamples").toCollection().modify((sm) => {
      if (sm.stage === undefined) sm.stage = map.get(sm.sessionId)?.stage || "PROCESS";
      if (sm.expectedClient === undefined) sm.expectedClient = "";
      if (sm.expectedBag === undefined) sm.expectedBag = "";
      if (sm.expectedBox === undefined) sm.expectedBox = "";
      if (sm.expectedVariety === undefined) sm.expectedVariety = "";
      if (sm.expectedSize === undefined) sm.expectedSize = "";
      if (sm.expectedWindowLabel === undefined) sm.expectedWindowLabel = "";
    });
  });

// v7: Muestreo por CAJAS (evidencia por contenedor)
// Guardamos cantidad de cajas muestreadas y rótulos "ventana" escaneados.
db.version(7)
  .stores({
    pallets:
      "id, productName, variety, status, locationId, receivedAt, assignedAt, client, pg, qcProcessStatus, qcDispatchStatus, bagCode, boxType, calibre",
    locations: "id, [floor+side+orderNo], floor, side, row, slot, orderNo, occupiedBy, updatedAt",
    movements: "++id, palletId, type, timestamp, planId, toLocationId, fromLocationId",
    plans: "++id, containerNo, pg, client, status, createdAt, requireQcOk",
    qcSessions: "++id, stage, planId, containerNo, pg, qcBy, createdAt",
    qcSamples: "++id, sessionId, palletId, stage, qcBy, timestamp",
  })
  .upgrade(async (tx) => {
    await tx.table("qcSamples").toCollection().modify((s) => {
      if (s.sampleBoxesCount === undefined) s.sampleBoxesCount = null; // número de cajas muestreadas
      if (s.sampleWindowLabels === undefined) s.sampleWindowLabels = []; // rótulos ventana (array)
      if (s.retainedInPlant === undefined) s.retainedInPlant = false; // evidencia (cajas se quedan en planta)
      if (s.retainedBoxesCount === undefined) s.retainedBoxesCount = null;
    });
  });


// v8: Usuarios + Sesiones + Auditoría (login/roles) — para sistema más profesional
db.version(8)
  .stores({
    pallets:
      "id, productName, variety, status, locationId, receivedAt, assignedAt, client, pg, qcProcessStatus, qcDispatchStatus, bagCode, boxType, calibre",
    locations: "id, [floor+side+orderNo], floor, side, row, slot, orderNo, occupiedBy, updatedAt",
    movements: "++id, palletId, type, timestamp, planId, toLocationId, fromLocationId",
    plans: "++id, containerNo, pg, client, status, createdAt, requireQcOk",
    qcSessions: "++id, stage, planId, containerNo, pg, qcBy, createdAt",
    qcSamples: "++id, sessionId, palletId, stage, qcBy, timestamp",

    users: "++id,&username,role,isActive,createdAt",
    sessions: "&token,userId,createdAt,expiresAt",
    auditLogs: "++id,timestamp,userId,action",
  })
  .upgrade(async (tx) => {
    // Backfill: por si existen usuarios antiguos (no aplica normalmente)
    const users = tx.table("users");
    if (users) {
      await users.toCollection().modify((u) => {
        if (u.isActive === undefined) u.isActive = true;
        if (u.role === undefined) u.role = "VIEWER";
        if (u.createdAt === undefined) u.createdAt = new Date().toISOString();
      });
    }
  });
