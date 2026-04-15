import { useState } from "react";
import { useScanQueue } from "../hooks/useScanQueue.js";
import { palletCodeIsValid } from "../utils/validate.js";
import { okFeedback, errorFeedback } from "../utils/feedback.js";
import { releasePallet } from "../services/inventory.js";
import Toast from "../components/Toast.jsx";
import ScanHint from "../components/ScanHint.jsx";
import { useAuth } from "../auth/AuthContext.jsx";

export default function Exit() {
  const { user } = useAuth();
  const worker = user?.name || "OPERARIO";

  const [toast, setToast] = useState("");

  useScanQueue({
    validate: palletCodeIsValid,
    onScanAsync: async (palletId) => {
      try {
        setToast("");
        await releasePallet({ palletId, worker, shift: "DAY" });
        okFeedback();
        setToast(`✅ Salida OK: ${palletId}`);
      } catch (e) {
        errorFeedback();
        setToast(`❌ ${e.message || "Error"}`);
      }
    },
  });

  return (
    <div className="container">
      <div className="h1">Salida / Liberación</div>
      <ScanHint title="Escanee el pallet para liberar su ubicación" />
      <div className="muted" style={{ marginTop: 8 }}>Operario: <b>{worker}</b></div>
      <Toast text={toast} />
    </div>
  );
}
