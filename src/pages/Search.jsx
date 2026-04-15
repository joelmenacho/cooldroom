import { useState } from "react";
import { quickSearch } from "../services/inventory.js";
import { parseLocationId } from "../utils/parseLocationId.js";

export default function Search() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState("");

  async function run() {
    setMsg("");
    const res = await quickSearch(q);
    setRows(res);
    if (res.length === 0) setMsg("Sin resultados");
  }

  return (
    <div className="container">
      <div className="h1">Buscar</div>

      <div className="grid">
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ID pallet o texto en producto/variedad" />
        <button className="btn btnPrimary" onClick={run}>Buscar</button>
      </div>

      {msg ? <div className="toast">{msg}</div> : null}

      <div className="grid" style={{ marginTop: 10 }}>
        {rows.map((p) => {
          const loc = p.locationId ? parseLocationId(p.locationId) : null;
          return (
            <div key={p.id} className="card">
              <div style={{ fontWeight: 1000 }}>{p.id}</div>
              <div className="muted" style={{ marginTop: 4 }}>
                {p.productName}{p.variety ? ` - ${p.variety}` : ""} · Estado: {p.status}
              </div>
              <div style={{ marginTop: 6 }}>
                <b>Ubicación:</b> {p.locationId || "—"}
                {loc ? <span className="muted"> (Piso {loc.floor} {loc.side === "L" ? "Izq" : "Der"}, {loc.row}{String(loc.slot).padStart(2, "0")})</span> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
