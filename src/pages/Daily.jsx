import { useEffect, useMemo, useState } from "react";
import Toast from "../components/Toast.jsx";
import { listLoadsByDateISO } from "../services/ops.js";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function Daily() {
  const [dateISO, setDateISO] = useState(() => todayISO());
  const [rows, setRows] = useState([]);
  const [toast, setToast] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setToast("Cargando...");
        const loads = await listLoadsByDateISO(dateISO);
        if (!alive) return;
        setRows(loads);
        setToast("");
      } catch (e) {
        if (!alive) return;
        setToast(`❌ ${e.message || "Error"}`);
      }
    })();
    return () => { alive = false; };
  }, [dateISO]);

  const summary = useMemo(() => {
    const map = new Map();
    for (const m of rows) {
      const key = `${m.containerNo || "—"}|${m.pg || ""}|${m.client || ""}`;
      const cur = map.get(key) || { containerNo: m.containerNo || "—", pg: m.pg || "", client: m.client || "", pallets: 0 };
      cur.pallets += 1;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.pallets - a.pallets);
  }, [rows]);

  return (
    <div className="container">
      <div className="h1">Resumen del día</div>

      <div className="card" style={{ marginTop: 10 }}>
        <div style={{ fontWeight: 1000 }}>Fecha</div>
        <input className="input" type="date" value={dateISO} onChange={(e) => setDateISO(e.target.value)} style={{ marginTop: 8 }} />
      </div>

      <div className="kpis" style={{ marginTop: 10 }}>
        <div className="kpi"><div className="v">{summary.length}</div><div className="l">Contenedores</div></div>
        <div className="kpi"><div className="v">{rows.length}</div><div className="l">Pallets cargados</div></div>
      </div>

      <div className="card" style={{ marginTop: 10 }}>
        <div style={{ fontWeight: 1000 }}>Por contenedor / PG</div>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
          {summary.length === 0 && <div className="muted">— sin cargas —</div>}
          {summary.map((s) => (
            <div key={`${s.containerNo}|${s.pg}|${s.client}`} className="pill" style={{ textAlign: "left" }}>
              <b>{s.containerNo}</b>{s.pg ? ` | ${s.pg}` : ""}{s.client ? ` | ${s.client}` : ""}
              <div className="muted" style={{ marginTop: 4 }}>Pallets: <b>{s.pallets}</b></div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: 10 }}>
        <div style={{ fontWeight: 1000 }}>Detalle (últimos)</div>
        <div style={{ marginTop: 8, maxHeight: 260, overflow: "auto" }}>
          {rows
            .slice()
            .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
            .slice(0, 60)
            .map((m) => (
              <div key={m.id} className="muted" style={{ padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
                <b>{m.palletId}</b> — {m.containerNo || "—"}{m.pg ? ` | ${m.pg}` : ""} — {String(m.timestamp || "").slice(11, 19)}
              </div>
            ))}
          {rows.length === 0 && <div className="muted">—</div>}
        </div>
      </div>

      <Toast text={toast} />
    </div>
  );
}
