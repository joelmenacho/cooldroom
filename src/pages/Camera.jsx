import { Link } from "react-router-dom";

export default function Camera() {
  return (
    <div className="container">
      <div className="h1">Cámara Fría</div>

      <div className="grid" style={{ marginTop: 10 }}>
        <Link className="card" to="/entry">
          <div style={{ fontSize: 18, fontWeight: 1000 }}>Entrada + Ubicar</div>
          <div className="muted">Escanear pallet y tocar posición exacta</div>
        </Link>
        <Link className="card" to="/assign-fifo">
          <div style={{ fontSize: 18, fontWeight: 1000 }}>FIFO (Siguiente libre)</div>
          <div className="muted">Asignar automático por piso y lado</div>
        </Link>
        <Link className="card" to="/exit">
          <div style={{ fontSize: 18, fontWeight: 1000 }}>Salida / Liberar</div>
          <div className="muted">Escanear pallet y liberar ubicación</div>
        </Link>
        <Link className="card" to="/dashboard">
          <div style={{ fontSize: 18, fontWeight: 1000 }}>Mapa (Dashboard)</div>
          <div className="muted">Ver ocupación 12×7 por piso y lado</div>
        </Link>
      </div>
    </div>
  );
}
