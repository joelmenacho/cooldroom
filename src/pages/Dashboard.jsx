import { useEffect, useMemo, useState } from "react";
import { db } from "../db/index.js";
import { useScanQueue } from "../hooks/useScanQueue.js";
import { palletCodeIsValid } from "../utils/validate.js";
import { parseLocationId } from "../utils/parseLocationId.js";
import { okFeedback, errorFeedback } from "../utils/feedback.js";

const ROWS = "ABCDEFGHIJKL".split("");
const SLOTS = [1,2,3,4,5,6,7];

function locId(floor, side, row, slot) {
  return `F${floor}-${side}-${row}${String(slot).padStart(2, "0")}`;
}

export default function Dashboard() {
  const [floor, setFloor] = useState(1);
  const [side, setSide] = useState("L");
  const [locations, setLocations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState("");

  async function load(f = floor, s = side) {
    const rows = await db.locations
      .where("floor")
      .equals(Number(f))
      .filter((l) => l.side === s)
      .toArray();
    setLocations(rows);
  }

  useEffect(() => { load(); }, [floor, side]);

  const index = useMemo(() => {
    const map = new Map();
    for (const l of locations) map.set(l.id, l);
    return map;
  }, [locations]);

  const stats = useMemo(() => {
    const total = locations.length;
    const occupied = locations.filter((l) => !!l.occupiedBy).length;
    return { total, occupied, free: total - occupied };
  }, [locations]);

  async function openCell(locationId) {
    const l = index.get(locationId);
    if (!l) return;
    let pallet = null;
    if (l.occupiedBy) pallet = await db.pallets.get(l.occupiedBy);
    setSelected({ locationId: l.id, occupiedBy: l.occupiedBy, pallet });
  }

  // Scan-to-locate (escaneas pallet y te lleva a su ubicación)
  useScanQueue({
    validate: palletCodeIsValid,
    onScanAsync: async (palletId) => {
      try {
        setToast("");
        const p = await db.pallets.get(palletId);
        if (!p) throw new Error("Pallet no registrado");
        if (!p.locationId) throw new Error("Pallet sin ubicación (no asignado)");

        const info = parseLocationId(p.locationId);
        if (!info) throw new Error("Formato de ubicación inválido");

        setFloor(info.floor);
        setSide(info.side);

        // recarga esa zona y abre detalle
        setTimeout(async () => {
          await load(info.floor, info.side);
          setSelected({ locationId: p.locationId, occupiedBy: p.id, pallet: p });
        }, 30);

        okFeedback();
        setToast(`🔎 Ubicación: ${p.locationId}`);
      } catch (e) {
        errorFeedback();
        setToast(`❌ ${e.message || "Error"}`);
      }
    }
  });

  return (
    <div className="container">
      <div className="h1">Dashboard</div>

      <div className="grid grid2">
        <select value={floor} onChange={(e) => setFloor(Number(e.target.value))}>
          <option value={1}>Piso 1</option>
          <option value={2}>Piso 2</option>
          <option value={3}>Piso 3</option>
        </select>
        <select value={side} onChange={(e) => setSide(e.target.value)}>
          <option value="L">Izquierda</option>
          <option value="R">Derecha</option>
        </select>
      </div>

      <div className="kpis" style={{ marginTop: 10 }}>
        <div className="kpi"><div className="v">{stats.free}</div><div className="l">Libres</div></div>
        <div className="kpi"><div className="v">{stats.occupied}</div><div className="l">Ocupadas</div></div>
        <div className="kpi"><div className="v">{stats.total}</div><div className="l">Total zona</div></div>
      </div>

      <div className="card" style={{ marginTop: 10 }}>
        <div style={{ fontWeight: 1000 }}>Tip</div>
        <div className="muted" style={{ marginTop: 6 }}>
          Aquí también puedes escanear un pallet: la app te muestra su ubicación y abre el detalle.
        </div>
      </div>

      <div className="card" style={{ marginTop: 10, overflowX: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "56px repeat(7, 56px)", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <div></div>
          {SLOTS.map((s) => (<div key={s} style={{ textAlign: "center", fontWeight: 1000 }}>{s}</div>))}
        </div>

        {ROWS.map((r) => (
          <div key={r} style={{ display: "grid", gridTemplateColumns: "56px repeat(7, 56px)", gap: 8, alignItems: "center", marginBottom: 8 }}>
            <div style={{ height: 56, borderRadius: 16, border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 1000, background: "#fff" }}>
              {r}
            </div>
            {SLOTS.map((s) => {
              const id = locId(floor, side, r, s);
              const l = index.get(id);
              const occ = !!l?.occupiedBy;
              return (
                <button
                  key={s}
                  onClick={() => openCell(id)}
                  style={{
                    height: 56,
                    borderRadius: 16,
                    border: "1px solid var(--line)",
                    fontWeight: 1000,
                    background: occ ? "#ffeaea" : "#eaffea"
                  }}
                  title={occ ? `Ocupado: ${l.occupiedBy}` : "Libre"}
                >
                  {occ ? "X" : "✓"}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {selected ? (
        <div className="card" style={{ marginTop: 10 }}>
          <div className="row">
            <div>
              <div style={{ fontWeight: 1000, fontSize: 18 }}>{selected.locationId}</div>
              <div className="muted" style={{ marginTop: 4 }}>
                {selected.occupiedBy ? "OCUPADO" : "LIBRE"}
              </div>
            </div>
            <button className="btn btnGhost" style={{ width: "auto", padding: "10px 12px" }} onClick={() => setSelected(null)}>
              Cerrar
            </button>
          </div>

          {selected.occupiedBy ? (
            <div style={{ marginTop: 10 }}>
              <div><b>Pallet:</b> {selected.occupiedBy}</div>
              {selected.pallet ? (
                <div className="muted" style={{ marginTop: 6 }}>
                  {selected.pallet.productName}{selected.pallet.variety ? ` - ${selected.pallet.variety}` : ""}
                  {" · "}Estado: {selected.pallet.status}
                </div>
              ) : null}
            </div>
          ) : (
            <div style={{ marginTop: 10 }} className="muted">Esta posición está libre.</div>
          )}
        </div>
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}
