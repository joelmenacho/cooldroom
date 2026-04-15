import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { ROLE_LABEL, ROLES, canAccess } from "../auth/roles.js";

function NavItem({ to, label }) {
  const loc = useLocation();
  const active = loc.pathname === to;

  return (
    <Link to={to} className={`navTab ${active ? "isActive" : ""}`}>
      {label}
    </Link>
  );
}

export default function Nav() {
  const { user, logout } = useAuth();
  const role = user?.role || ROLES.VIEWER;

  return (
    <header className="navShell">
      <div className="row rowWrap" style={{ alignItems: "center" }}>
        <Link to="/" className="brandBlock" aria-label="Inicio Coldroom">
          <div className="brandMark">❄</div>
          <div>
            <h1 className="brandTitle">Coldroom Enterprise</h1>
            <div className="brandSubtitle">Control operativo de cámara fría, calidad y despacho</div>
          </div>
        </Link>

        <div className="navMeta">
          {user ? (
            <>
              <div className="pill">{user.name}</div>
              <div className="pill">{ROLE_LABEL[role] || role}</div>
              <button className="btn btnGhost" style={{ width: "auto", minHeight: 40, padding: "8px 14px" }} onClick={() => logout()} type="button">
                Cerrar sesión
              </button>
            </>
          ) : (
            <div className="pill">Sin sesión iniciada</div>
          )}
        </div>
      </div>

      <nav className="navTabs">
        <NavItem to="/" label="Inicio" />

        {user ? (
          <>
            {canAccess(role, "QUALITY") ? <NavItem to="/quality" label="Calidad" /> : null}
            {canAccess(role, "DISPATCH") ? <NavItem to="/dispatch" label="Despacho" /> : null}
            {canAccess(role, "STORAGE") ? <NavItem to="/camera" label="Cámara" /> : null}
            <NavItem to="/daily" label="Resumen" />
            <NavItem to="/search" label="Buscar" />
            <NavItem to="/export" label="Exportar" />
            <NavItem to="/profile" label="Perfil" />
            {role === ROLES.ADMIN ? <NavItem to="/admin" label="Administración" /> : null}
          </>
        ) : (
          <>
            <NavItem to="/login" label="Iniciar sesión" />
            <NavItem to="/register" label="Registro" />
          </>
        )}
      </nav>
    </header>
  );
}
