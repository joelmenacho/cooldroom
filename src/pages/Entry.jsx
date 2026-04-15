import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import { ROLES } from "../auth/roles.js";
import { useScanQueue } from "../hooks/useScanQueue.js";
import { palletCodeIsValid } from "../utils/validate.js";
import { okFeedback, errorFeedback } from "../utils/feedback.js";
import { registerPalletInAndAssign } from "../services/inventory.js";
import Toast from "../components/Toast.jsx";
import ScanHint from "../components/ScanHint.jsx";
import { db } from "../db/index.js";

const ROWS = "ABCDEFGHIJKL".split("");
const SLOTS = [1,2,3,4,5,6,7];

function locId(floor, side, row, slot) {
  return `F${floor}-${side}-${row}${String(slot).padStart(2, "0")}`;
}

export default function Entry() {
  const { user } = useAuth();
  const isAdmin = user?.role === ROLES.ADMIN;

  const [palletId, setPalletId] = useState("");
  const [productName, setProductName] = useState("");
  const [variety, setVariety] = useState("");
  const [worker, setWorker] = useState("");
  const [shift, setShift] = useState("DAY");

  useEffect(() => {
    if (!user?.name) return;
    if (!isAdmin && String(worker || "").trim() !== String(user.name).trim()) {
      setWorker(user.name);
    }
    if (!worker) setWorker(user.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin]);


  // Ubicación a seleccionar en Entrada
  const [floor, setFloor] = useState(() => Number(localStorage.getItem("cr_floor") || 1));
  const [side, setSide] = useState(() => localStorage.getItem("cr_side") || "L");
  const [locations, setLocations] = useState([]);
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [toast, setToast] = useState("");

  async function loadZone(f = floor, s = side) {
    const rows = await db.locations
      .where("floor")
      .equals(Number(f))
      .filter((l) => l.side === s)
      .toArray();
    setLocations(rows);
  }

  useEffect(() => { loadZone(); }, [floor, side]);

  useEffect(() => {
    localStorage.setItem("cr_floor", String(floor));
    localStorage.setItem("cr_side", side);
  }, [floor, side]);

  const index = useMemo(() => {
    const map = new Map();
    for (const l of locations) map.set(l.id, l);
    return map;
  }, [locations]);

  useScanQueue({
    validate: palletCodeIsValid,
    onScanAsync: async (code) => {
      setPalletId(code);
      okFeedback();
      setToast(`📥 Pallet leído: ${code}`);
    }
  });

  async function selectLocation(id) {
    const l = index.get(id);
    if (!l) return;
    if (l.occupiedBy) {
      errorFeedback();
      setToast(`❌ Ocupado: ${id} (Pallet: ${l.occupiedBy})`);
      return;
    }
    okFeedback();
    setSelectedLocationId(id);
    setToast(`📍 Ubicación seleccionada: ${id}`);
  }

  async function save() {
    try {
      setToast("");
      await registerPalletInAndAssign({
        id: palletId,
        productName,
        variety,
        worker,
        shift,
        locationId: selectedLocationId
      });

      okFeedback();
      setToast(`✅ Entrada + Ubicación OK: ${palletId} → ${selectedLocationId}`);

      // reset para el siguiente pallet
      setPalletId("");
      setProductName("");
      setVariety("");
      // mantenemos worker/turno para que no lo tenga que escribir siempre
      setSelectedLocationId("");

      await loadZone();
    } catch (e) {
      errorFeedback();
      setToast(`❌ ${e.message || "Error"}`);
    }
  }

  return (
    <div className="container">
      <div className="h1">Entrada + Ubicación</div>

      <ScanHint
        title="1) Escanee el pallet (Bluetooth)"
        subtitle="2) Seleccione Piso/Lado y toque la posición exacta (A..L / 1..7). 3) Guardar."
      />

      {/* Pallet + datos */}
      <div className="grid" style={{ marginTop: 10 }}>
        <div className="card">
          <div style={{ fontWeight: 1000 }}>Pallet</div>
          <div style={{ fontSize: 18, fontWeight: 1000, marginTop: 6 }}>{palletId || "—"}</div>
          <input
            className="input"
            value={palletId}
            onChange={(e) => setPalletId(e.target.value)}
            placeholder="ID Pallet"
            style={{ marginTop: 10 }}
          />
        </div>

        <input className="input" value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Producto (ej. Table Grapes)" />
        <input className="input" value={variety} onChange={(e) => setVariety(e.target.value)} placeholder="Variedad (opcional)" />
        <input className="input" value={worker} onChange={(e) => setWorker(e.target.value)} placeholder="Trabajador" disabled={!isAdmin} />

        <select value={shift} onChange={(e) => setShift(e.target.value)}>
          <option value="DAY">Día</option>
          <option value="NIGHT">Noche</option>
        </select>
      </div>

      {/* Selector de zona */}
      <div className="card" style={{ marginTop: 10 }}>
        <div style={{ fontWeight: 1000 }}>Seleccionar zona</div>

        <div className="grid grid2" style={{ marginTop: 10 }}>
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

        <div className="muted" style={{ marginTop: 8 }}>
          Toque la celda donde físicamente colocará el pallet. Verde = libre, Rojo = ocupado.
        </div>

        {/* Grid 12×7 */}
        <div style={{ marginTop: 10, overflowX: "auto" }}>
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
                const selected = selectedLocationId === id;

                return (
                  <button
                    key={s}
                    onClick={() => selectLocation(id)}
                    style={{
                      height: 56,
                      borderRadius: 16,
                      border: selected ? "2px solid var(--primary)" : "1px solid var(--line)",
                      fontWeight: 1000,
                      background: occ ? "#ffeaea" : "#eaffea",
                      outline: "none"
                    }}
                    title={occ ? `Ocupado: ${l.occupiedBy}` : "Libre"}
                  >
                    {selected ? "📍" : (occ ? "X" : "✓")}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div style={{ marginTop: 10 }}>
          <b>Ubicación elegida:</b> {selectedLocationId || "—"}
        </div>
      </div>

      <button
        className="btn btnPrimary"
        onClick={save}
        disabled={!palletId || !productName || !worker || !selectedLocationId}
        style={{ marginTop: 10, opacity: (!palletId || !productName || !worker || !selectedLocationId) ? 0.6 : 1 }}
      >
        Guardar entrada + ubicación
      </button>

      <Toast text={toast} />
    </div>
  );
}
