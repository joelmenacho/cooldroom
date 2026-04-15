import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import { ROLES } from "../auth/roles.js";
import { useScanQueue } from "../hooks/useScanQueue.js";
import { palletCodeIsValid } from "../utils/validate.js";
import { okFeedback, errorFeedback } from "../utils/feedback.js";
import Toast from "../components/Toast.jsx";
import { CATALOG, mergedOptions } from "../data/catalogs.js";
import ScanHint from "../components/ScanHint.jsx";
import { getPallet, setQCStage, updatePalletMeta, QC_STATUS, QC_STAGE, listOpenPlans, getPlan } from "../services/ops.js";
import { daysBetween } from "../services/inventory.js";
import { findProgramOrder, listProgramOrderNumbers } from "../data/programOrders.js";
import {
  createQCSamplingSession,
  closeQCSamplingSession,
  listMyOpenSessions,
  getQCSamplingSession,
  listSessionSamples,
  addSampleToSession,
} from "../services/qcSampling.js";

const REASONS = [
  "Bolsa/Etiqueta incorrecta",
  "Caja/Envase incorrecto",
  "Variedad incorrecta",
  "Calibre incorrecto",
  "Etiqueta / Window incorrecta",
  "Mezcla de pedido (PG/Order)",
  "Otro",
];

const STAGES = {
  PROCESS: "PROCESS",
  DISPATCH: "DISPATCH",
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function Quality() {
  const { user } = useAuth();
  const role = user?.role;
  const isAdmin = role === ROLES.ADMIN;

  const [toast, setToast] = useState("");

  // Modo de Calidad
  const [mode, setMode] = useState(() => localStorage.getItem("cr_quality_mode") || STAGES.PROCESS);
  useEffect(() => localStorage.setItem("cr_quality_mode", mode), [mode]);

  // Identidad QC
  const [qcBy, setQcBy] = useState(() => localStorage.getItem("cr_qc_by") || "");
  useEffect(() => localStorage.setItem("cr_qc_by", qcBy), [qcBy]);

  // En modo profesional, el nombre viene del usuario logueado (Admin puede editar si quiere)
  useEffect(() => {
    if (!user?.name) return;
    if (!isAdmin && String(qcBy || "").trim() !== String(user.name).trim()) {
      setQcBy(user.name);
    }
    if (!qcBy) setQcBy(user.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin]);

  // Rol define la etapa: QC_PROCESO o QC_DESPACHO (Admin puede cambiar)
  useEffect(() => {
    if (isAdmin) return;
    if (role === ROLES.QC_PROCESS) setMode(STAGES.PROCESS);
    if (role === ROLES.QC_DISPATCH) setMode(STAGES.DISPATCH);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, isAdmin]);

  // Plan/Contenedor (solo QC Despacho)
  const [plans, setPlans] = useState([]);
  const [activePlanId, setActivePlanId] = useState(() => {
    const v = localStorage.getItem("cr_qc_active_plan");
    return v ? Number(v) : null;
  });
  const [activePlan, setActivePlan] = useState(null);

  // Pallet actual
  const [palletId, setPalletId] = useState("");
  const [pallet, setPallet] = useState(null);

  // Meta del pallet (observado)
  const [client, setClient] = useState("");
  const [pg, setPg] = useState("");
  const [bagCode, setBagCode] = useState("");
  const [boxType, setBoxType] = useState("");
  const [variety, setVariety] = useState("");
  const [calibre, setCalibre] = useState("");
  const [totalBoxes, setTotalBoxes] = useState("");
  const [isPucho, setIsPucho] = useState(false);

  // Programa comercial (solo QC Proceso): esperado
  const [orderNumber, setOrderNumber] = useState("");
  const expected = useMemo(() => {
    if (!orderNumber) return null;
    return findProgramOrder(orderNumber);
  }, [orderNumber]);

  // QC (per pallet)
  const [reason, setReason] = useState(REASONS[0]);

  // Muestreo
  const [mySessions, setMySessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(() => {
    const v = localStorage.getItem("cr_qc_active_session");
    return v ? Number(v) : null;
  });
  const [activeSession, setActiveSession] = useState(null);
  const [sessionSamples, setSessionSamples] = useState([]);
  const [sampleResult, setSampleResult] = useState("OK");
  const [sampleNote, setSampleNote] = useState("");

  // Muestreo por cajas (evidencia)
  const [sampleBoxesCount, setSampleBoxesCount] = useState(2); // 2..5 típico
  const [retainedInPlant, setRetainedInPlant] = useState(false);
  const [sampleWindowLabelInput, setSampleWindowLabelInput] = useState("");
  const [sampleWindowLabels, setSampleWindowLabels] = useState([]); // rótulos ventana

  // Por defecto: en QC Despacho suele quedar evidencia (2..5 cajas por contenedor)
  useEffect(() => {
    if (mode === STAGES.DISPATCH) {
      setRetainedInPlant(true);
      if (!sampleBoxesCount) setSampleBoxesCount(2);
    } else {
      setRetainedInPlant(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const [myActionsToday, setMyActionsToday] = useState([]);

  const onScan = useCallback(async (code) => {
    const c = String(code || "").trim();
    if (!palletCodeIsValid(c)) {
      errorFeedback();
      setToast("⚠️ Código de pallet inválido");
      return;
    }

    setPalletId(c);
    try {
      const p = await getPallet(c);
      if (!p) {
        setPallet(null);
        errorFeedback();
        setToast("⚠️ Pallet no encontrado (registrar en Entrada primero)");
        return;
      }

      setPallet(p);
      setClient(p.client || "");
      setPg(p.pg || "");
      setBagCode(p.bagCode || "");
      setBoxType(p.boxType || "");
      setVariety(p.variety || "");
      setCalibre(p.calibre || "");
      setTotalBoxes(p.totalBoxes === null || p.totalBoxes === undefined ? "" : String(p.totalBoxes));
      setIsPucho(!!p.isPucho);

      okFeedback();
    } catch (e) {
      errorFeedback();
      setToast(`❌ ${e?.message || "No se pudo cargar el pallet"}`);
    }
  }, []);

  useScanQueue({ validate: palletCodeIsValid, onScanAsync: onScan });

  const bagOptions = useMemo(() => (client ? mergedOptions(client, "bags") : CATALOG.global?.bags || []), [client]);
  const boxOptions = useMemo(() => (client ? mergedOptions(client, "boxes") : CATALOG.global?.boxes || []), [client]);
  const varietyOptions = useMemo(() => (client ? mergedOptions(client, "varieties") : CATALOG.global?.varieties || []), [client]);
  const calibreOptions = useMemo(() => (client ? mergedOptions(client, "calibres") : CATALOG.global?.calibres || []), [client]);

  const daysInColdroom = useMemo(() => {
    if (!pallet) return null;
    const base = pallet.assignedAt || pallet.receivedAt;
    return base ? daysBetween(base) : null;
  }, [pallet]);

  // Cargar planes si estamos en despacho
  useEffect(() => {
    (async () => {
      try {
        const rows = await listOpenPlans();
        setPlans(rows);
        if (mode === STAGES.DISPATCH && activePlanId) {
          const pl = await getPlan(activePlanId);
          setActivePlan(pl || null);
        } else {
          setActivePlan(null);
        }
      } catch {
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, activePlanId, toast]);

  async function loadByInput() {
    const code = String(palletId || "").trim();
    if (!palletCodeIsValid(code)) {
      errorFeedback();
      setToast("⚠️ Código de pallet inválido");
      return;
    }
    await onScan(code);
  }

  async function saveMeta() {
    if (!pallet) return;
    await updatePalletMeta(pallet.id, {
      client,
      pg,
      bagCode,
      boxType,
      variety,
      calibre,
      totalBoxes: totalBoxes === "" ? null : Number(totalBoxes),
      isPucho: !!isPucho,
    });
  }

  function statusLabel() {
    if (!pallet) return "—";
    const qcProc = pallet.qcProcessStatus || pallet.qcStatus || "PENDING";
    const qcDisp = pallet.qcDispatchStatus || "PENDING";
    if (mode === STAGES.PROCESS) return qcProc;
    return qcDisp;
  }

  async function doQC(status) {
    if (!pallet) return;

    // En QC Despacho pedimos que seleccione el contenedor (para operar ordenado)
    if (mode === STAGES.DISPATCH && !activePlanId) {
      errorFeedback();
      setToast("⚠️ Seleccione contenedor (Plan) en QC Despacho");
      return;
    }

    try {
      await saveMeta();
      await setQCStage({
        palletId: pallet.id,
        stage: mode === STAGES.PROCESS ? QC_STAGE.PROCESS : QC_STAGE.DISPATCH,
        status,
        reason: status === QC_STATUS.BLOCKED ? reason : "",
        qcBy,
      });

      const p2 = await getPallet(pallet.id);
      setPallet(p2);

      okFeedback();
      setToast(status === QC_STATUS.OK ? "✅ QC registrado" : "⛔ Pallet bloqueado");
    } catch (e) {
      errorFeedback();
      setToast(`❌ ${e.message || "Error registrando QC"}`);
    }
  }

  async function refreshSampling() {
    // sesiones por etapa
    const sessions = await listMyOpenSessions({ qcBy, stage: mode });
    setMySessions(sessions);

    if (activeSessionId) {
      const s = await getQCSamplingSession(activeSessionId);
      setActiveSession(s || null);
      const samples = await listSessionSamples(activeSessionId);
      setSessionSamples(samples);
    } else {
      setActiveSession(null);
      setSessionSamples([]);
    }
  }

  useEffect(() => {
    refreshSampling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qcBy, activeSessionId, mode, toast]);

  async function createSession() {
    try {
      const sid = await createQCSamplingSession({
        stage: mode,
        planId: mode === STAGES.DISPATCH ? (activePlanId || null) : null,
        containerNo: mode === STAGES.DISPATCH ? (activePlan?.containerNo || "") : "",
        pg: pg || "",
        client: client || "",
        orderNumber: mode === STAGES.PROCESS ? (orderNumber || "") : "",
        qcBy,
        targetCount: 5,
      });
      localStorage.setItem("cr_qc_active_session", String(sid));
      setActiveSessionId(Number(sid));
      okFeedback();
      setToast("✅ Sesión creada");
    } catch (e) {
      errorFeedback();
      setToast(`❌ ${e.message || "No se pudo crear sesión"}`);
    }
  }

  async function closeSession() {
    if (!activeSessionId) return;
    try {
      await closeQCSamplingSession(activeSessionId);
      localStorage.removeItem("cr_qc_active_session");
      setActiveSessionId(null);
      okFeedback();
      setToast("✅ Sesión cerrada");
    } catch (e) {
      errorFeedback();
      setToast(`❌ ${e.message || "No se pudo cerrar sesión"}`);
    }
  }

  async function addCurrentAsSample() {
    if (!activeSessionId) {
      errorFeedback();
      setToast("⚠️ Cree / seleccione una sesión");
      return;
    }
    if (!pallet) {
      errorFeedback();
      setToast("⚠️ Escanee un pallet primero");
      return;
    }

    try {
      await saveMeta();

      // Validación muestreo por cajas (evidencia)
      const n = Number(sampleBoxesCount);
      const boxesCount = Number.isFinite(n) ? n : 0;
      if (retainedInPlant) {
        if (boxesCount < 1) throw new Error("Ingrese cantidad de cajas muestreadas");
        // Regla recomendada: 2 a 5 cajas por contenedor (evidencia)
        if (mode === STAGES.DISPATCH && (boxesCount < 2 || boxesCount > 5)) {
          throw new Error("Para evidencia por contenedor, use 2 a 5 cajas");
        }
      }

      const exp = expected
        ? {
            orderNumber: String(expected.orderNumber || "").trim(),
            client: String(expected.client || "").trim(),
            bag: String(expected.typeOfBag || "").trim(),
            box: String(expected.typeOfBox || "").trim(),
            variety: String(expected.variety || "").trim(),
            size: String(expected.size || "").trim(),
            windowLabel: String(expected.windowLabel || "").trim(),
          }
        : null;

      await addSampleToSession({
        sessionId: activeSessionId,
        palletId: pallet.id,
        qcBy,
        result: sampleResult,
        note: sampleNote,
        sampleBoxesCount,
        sampleWindowLabels,
        retainedInPlant,
        retainedBoxesCount: retainedInPlant ? sampleBoxesCount : null,
        expected: exp,
      });

      okFeedback();
      setSampleNote("");
      setSampleWindowLabels([]);
      setSampleWindowLabelInput("");
      setToast("✅ Muestra guardada");

      // refresh
      const samples = await listSessionSamples(activeSessionId);
      setSessionSamples(samples);

      const p2 = await getPallet(pallet.id);
      setPallet(p2);
    } catch (e) {
      errorFeedback();
      setToast(`❌ ${e.message || "No se pudo guardar muestra"}`);
    }
  }

  // Acciones del día
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const all = await import("../db/index.js").then((m) => m.db.movements.where("type").startsWith("QC_").toArray());
        const today = todayISO();
        const mine = (all || [])
          .filter((m) => String(m.timestamp || "").slice(0, 10) === today)
          .filter((m) => String(m.worker || "").trim() === String(qcBy || "").trim())
          .filter((m) => {
          const t = String(m.type || "");
          const st = String(m.stage || (t === "QC_SAMPLE" ? mode : "")).toUpperCase();
          if (mode === STAGES.PROCESS) return t.startsWith("QC_PROCESS") || (t === "QC_SAMPLE" && st === "PROCESS");
          return t.startsWith("QC_DISPATCH") || (t === "QC_SAMPLE" && st === "DISPATCH");
        })
          .sort((a, b) => String(b.timestamp || "").localeCompare(String(a.timestamp || "")))
          .slice(0, 50);
        if (!alive) return;
        setMyActionsToday(mine);
      } catch {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, [qcBy, mode, toast]);

  return (
    <div className="container">
      <div className="h1">Calidad</div>
      <ScanHint />

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="grid grid2" style={{ alignItems: "center" }}>
          <div>
            <div className="muted">Mi nombre (QC)</div>
            <input className="input" value={qcBy} onChange={(e) => setQcBy(e.target.value)} placeholder="Ej. MARIELA" disabled={!isAdmin} />
          </div>

          <div>
            <div className="muted">Tipo de calidad</div>
            <div className="grid grid2" style={{ gap: 8 }}>
              <button type="button" disabled={!isAdmin} className={mode === STAGES.PROCESS ? "btn btnPrimary" : "btn"} onClick={() => setMode(STAGES.PROCESS)}>
                Proceso
              </button>
              <button type="button" disabled={!isAdmin} className={mode === STAGES.DISPATCH ? "btn btnPrimary" : "btn"} onClick={() => setMode(STAGES.DISPATCH)}>
                Despacho
              </button>
            </div>
          </div>
        </div>

        {mode === STAGES.DISPATCH && (
          <div style={{ marginTop: 10 }}>
            <div className="muted">Contenedor (Plan)</div>
            <select
              className="input"
              value={activePlanId || ""}
              onChange={async (e) => {
                const id = e.target.value ? Number(e.target.value) : null;
                setActivePlanId(id);
                localStorage.setItem("cr_qc_active_plan", id ? String(id) : "");
                const pl = id ? await getPlan(id) : null;
                setActivePlan(pl || null);
              }}
            >
              <option value="">— Seleccionar —</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  #{p.id} | {p.containerNo} | PG {p.pg || "—"} | {p.client || "—"}
                </option>
              ))}
            </select>

            {activePlan && (
              <div className="pill" style={{ marginTop: 8 }}>
                Contenedor: <b>{activePlan.containerNo}</b> | PG: <b>{activePlan.pg || "—"}</b> | Cliente: <b>{activePlan.client || "—"}</b>
              </div>
            )}
          </div>
        )}
      </div>

      {mode === STAGES.PROCESS && (
        <div className="card">
          <div className="muted">Pedido / Programa (ORDER NUMBER)</div>
          <input
            className="input"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            placeholder="Ej. 92"
            list="orderNumbers"
          />
          <datalist id="orderNumbers">
            {listProgramOrderNumbers().slice(0, 300).map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>

          {expected && (
            <div className="pill" style={{ marginTop: 8, lineHeight: 1.35 }}>
              <div>
                <b>Esperado (Programa)</b>
              </div>
              <div>Cliente: <b>{expected.client}</b></div>
              <div>Bolsa: <b>{expected.typeOfBag}</b></div>
              <div>Caja: <b>{expected.typeOfBox}</b></div>
              <div>Variedad: <b>{expected.variety}</b> | Size: <b>{expected.size}</b></div>
              <div>Window label: <b>{expected.windowLabel}</b></div>
            </div>
          )}
        </div>
      )}

      <div className="card" style={{ marginTop: 12 }}>
        <div className="h1" style={{ fontSize: 18, margin: 0 }}>1) Escanee el pallet</div>
        <div className="muted">Puede escanear o escribir el código.</div>

        <div className="grid grid2" style={{ marginTop: 10 }}>
          <input className="input" value={palletId} onChange={(e) => setPalletId(e.target.value)} placeholder="UV25A3P..." />
          <button className="btn" onClick={loadByInput}>Cargar</button>
        </div>

        <div style={{ marginTop: 10 }}>
          <div className="muted">Estado QC ({mode === STAGES.PROCESS ? "Proceso" : "Despacho"})</div>
          <div className="pill" style={{ display: "inline-block" }}>
            <b>{statusLabel()}</b>
            {daysInColdroom !== null ? <span className="muted"> &nbsp;| {daysInColdroom} días en cámara</span> : null}
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <div className="muted">Cliente</div>
          <select className="input" value={client} onChange={(e) => setClient(e.target.value)}>
            <option value="">— Seleccionar —</option>
            {(CATALOG.clients || []).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <div className="muted" style={{ marginTop: 8 }}>Bolsa / Etiqueta</div>
          <select className="input" value={bagCode} onChange={(e) => setBagCode(e.target.value)}>
            <option value="">— Seleccionar —</option>
            {bagOptions.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          <div className="muted" style={{ marginTop: 8 }}>Caja / Envase</div>
          <select className="input" value={boxType} onChange={(e) => setBoxType(e.target.value)}>
            <option value="">— Seleccionar —</option>
            {boxOptions.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          <div className="muted" style={{ marginTop: 8 }}>Variedad</div>
          <select className="input" value={variety} onChange={(e) => setVariety(e.target.value)}>
            <option value="">— Seleccionar —</option>
            {varietyOptions.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>

          <div className="muted" style={{ marginTop: 8 }}>Calibre</div>
          <select className="input" value={calibre} onChange={(e) => setCalibre(e.target.value)}>
            <option value="">— Seleccionar —</option>
            {calibreOptions.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>

          <div className="grid grid2" style={{ marginTop: 8 }}>
            <div>
              <div className="muted">PG (Pedido)</div>
              <input className="input" value={pg} onChange={(e) => setPg(e.target.value)} placeholder="PG 891" />
            </div>
            <div>
              <div className="muted">Total cajas</div>
              <input className="input" value={totalBoxes} onChange={(e) => setTotalBoxes(e.target.value)} placeholder="95" inputMode="numeric" />
            </div>
          </div>

          <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10 }}>
            <input type="checkbox" checked={isPucho} onChange={(e) => setIsPucho(e.target.checked)} />
            <div>
              <b>PUCHO</b>
              <div className="muted">Marcar si pallet incompleto</div>
            </div>
          </label>

          <div className="grid grid2" style={{ marginTop: 12, gap: 10 }}>
            <button className="btn btnPrimary" onClick={() => doQC(QC_STATUS.OK)}>✅ Liberar</button>
            <button className="btn" style={{ background: "var(--danger)", color: "white" }} onClick={() => doQC(QC_STATUS.BLOCKED)}>
              ⛔ Bloquear
            </button>
          </div>

          <div style={{ marginTop: 10 }}>
            <div className="muted">Motivo de bloqueo</div>
            <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
              {REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <div className="muted" style={{ marginTop: 6 }}>
              Si bloquea, {mode === STAGES.PROCESS ? "Cámara/Despacho" : "Despacho"} no podrá usar este pallet.
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="h1" style={{ fontSize: 18, margin: 0 }}>2) Muestreo ({mode === STAGES.PROCESS ? "Proceso" : "Despacho"})</div>
        <div className="muted">Normalmente 5 pallets por sesión.</div>

        <div className="grid grid2" style={{ marginTop: 10, gap: 10 }}>
          <button className="btn btnPrimary" onClick={createSession}>➕ Crear sesión (5)</button>
          <button className="btn" onClick={closeSession} disabled={!activeSessionId}>Cerrar sesión</button>
        </div>

        {activeSession && (
          <div className="pill" style={{ marginTop: 10, lineHeight: 1.35 }}>
            <div><b>Sesión activa</b> #{activeSession.id} | {activeSession.stage || mode}</div>
            {activeSession.containerNo ? <div>Contenedor: <b>{activeSession.containerNo}</b></div> : null}
            {activeSession.pg ? <div>PG: <b>{activeSession.pg}</b></div> : null}
            {activeSession.orderNumber ? <div>Order: <b>{activeSession.orderNumber}</b></div> : null}
          </div>
        )}

        <div className="grid grid2" style={{ marginTop: 10 }}>
          <select className="input" value={sampleResult} onChange={(e) => setSampleResult(e.target.value)}>
            <option value="OK">OK</option>
            <option value="OBS">OBS</option>
            <option value="RECHAZO">RECHAZO</option>
          </select>
          <input className="input" value={sampleNote} onChange={(e) => setSampleNote(e.target.value)} placeholder="Nota (opcional)" />
        </div>

        <div className="card" style={{ marginTop: 10, background: "var(--card2)", border: "1px dashed var(--line)" }}>
          <div style={{ fontWeight: 900 }}>Muestreo de cajas (del pallet)</div>
          <div className="muted" style={{ marginTop: 4 }}>
            QC muestrea <b>2 a 5 cajas</b> al azar del pallet. Si se retienen, quedan como evidencia del contenedor.
          </div>

          <div className="grid grid2" style={{ marginTop: 10 }}>
            <div>
              <div className="muted">Cajas muestreadas</div>
              <input
                className="input"
                value={sampleBoxesCount}
                onChange={(e) => setSampleBoxesCount(e.target.value)}
                placeholder="2"
                inputMode="numeric"
              />
            </div>

            <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 18 }}>
              <input type="checkbox" checked={retainedInPlant} onChange={(e) => setRetainedInPlant(e.target.checked)} />
              <div>
                <b>Retener en planta (evidencia)</b>
                <div className="muted">Estas cajas no se cargan. Quedan rotuladas por contenedor/PG.</div>
              </div>
            </label>
          </div>

          <div style={{ marginTop: 10 }}>
            <div className="muted">Rótulo ventana (opcional) — escanee y presione ENTER</div>
            <div className="grid" style={{ gridTemplateColumns: "1fr 120px", gap: 8, marginTop: 6 }}>
              <input
                className="input"
                value={sampleWindowLabelInput}
                onChange={(e) => setSampleWindowLabelInput(e.target.value)}
                placeholder="WINDOW..."
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  const v = String(sampleWindowLabelInput || "").trim();
                  if (!v) return;
                  setSampleWindowLabels((prev) => (prev.includes(v) ? prev : [...prev, v]));
                  setSampleWindowLabelInput("");
                }}
              />
              <button
                className="btn"
                onClick={() => {
                  const v = String(sampleWindowLabelInput || "").trim();
                  if (!v) return;
                  setSampleWindowLabels((prev) => (prev.includes(v) ? prev : [...prev, v]));
                  setSampleWindowLabelInput("");
                }}
              >
                Agregar
              </button>
            </div>

            {sampleWindowLabels.length > 0 && (
              <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {sampleWindowLabels.map((wl) => (
                  <span key={wl} className="pill" style={{ padding: "4px 8px" }}>
                    {wl}
                    <button
                      className="btn"
                      style={{ marginLeft: 6, padding: "2px 6px", height: "auto" }}
                      onClick={() => setSampleWindowLabels((prev) => prev.filter((x) => x !== wl))}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <button className="btn" onClick={() => setSampleWindowLabels([])} style={{ padding: "6px 10px" }}>
                  Limpiar
                </button>
              </div>
            )}
          </div>
        </div>

        <button className="btn btnPrimary" style={{ marginTop: 10, width: "100%" }} onClick={addCurrentAsSample}>
          🧪 Registrar muestreo de cajas (pallet actual)
        </button>

        <div style={{ marginTop: 12 }}>
          <div className="muted">Muestras en sesión: <b>{sessionSamples.length}</b></div>
          <div style={{ maxHeight: 220, overflow: "auto", marginTop: 8 }}>
            {sessionSamples.map((s) => (
              <div key={s.id} className="pill" style={{ marginBottom: 6 }}>
                <b>{s.palletId}</b> — {s.result} {s.note ? `| ${s.note}` : ""}
                <div className="muted" style={{ marginTop: 4 }}>
                  Cliente: {s.client || "—"} | PG: {s.pg || "—"} | Bolsa: {s.bagCode || "—"} | Caja: {s.boxType || "—"} | Var: {s.variety || "—"} | Cal: {s.calibre || "—"}
                </div>
                {(s.sampleBoxesCount || s.retainedInPlant || (s.sampleWindowLabels && s.sampleWindowLabels.length)) ? (
                  <div className="muted" style={{ marginTop: 4 }}>
                    Cajas muestreadas: <b>{s.sampleBoxesCount ?? "—"}</b>
                    {s.retainedInPlant ? <span> | Evidencia en planta: <b>{s.retainedBoxesCount ?? s.sampleBoxesCount ?? "—"}</b></span> : null}
                    {(s.sampleWindowLabels && s.sampleWindowLabels.length) ? <span> | Ventana: <b>{s.sampleWindowLabels.length}</b></span> : null}
                  </div>
                ) : null}
                {mode === STAGES.PROCESS && (s.expectedBag || s.expectedBox) ? (
                  <div className="muted" style={{ marginTop: 4 }}>
                    Esperado: {s.expectedClient ? `Cliente ${s.expectedClient} | ` : ""}Bolsa {s.expectedBag || "—"} | Caja {s.expectedBox || "—"}
                  </div>
                ) : null}
              </div>
            ))}
            {!sessionSamples.length && <div className="muted">Aún no hay muestras.</div>}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="h1" style={{ fontSize: 18, margin: 0 }}>Mis acciones hoy</div>
        <div className="muted">Últimas 50 acciones.</div>
        <div style={{ maxHeight: 220, overflow: "auto", marginTop: 8 }}>
          {myActionsToday.map((m) => (
            <div key={m.id} className="pill" style={{ marginBottom: 6 }}>
              <b>{m.type}</b> — {String(m.timestamp || "").slice(11, 19)} — {m.palletId}
              {m.reason ? <div className="muted">Motivo: {m.reason}</div> : null}
            </div>
          ))}
          {!myActionsToday.length && <div className="muted">Sin acciones aún.</div>}
        </div>
      </div>

      <Toast text={toast} onClose={() => setToast("")} />
    </div>
  );
}
