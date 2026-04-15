import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../db/index.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { canAccess, ROLE_LABEL, ROLES } from "../auth/roles.js";

function ModuleLink({ to, icon, title, text }) {
  return (
    <Link className="card moduleCard" to={to}>
      <div className="moduleIcon">{icon}</div>
      <div className="stackSm">
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.03em" }}>{title}</div>
        <div className="muted">{text}</div>
      </div>
    </Link>
  );
}

export default function Home() {
  const { user } = useAuth();

  const [locations, setLocations] = useState([]);
  const [palletsIn, setPalletsIn] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const locs = await db.locations.toArray();
      const countIn = await db.pallets.where("status").anyOf(["IN", "ASSIGNED"]).count();
      if (!alive) return;
      setLocations(locs);
      setPalletsIn(countIn);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const kpis = useMemo(() => {
    const total = locations.length || 504;
    const occupied = locations.filter((l) => !!l.occupiedBy).length;
    const free = total - occupied;
    return { total, occupied, free };
  }, [locations]);

  const role = user?.role || ROLES.VIEWER;

  return (
    <div className="container stackLg">
      <section className="sectionSplit">
        <div className="card stackLg">
          <div className="stackMd">
            <div className="eyebrow">3P · operación digital</div>
            <h1 className="pageTitle">Centro operativo de cámara fría y despacho</h1>
            <div className="pageSubtitle" style={{ maxWidth: 760 }}>
              Plataforma diseñada para controlar ingreso, ubicación, validación de calidad, despacho y trazabilidad de pallets con una apariencia más ejecutiva y corporativa.
            </div>
          </div>

          <div className="kpis">
            <div className="kpi">
              <div className="v">{kpis.free}</div>
              <div className="l">Ubicaciones libres</div>
            </div>
            <div className="kpi">
              <div className="v">{kpis.occupied}</div>
              <div className="l">Ubicaciones ocupadas</div>
            </div>
            <div className="kpi">
              <div className="v">{palletsIn}</div>
              <div className="l">Pallets activos</div>
            </div>
          </div>
        </div>

        {!user ? (
          <div className="card stackLg">
            <div className="stackSm">
              <div className="eyebrow">Acceso al sistema</div>
              <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.04em" }}>Inicia sesión para operar</div>
              <div className="muted">
                El sistema gestiona perfiles por área: administración, calidad, despacho y cámara. El administrador define el nivel de acceso.
              </div>
            </div>

            <div className="grid grid2">
              <Link className="btn btnPrimary" to="/login">
                Iniciar sesión
              </Link>
              <Link className="btn btnGhost" to="/register">
                Registrar usuario
              </Link>
            </div>

            <div className="pill">Demo inicial: admin / admin123</div>
          </div>
        ) : (
          <div className="card stackMd">
            <div className="eyebrow">Sesión activa</div>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.04em" }}>Hola, {user.name}</div>
            <div className="muted">Rol operativo asignado: {ROLE_LABEL[role] || role}</div>
            <div className="pill">Uso recomendado con lector Bluetooth HID</div>
          </div>
        )}
      </section>

      {user ? (
        <section className="stackMd">
          <div className="cardHeader">
            <div>
              <h2 className="cardTitle">Módulos operativos</h2>
              <div className="muted">Accesos principales según el rol autenticado.</div>
            </div>
          </div>

          <div className="moduleGrid">
            {canAccess(role, "QUALITY") ? (
              <ModuleLink to="/quality" icon="✅" title="Calidad" text="Escaneo, muestreo, liberación y bloqueo de pallets con control de proceso y despacho." />
            ) : null}

            {canAccess(role, "DISPATCH") ? (
              <ModuleLink to="/dispatch" icon="🚚" title="Despacho" text="Activación de contenedores, validación por plan y carga controlada de pallets." />
            ) : null}

            {canAccess(role, "STORAGE") ? (
              <ModuleLink to="/camera" icon="❄" title="Cámara fría" text="Ubicación, FIFO, ingreso, salida y mapa de ocupación por posición." />
            ) : null}

            <ModuleLink to="/daily" icon="📊" title="Resumen diario" text="Consulta rápida de cargas, movimientos y actividad por fecha de operación." />
            <ModuleLink to="/export" icon="⬇" title="Exportación" text="Respaldo de datos operativos a Excel para revisión y control interno." />
            {role === ROLES.ADMIN ? (
              <ModuleLink to="/admin" icon="🛡" title="Administración" text="Gestión de usuarios, perfiles, habilitación y restablecimiento de credenciales." />
            ) : null}
          </div>
        </section>
      ) : null}

      <div className="card cardSoft">
        <div className="muted">
          Tip operativo: usa el escáner Bluetooth en modo HID con sufijo ENTER para acelerar el flujo de lectura dentro del sistema.
        </div>
      </div>
    </div>
  );
}
