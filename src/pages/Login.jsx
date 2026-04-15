import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Toast from "../components/Toast.jsx";
import { useAuth } from "../auth/AuthContext.jsx";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);

  const from = useMemo(() => (loc.state && loc.state.from ? String(loc.state.from) : "/"), [loc.state]);

  async function onSubmit(e) {
    e.preventDefault();
    setToast("");
    setBusy(true);
    try {
      await login(username, password);
      nav(from, { replace: true });
    } catch (err) {
      setToast(`❌ ${err?.message || "No se pudo iniciar sesión"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container">
      <div className="authShell">
        <section className="card authAside">
          <div className="stackLg" style={{ position: "relative", zIndex: 1 }}>
            <div className="eyebrow" style={{ background: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.16)", color: "#fff" }}>
              Plataforma operativa 3P
            </div>

            <div className="stackMd">
              <h2 className="pageTitle" style={{ color: "#fff", fontSize: "clamp(2rem, 4vw, 3.2rem)" }}>
                Control serio para una operación de gran empresa.
              </h2>
              <div className="pageSubtitle" style={{ color: "rgba(255,255,255,0.78)", fontSize: "1rem" }}>
                Interfaz optimizada para cámara fría, control de calidad, despacho, trazabilidad y operación móvil.
              </div>
            </div>
          </div>

          <div className="authMetricGrid" style={{ position: "relative", zIndex: 1 }}>
            <div className="authMetric">
              <strong>504</strong>
              <span>posiciones controladas</span>
            </div>
            <div className="authMetric">
              <strong>FIFO</strong>
              <span>asignación ordenada</span>
            </div>
            <div className="authMetric">
              <strong>24/7</strong>
              <span>operación local offline</span>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="stackLg">
            <div className="stackSm">
              <div className="eyebrow">Acceso seguro</div>
              <h1 className="pageTitle">Iniciar sesión</h1>
              <div className="pageSubtitle">Accede al entorno operativo con tu perfil autorizado.</div>
            </div>

            <form className="authForm" onSubmit={onSubmit}>
              <div className="stackMd">
                <div>
                  <div className="labelText">Usuario</div>
                  <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Ej. admin" autoComplete="username" />
                </div>

                <div>
                  <div className="labelText">Contraseña</div>
                  <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
                </div>
              </div>

              <button className="btn btnPrimary" disabled={busy || !username.trim() || !password} style={{ opacity: busy ? 0.7 : 1 }}>
                {busy ? "Validando acceso…" : "Entrar al sistema"}
              </button>

              <div className="authFooter">
                <div className="muted">
                  ¿No tienes cuenta? <Link to="/register" style={{ color: "var(--primary)", fontWeight: 800 }}>Solicita tu registro</Link>
                </div>
                <div className="pill">Demo: admin / admin123</div>
              </div>
            </form>
          </div>

          {toast ? <Toast text={toast} /> : null}
        </section>
      </div>
    </div>
  );
}
