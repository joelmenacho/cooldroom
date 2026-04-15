import { useState } from "react";
import { exportXlsxWeb } from "../services/exportExcelWeb.js";
import { okFeedback, errorFeedback } from "../utils/feedback.js";

export default function Export() {
  const [msg, setMsg] = useState("");

  async function run() {
    try {
      setMsg("");
      await exportXlsxWeb();
      okFeedback();
      setMsg("✅ Excel generado y descargado.");
    } catch (e) {
      errorFeedback();
      setMsg(`❌ ${e.message || "Error exportando"}`);
    }
  }

  return (
    <div className="container">
      <div className="h1">Exportar Excel</div>
      <div className="card">
        <div style={{ fontWeight: 1000 }}>Backup manual (.xlsx)</div>
        <div className="muted" style={{ marginTop: 6 }}>
          Hojas: Summary, Pallets, Locations, Movements.
        </div>
        <button className="btn btnPrimary" style={{ marginTop: 10 }} onClick={run}>
          Exportar XLSX
        </button>
        {msg ? <div className="toast">{msg}</div> : null}
      </div>
    </div>
  );
}
