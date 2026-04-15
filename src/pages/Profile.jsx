import { useState } from "react";
import Toast from "../components/Toast.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { ROLE_LABEL } from "../auth/roles.js";
import { changeMyPassword } from "../auth/authService.js";

export default function Profile() {
  const { user, refresh, logout } = useAuth();
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newPass2, setNewPass2] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  async function onChange(e) {
    e.preventDefault();
    setToast("");
    if (newPass !== newPass2) {
      setToast("⚠️ Las contraseñas no coinciden");
      return;
    }
    setBusy(true);
    try {
      await changeMyPassword(user.id, oldPass, newPass);
      await refresh();
      setOldPass("");
      setNewPass("");
      setNewPass2("");
      setToast("✅ Contraseña actualizada");
    } catch (err) {
      setToast(`❌ ${err?.message || "Error"}`);
    } finally {
      setBusy(false);
    }
  }

  async function onLogout() {
    await logout();
  }

  return (
    <div className="container stackLg">
      <div className="card stackMd">
        <div className="eyebrow">Perfil de usuario</div>
        <h1 className="pageTitle">Mi cuenta</h1>
        <div className="pageSubtitle">
          <b>{user.name}</b> — @{user.username} · {ROLE_LABEL[user.role] || user.role}
        </div>
      </div>

      <form className="card stackLg" onSubmit={onChange}>
        <div>
          <h2 className="cardTitle">Cambiar contraseña</h2>
          <div className="muted">Actualiza tus credenciales para mantener el acceso protegido.</div>
        </div>

        <div className="grid">
          <div>
            <div className="labelText">Contraseña actual</div>
            <input className="input" type="password" value={oldPass} onChange={(e) => setOldPass(e.target.value)} autoComplete="current-password" />
          </div>
          <div>
            <div className="labelText">Nueva contraseña</div>
            <input className="input" type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} autoComplete="new-password" />
          </div>
          <div>
            <div className="labelText">Repetir nueva contraseña</div>
            <input className="input" type="password" value={newPass2} onChange={(e) => setNewPass2(e.target.value)} autoComplete="new-password" />
          </div>
        </div>

        <button className="btn btnPrimary" disabled={busy || !oldPass || !newPass || !newPass2} style={{ opacity: busy ? 0.7 : 1 }}>
          {busy ? "Guardando cambios…" : "Guardar cambios"}
        </button>
      </form>

      {user.mustChangePassword ? (
        <div className="card alertCard">
          <div style={{ fontWeight: 800, fontSize: 18 }}>Cambio de contraseña requerido</div>
          <div className="muted">El administrador marcó tu cuenta para actualizar tu clave en el siguiente inicio de sesión.</div>
        </div>
      ) : null}

      <button className="btn btnGhost" onClick={onLogout}>Cerrar sesión</button>

      {toast ? <Toast text={toast} /> : null}
    </div>
  );
}
