export default function ScanHint({ title, subtitle }) {
  return (
    <div className="card">
      <div style={{ fontWeight: 1000 }}>{title}</div>
      <div className="muted" style={{ marginTop: 6 }}>
        {subtitle || "Escanee con el lector Bluetooth (HID). Recomendado: sufijo ENTER."}
      </div>
    </div>
  );
}
