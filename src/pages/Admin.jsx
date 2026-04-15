import { useEffect, useMemo, useState } from "react";
import Toast from "../components/Toast.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { ROLE_LABEL, ROLES } from "../auth/roles.js";
import {
  adminCreateUser,
  adminResetPassword,
  adminSetUserActive,
  adminSetUserRole,
  listUsers,
} from "../auth/authService.js";

export default function Admin() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [toast, setToast] = useState("");

  const [newUser, setNewUser] = useState({ username: "", name: "", role: ROLES.VIEWER, password: "" });
  const [busy, setBusy] = useState(false);

  const roleOptions = useMemo(() => Object.values(ROLES), []);

  async function refresh() {
    const u = await listUsers();
    setRows(u);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function onCreate(e) {
    e.preventDefault();
    setToast("");
    setBusy(true);
    try {
      await adminCreateUser(newUser);
      setNewUser({ username: "", name: "", role: ROLES.VIEWER, password: "" });
      await refresh();
      setToast("✅ Usuario creado");
    } catch (err) {
      setToast(`❌ ${err?.message || "Error"}`);
    } finally {
      setBusy(false);
    }
  }

  async function setRole(id, role) {
    setToast("");
    try {
      await adminSetUserRole(id, role);
      await refresh();
      setToast("✅ Rol actualizado");
    } catch (err) {
      setToast(`❌ ${err?.message || "Error"}`);
    }
  }

  async function setActive(id, isActive) {
    setToast("");
    try {
      await adminSetUserActive(id, isActive);
      await refresh();
      setToast("✅ Estado actualizado");
    } catch (err) {
      setToast(`❌ ${err?.message || "Error"}`);
    }
  }

  async function resetPass(id) {
    const p = prompt("Nueva contraseña (mínimo 6)");
    if (!p) return;
    setToast("");
    try {
      await adminResetPassword(id, p);
      setToast("✅ Contraseña reseteada (forzará cambio)");
    } catch (err) {
      setToast(`❌ ${err?.message || "Error"}`);
    }
  }

  if (!user) return null;

  return (
    <div className="container stackLg">
      <div className="card">
        <div className="stackSm">
          <div className="eyebrow">Administración</div>
          <h1 className="pageTitle">Panel de control de usuarios</h1>
          <div className="pageSubtitle">Gestión local de perfiles, credenciales y habilitación de roles operativos.</div>
        </div>
      </div>

      <form className="card stackLg" onSubmit={onCreate}>
        <div className="cardHeader" style={{ marginBottom: 0 }}>
          <div>
            <h2 className="cardTitle">Crear usuario</h2>
            <div className="muted">Registra personal y define su rol inicial en el dispositivo actual.</div>
          </div>
        </div>

        <div className="grid grid2">
          <div>
            <div className="labelText">Usuario</div>
            <input className="input" value={newUser.username} onChange={(e) => setNewUser((s) => ({ ...s, username: e.target.value }))} placeholder="ej. operario1" />
          </div>
          <div>
            <div className="labelText">Nombre</div>
            <input className="input" value={newUser.name} onChange={(e) => setNewUser((s) => ({ ...s, name: e.target.value }))} placeholder="ej. Mariela" />
          </div>
          <div>
            <div className="labelText">Rol</div>
            <select className="input" value={newUser.role} onChange={(e) => setNewUser((s) => ({ ...s, role: e.target.value }))}>
              {roleOptions.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r] || r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="labelText">Contraseña</div>
            <input className="input" type="password" value={newUser.password} onChange={(e) => setNewUser((s) => ({ ...s, password: e.target.value }))} placeholder="mínimo 6" />
          </div>
        </div>

        <button className="btn btnPrimary" disabled={busy || !newUser.username || !newUser.name || !newUser.password} style={{ opacity: busy ? 0.7 : 1 }}>
          {busy ? "Creando usuario…" : "Crear usuario"}
        </button>
      </form>

      <div className="card stackLg">
        <div className="cardHeader" style={{ marginBottom: 0 }}>
          <div>
            <h2 className="cardTitle">Usuarios registrados</h2>
            <div className="muted">Cambios persistidos en IndexedDB del dispositivo operativo.</div>
          </div>
        </div>

        <div className="tableLike">
          {rows.map((u) => (
            <div key={u.id} className="card cardSoft">
              <div className="row rowWrap">
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18 }}>{u.name}</div>
                  <div className="muted">@{u.username}</div>
                </div>
                <div className="pill" style={{ borderColor: u.isActive === false ? "var(--danger)" : "var(--line)" }}>
                  {u.isActive === false ? "INACTIVO" : "ACTIVO"}
                </div>
              </div>

              <div className="grid grid2" style={{ marginTop: 14 }}>
                <div>
                  <div className="labelText">Rol asignado</div>
                  <select className="input" value={u.role || ROLES.VIEWER} onChange={(e) => setRole(u.id, e.target.value)}>
                    {roleOptions.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r] || r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="labelText">Acciones</div>
                  <div className="row rowWrap" style={{ gap: 10 }}>
                    <button type="button" className="btn btnGhost" style={{ width: "100%" }} onClick={() => setActive(u.id, !(u.isActive !== false))}>
                      {u.isActive === false ? "Activar usuario" : "Desactivar usuario"}
                    </button>
                    <button type="button" className="btn btnGhost" style={{ width: "100%" }} onClick={() => resetPass(u.id)}>
                      Restablecer contraseña
                    </button>
                  </div>
                </div>
              </div>

              {u.mustChangePassword ? (
                <div className="pill" style={{ marginTop: 12, borderColor: "rgba(192, 54, 68, 0.3)", background: "var(--danger-soft)" }}>
                  Cambio de contraseña obligatorio al siguiente ingreso
                </div>
              ) : null}
            </div>
          ))}

          {rows.length === 0 ? <div className="muted">No hay usuarios registrados.</div> : null}
        </div>
      </div>

      {toast ? <Toast text={toast} /> : null}
    </div>
  );
}
