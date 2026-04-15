import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";

export default function RequireRole({ allow = [], children }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  const role = String(user.role || "VIEWER");
  const ok = allow.includes(role);

  if (!ok) {
    return (
      <div className="container">
        <div className="card alertCard">
          <div style={{ fontWeight: 800, fontSize: 20 }}>Acceso restringido</div>
          <div className="muted" style={{ marginTop: 6 }}>
            Tu rol no cuenta con permisos para acceder a esta sección del sistema.
          </div>
        </div>
      </div>
    );
  }

  return children;
}
