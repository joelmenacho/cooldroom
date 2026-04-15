import { useEffect, useState } from "react";
import { useScanQueue } from "../hooks/useScanQueue.js";
import { palletCodeIsValid } from "../utils/validate.js";
import { okFeedback, errorFeedback } from "../utils/feedback.js";
import { assignFIFO, previewNextFree } from "../services/inventory.js";
import Toast from "../components/Toast.jsx";
import ScanHint from "../components/ScanHint.jsx";
import { useAuth } from "../auth/AuthContext.jsx";

export default function AssignFIFO() {
  const { user } = useAuth();
  const worker = user?.name || "OPERARIO";

  const [floor, setFloor] = useState(1);
  const [side, setSide] = useState("L");
  const [nextFree, setNextFree] = useState(null);
  const [toast, setToast] = useState("");

  async function refreshNext() {
    const loc = await previewNextFree({ floor, side });
    setNextFree(loc?.id || null);
  }
  useEffect(() => {
    refreshNext();
  }, [floor, side]);

  const { isProcessing } = useScanQueue({
    validate: palletCodeIsValid,
    onScanAsync: async (palletId) => {
      try {
        setToast("");
        const { assignedLocationId } = await assignFIFO({ palletId, floor, side, worker, shift: "DAY" });
        okFeedback();
        setToast(`✅ ${palletId} → ${assignedLocationId}`);
        await refreshNext();
      } catch (e) {
        errorFeedback();
        setToast(`❌ ${e.message || "Error"}`);
      }
    },
  });

  return (
    <div className="container">
      <div className="h1">Asignación FIFO</div>

      <ScanHint
        title="Escanee el pallet y se asigna automáticamente"
        subtitle="Seleccione Piso y Lado. La app asigna el primer espacio libre (FIFO) y evita doble-scan (cola segura)."
      />

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

      <div className="card" style={{ marginTop: 10 }}>
        <div className="row">
          <div>
            <div style={{ fontWeight: 1000 }}>Siguiente libre (FIFO):</div>
            <div style={{ fontSize: 24, fontWeight: 1000, marginTop: 6 }}>{nextFree || "Zona llena"}</div>
          </div>
          <div className="pill">Operario: {worker}</div>
        </div>

        <div className="muted" style={{ marginTop: 6 }}>
          Estado: {isProcessing ? "Procesando…" : "Listo para escanear"}
        </div>
      </div>

      <Toast text={toast} />
    </div>
  );
}
