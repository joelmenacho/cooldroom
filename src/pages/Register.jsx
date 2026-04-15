import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Toast from "../components/Toast.jsx";
import { useAuth } from "../auth/AuthContext.jsx";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();

  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setToast("");

    if (password !== password2) {
      setToast("⚠️ Las contraseñas no coinciden");
      return;
    }

    setBusy(true);
    try {
      await register({ username, name, password });
      setToast("✅ Usuario creado. Ahora inicia sesión.");
      setTimeout(() => nav("/login"), 400);
    } catch (err) {
      setToast(`❌ ${err?.message || "No se pudo registrar"}`);
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
              Alta de usuarios
            </div>

            <div className="stackMd">
              <h2 className="pageTitle" style={{ color: "#fff", fontSize: "clamp(2rem, 4vw, 3rem)" }}>
                Registro ordenado, limpio y profesional.
              </h2>
              <div className="pageSubtitle" style={{ color: "rgba(255,255,255,0.78)", fontSize: "1rem" }}>
                El administrador asignará luego el perfil operativo correspondiente: lectura, cámara, calidad o despacho.
              </div>
            </div>
          </div>

          <div className="authMetricGrid" style={{ position: "relative", zIndex: 1 }}>
            <div className="authMetric">
              <strong>Roles</strong>
              <span>accesos diferenciados</span>
            </div>
            <div className="authMetric">
              <strong>Audit</strong>
              <span>uso trazable por usuario</span>
            </div>
            <div className="authMetric">
              <strong>Secure</strong>
              <span>cambio y control de credenciales</span>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="stackLg">
            <div className="stackSm">
              <div className="eyebrow">Nuevo usuario</div>
              <h1 className="pageTitle">Registro de cuenta</h1>
              <div className="pageSubtitle">Completa tus datos para que el administrador habilite tu operación dentro del sistema.</div>
            </div>

            <form className="authForm" onSubmit={onSubmit}>
              <div className="grid grid2">
                <div>
                  <div className="labelText">Usuario</div>
                  <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Ej. jmal" autoComplete="username" />
                </div>
                <div>
                  <div className="labelText">Nombre completo</div>
                  <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Joel Menacho" autoComplete="name" />
                </div>
                <div>
                  <div className="labelText">Contraseña</div>
                  <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" autoComplete="new-password" />
                </div>
                <div>
                  <div className="labelText">Repetir contraseña</div>
                  <input className="input" type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="Confirma tu contraseña" autoComplete="new-password" />
                </div>
              </div>

              <button className="btn btnPrimary" disabled={busy || !username.trim() || !name.trim() || !password || !password2} style={{ opacity: busy ? 0.7 : 1 }}>
                {busy ? "Creando cuenta…" : "Crear cuenta"}
              </button>

              <div className="authFooter">
                <div className="muted">
                  ¿Ya tienes cuenta? <Link to="/login" style={{ color: "var(--primary)", fontWeight: 800 }}>Ingresar al sistema</Link>
                </div>
                <div className="pill">Rol inicial: Lectura</div>
              </div>
            </form>
          </div>

          {toast ? <Toast text={toast} /> : null}
        </section>
      </div>
    </div>
  );
}
