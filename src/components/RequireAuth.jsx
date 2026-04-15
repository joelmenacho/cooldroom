import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";

export default function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const loc = useLocation();

  if (loading) {
    return (
      <div className="container">
        <div className="card">
          <div style={{ fontWeight: 800, fontSize: 18 }}>Cargando entorno operativo…</div>
          <div className="muted">Inicializando sesión y base de datos local del dispositivo.</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }

  return children;
}
