import { useEffect, useMemo, useState } from "react";
import { useScanQueue } from "../hooks/useScanQueue.js";
import { palletCodeIsValid } from "../utils/validate.js";
import { okFeedback, errorFeedback } from "../utils/feedback.js";
import Toast from "../components/Toast.jsx";
import ScanHint from "../components/ScanHint.jsx";
import { createPlan, getPlan, listOpenPlans, loadPalletForPlan, closePlan } from "../services/ops.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { ROLES } from "../auth/roles.js";

const ACTIVE_PLAN_KEY = "cr_active_plan";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function Dispatch() {
  const { user } = useAuth();
  const isAdmin = user?.role === ROLES.ADMIN;

  const [toast, setToast] = useState("");

  // Identidad (despacho)
  const [worker, setWorker] = useState(() => localStorage.getItem("cr_dispatch_by") || "");
  const [shift, setShift] = useState(() => localStorage.getItem("cr_shift") || "DAY");

  useEffect(() => {
    if (!user?.name) return;
    if (!isAdmin && String(worker || "").trim() !== String(user.name).trim()) {
      setWorker(user.name);
    }
    if (!worker) setWorker(user.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin]);

  // crear/activar plan
  const [containerNo, setContainerNo] = useState("");
  const [pg, setPg] = useState("");
  const [client, setClient] = useState("");
  const [maxDays, setMaxDays] = useState(10);
  const [allowExpired, setAllowExpired] = useState(false);
  const [requireQcOk, setRequireQcOk] = useState(false);
  const [plans, setPlans] = useState([]);

  const [activePlanId, setActivePlanId] = useState(() => {
    const v = localStorage.getItem(ACTIVE_PLAN_KEY);
    return v ? Number(v) : null;
  });
  const [activePlan, setActivePlan] = useState(null);

  const [loadedToday, setLoadedToday] = useState([]);

  async function refreshPlans(selectPlanId = null) {
    const all = await listOpenPlans();
    setPlans(all);
    const id = selectPlanId ?? activePlanId;
    if (id) {
      const p = await getPlan(id);
      setActivePlan(p || null);
    } else {
      setActivePlan(null);
    }
  }

  useEffect(() => {
    refreshPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem("cr_dispatch_by", worker || "");
  }, [worker]);
  useEffect(() => {
    localStorage.setItem("cr_shift", shift || "DAY");
  }, [shift]);

  useEffect(() => {
    if (activePlanId) localStorage.setItem(ACTIVE_PLAN_KEY, String(activePlanId));
    else localStorage.removeItem(ACTIVE_PLAN_KEY);
    refreshPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlanId]);

  // lo cargado hoy para el plan activo (vista rápida)
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!activePlanId) {
        setLoadedToday([]);
        return;
      }
      const { db } = await import("../db/index.js");
      const all = await db.movements.where("type").equals("LOAD").toArray();
      const today = todayISO();
      const filtered = all
        .filter((m) => String(m.timestamp || "").slice(0, 10) === today)
        .filter((m) => Number(m.planId) === Number(activePlanId))
        .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
      if (!alive) return;
      setLoadedToday(filtered);
    })();
    return () => {
      alive = false;
    };
  }, [activePlanId, toast]);

  async function activateExisting(id) {
    setActivePlanId(Number(id));
    okFeedback();
    setToast(`✅ Plan activo: #${id}`);
  }

  async function createAndActivate() {
    try {
      setToast("");
      const id = await createPlan({ containerNo, pg, client, maxDays, allowExpired, requireQcOk });
      okFeedback();
      setToast(`✅ Plan creado: #${id}`);
      setContainerNo("");
      setPg("");
      setClient("");
      setAllowExpired(false);
      setRequireQcOk(false);
      setActivePlanId(id);
      await refreshPlans(id);
    } catch (e) {
      errorFeedback();
      setToast(`❌ ${e.message || "Error"}`);
    }
  }

  async function onScan(code) {
    try {
      if (!activePlanId) throw new Error("Primero activa un contenedor (Plan)");
      const w = String(worker || "").trim();
      if (!w) throw new Error("Falta el nombre del despachador (Perfil)");

      await loadPalletForPlan({ planId: activePlanId, palletId: code, worker: w, shift });
      okFeedback();
      setToast(`✅ CARGADO: ${code}`);
    } catch (e) {
      errorFeedback();
      setToast(`❌ ${e.message || "Error"}`);
    }
  }

  useScanQueue({ validate: palletCodeIsValid, onScanAsync: onScan });

  const planTitle = useMemo(() => {
    if (!activePlan) return "—";
    const parts = [activePlan.containerNo];
    if (activePlan.pg) parts.push(activePlan.pg);
    if (activePlan.client) parts.push(activePlan.client);
    return parts.join(" | ");
  }, [activePlan]);

  async function cerrar() {
    try {
      if (!activePlanId) return;
      await closePlan(activePlanId);
      okFeedback();
      setToast(`✅ Contenedor cerrado (Plan #${activePlanId})`);
      setActivePlanId(null);
      await refreshPlans();
    } catch (e) {
      errorFeedback();
      setToast(`❌ ${e.message || "Error"}`);
    }
  }

  return (
    <div className="container">
      <div className="h1">Despacho</div>

      <ScanHint
        title="1) Active el contenedor (Plan)"
        subtitle="2) Escanee pallets para CARGAR. La app bloquea si QC está BLOQUEADO y si PG no coincide. (Opcional: activar 'QC obligatorio')."
      />

      <div className="grid" style={{ marginTop: 10 }}>
        <input
          className="input"
          value={worker}
          onChange={(e) => setWorker(e.target.value)}
          placeholder="Nombre Despacho"
          disabled={!isAdmin}
        />

        <select value={shift} onChange={(e) => setShift(e.target.value)}>
          <option value="DAY">Día</option>
          <option value="NIGHT">Noche</option>
        </select>

        {!isAdmin ? <div className="muted">(Tu usuario define el nombre; solo Admin puede editar)</div> : null}
      </div>

      <div className="card" style={{ marginTop: 10 }}>
        <div style={{ fontWeight: 1000 }}>Plan activo</div>
        <div style={{ fontSize: 16, fontWeight: 1000, marginTop: 8 }}>{planTitle}</div>
        <div className="muted" style={{ marginTop: 6 }}>Escanee pallet → se marca como CARGADO y se libera ubicación.</div>
        {activePlan ? (
          <div className="muted" style={{ marginTop: 6 }}>
            QC obligatorio: <b>{activePlan.requireQcOk ? "SI" : "NO (modo muestreo)"}</b> | Permitir vencidos: <b>{activePlan.allowExpired ? "SI" : "NO"}</b> | Máx días: <b>{activePlan.maxDays || 10}</b>
          </div>
        ) : null}

        <div className="grid grid2" style={{ marginTop: 10 }}>
          <button className="btn btnPrimary" onClick={cerrar} disabled={!activePlanId} style={{ opacity: activePlanId ? 1 : 0.6 }}>
            ✅ Cerrar contenedor
          </button>
          <button className="btn btnGhost" onClick={() => setActivePlanId(null)} disabled={!activePlanId} style={{ opacity: activePlanId ? 1 : 0.6 }}>
            Cambiar plan
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 10 }}>
        <div style={{ fontWeight: 1000 }}>Crear nuevo plan (rápido)</div>
        <div className="grid" style={{ marginTop: 8 }}>
          <input className="input" value={containerNo} onChange={(e) => setContainerNo(e.target.value)} placeholder="Contenedor (ej. MSCU1234567)" />
          <input className="input" value={pg} onChange={(e) => setPg(e.target.value)} placeholder="PG (Pedido)" />
          <input className="input" value={client} onChange={(e) => setClient(e.target.value)} placeholder="Cliente (opcional)" />
          <input className="input" value={String(maxDays)} onChange={(e) => setMaxDays(Number(e.target.value) || 10)} placeholder="Máx días export" inputMode="numeric" />
        </div>

        <div className="grid" style={{ marginTop: 8 }}>
          <label className="card" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input type="checkbox" checked={requireQcOk} onChange={(e) => setRequireQcOk(e.target.checked)} />
            <div>
              <div style={{ fontWeight: 1000 }}>QC obligatorio</div>
              <div className="muted">Si está activo, solo cargará pallets con QC = LIBERADO</div>
            </div>
          </label>
          <label className="card" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input type="checkbox" checked={allowExpired} onChange={(e) => setAllowExpired(e.target.checked)} />
            <div>
              <div style={{ fontWeight: 1000 }}>Permitir vencidos</div>
              <div className="muted">Permite cargar pallets con &gt; Máx días (solo si lo autorizas)</div>
            </div>
          </label>
        </div>

        <button
          className="btn btnPrimary"
          onClick={createAndActivate}
          disabled={!containerNo.trim()}
          style={{ marginTop: 10, opacity: containerNo.trim() ? 1 : 0.6 }}
        >
          Crear y activar
        </button>
      </div>

      <div className="card" style={{ marginTop: 10 }}>
        <div style={{ fontWeight: 1000 }}>Planes abiertos</div>
        <div className="muted" style={{ marginTop: 6 }}>Selecciona un plan existente para activarlo.</div>
        <div className="grid" style={{ marginTop: 8 }}>
          {plans.map((p) => (
            <button
              key={p.id}
              className="btn btnGhost"
              onClick={() => activateExisting(p.id)}
              style={{ textAlign: "left" }}
              disabled={Number(p.id) === Number(activePlanId)}
            >
              <b>#{p.id}</b> {p.containerNo} {p.pg ? `| ${p.pg}` : ""} {p.client ? `| ${p.client}` : ""}
            </button>
          ))}
          {plans.length === 0 ? <div className="muted">No hay planes abiertos</div> : null}
        </div>
      </div>

      {activePlanId ? (
        <div className="card" style={{ marginTop: 10 }}>
          <div style={{ fontWeight: 1000 }}>Cargados hoy (Plan activo)</div>
          <div className="muted" style={{ marginTop: 6 }}>Últimos {loadedToday.length} movimientos</div>
          <div style={{ marginTop: 8, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", fontSize: 12, color: "var(--muted)" }}>Hora</th>
                  <th style={{ textAlign: "left", fontSize: 12, color: "var(--muted)" }}>Pallet</th>
                  <th style={{ textAlign: "left", fontSize: 12, color: "var(--muted)" }}>Operador</th>
                </tr>
              </thead>
              <tbody>
                {loadedToday.slice(0, 15).map((m) => (
                  <tr key={m.id}>
                    <td style={{ padding: "6px 0" }}>{String(m.timestamp || "").slice(11, 19)}</td>
                    <td style={{ padding: "6px 0", fontWeight: 900 }}>{m.palletId}</td>
                    <td style={{ padding: "6px 0" }}>{m.worker || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <Toast text={toast} />
    </div>
  );
}
