import bcrypt from "bcryptjs";
import { db } from "../db/index.js";
import { ROLES } from "./roles.js";

const SESSION_KEY = "cr_session_token";
const SESSION_DAYS = 30;

function nowISO() {
  return new Date().toISOString();
}

function addDaysISO(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function makeToken() {
  // crypto.randomUUID está disponible en la mayoría de navegadores modernos
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function seedDefaultAdminIfEmpty() {
  const count = await db.users.count();
  if (count > 0) return;

  const passwordHash = bcrypt.hashSync("admin123", 10);
  await db.users.add({
    username: "admin",
    name: "Administrador",
    role: ROLES.ADMIN,
    isActive: true,
    passwordHash,
    mustChangePassword: true,
    createdAt: nowISO(),
  });

  await db.auditLogs.add({
    timestamp: nowISO(),
    userId: null,
    action: "SEED_ADMIN",
    meta: { username: "admin" },
  });
}

export async function registerUser({ username, name, password }) {
  const u = String(username || "").trim().toLowerCase();
  const n = String(name || "").trim();
  const p = String(password || "");

  if (!u || u.length < 3) throw new Error("Usuario mínimo 3 caracteres");
  if (!n) throw new Error("Nombre requerido");
  if (!p || p.length < 6) throw new Error("Contraseña mínimo 6 caracteres");

  const exists = await db.users.where("username").equals(u).first();
  if (exists) throw new Error("Ese usuario ya existe");

  const passwordHash = bcrypt.hashSync(p, 10);
  const id = await db.users.add({
    username: u,
    name: n,
    role: ROLES.VIEWER,
    isActive: true,
    passwordHash,
    mustChangePassword: false,
    createdAt: nowISO(),
  });

  await db.auditLogs.add({
    timestamp: nowISO(),
    userId: id,
    action: "REGISTER",
    meta: { username: u },
  });

  return id;
}

export async function loginUser({ username, password }) {
  const u = String(username || "").trim().toLowerCase();
  const p = String(password || "");

  const user = await db.users.where("username").equals(u).first();
  if (!user) throw new Error("Usuario o contraseña incorrectos");
  if (user.isActive === false) throw new Error("Usuario desactivado. Contacte al admin");

  const ok = bcrypt.compareSync(p, user.passwordHash || "");
  if (!ok) throw new Error("Usuario o contraseña incorrectos");

  const token = makeToken();
  await db.sessions.put({
    token,
    userId: user.id,
    createdAt: nowISO(),
    expiresAt: addDaysISO(SESSION_DAYS),
  });

  localStorage.setItem(SESSION_KEY, token);

  await db.auditLogs.add({
    timestamp: nowISO(),
    userId: user.id,
    action: "LOGIN",
    meta: {},
  });

  return user;
}

export async function logoutUser() {
  const token = localStorage.getItem(SESSION_KEY);
  if (token) {
    await db.sessions.delete(token);
  }
  localStorage.removeItem(SESSION_KEY);
}

export async function getCurrentUser() {
  const token = localStorage.getItem(SESSION_KEY);
  if (!token) return null;

  const session = await db.sessions.get(token);
  if (!session) return null;

  // expiración
  if (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) {
    await db.sessions.delete(token);
    localStorage.removeItem(SESSION_KEY);
    return null;
  }

  const user = await db.users.get(session.userId);
  if (!user || user.isActive === false) return null;

  return user;
}

// === Admin utilities ===
export async function listUsers() {
  const users = await db.users.toArray();
  return users.sort((a, b) => String(a.username).localeCompare(String(b.username)));
}

export async function adminCreateUser({ username, name, role, password }) {
  const u = String(username || "").trim().toLowerCase();
  const n = String(name || "").trim();
  const r = String(role || ROLES.VIEWER);
  const p = String(password || "");

  if (!u || u.length < 3) throw new Error("Usuario mínimo 3 caracteres");
  if (!n) throw new Error("Nombre requerido");
  if (!p || p.length < 6) throw new Error("Contraseña mínimo 6 caracteres");

  const exists = await db.users.where("username").equals(u).first();
  if (exists) throw new Error("Ese usuario ya existe");

  const passwordHash = bcrypt.hashSync(p, 10);
  const id = await db.users.add({
    username: u,
    name: n,
    role: r,
    isActive: true,
    passwordHash,
    mustChangePassword: true,
    createdAt: nowISO(),
  });

  await db.auditLogs.add({
    timestamp: nowISO(),
    userId: id,
    action: "ADMIN_CREATE_USER",
    meta: { username: u, role: r },
  });

  return id;
}

export async function adminSetUserRole(userId, role) {
  const id = Number(userId);
  const r = String(role || ROLES.VIEWER);
  await db.users.update(id, { role: r });
  await db.auditLogs.add({ timestamp: nowISO(), userId: id, action: "ADMIN_SET_ROLE", meta: { role: r } });
}

export async function adminSetUserActive(userId, isActive) {
  const id = Number(userId);
  await db.users.update(id, { isActive: !!isActive });
  await db.auditLogs.add({ timestamp: nowISO(), userId: id, action: "ADMIN_SET_ACTIVE", meta: { isActive: !!isActive } });
}

export async function adminResetPassword(userId, newPassword) {
  const id = Number(userId);
  const p = String(newPassword || "");
  if (!p || p.length < 6) throw new Error("Contraseña mínimo 6 caracteres");
  const passwordHash = bcrypt.hashSync(p, 10);
  await db.users.update(id, { passwordHash, mustChangePassword: true });
  await db.auditLogs.add({ timestamp: nowISO(), userId: id, action: "ADMIN_RESET_PASSWORD", meta: {} });
}

export async function changeMyPassword(userId, oldPassword, newPassword) {
  const id = Number(userId);
  const u = await db.users.get(id);
  if (!u) throw new Error("Usuario no encontrado");
  const ok = bcrypt.compareSync(String(oldPassword || ""), u.passwordHash || "");
  if (!ok) throw new Error("Contraseña actual incorrecta");
  const p = String(newPassword || "");
  if (!p || p.length < 6) throw new Error("Nueva contraseña mínimo 6 caracteres");
  const passwordHash = bcrypt.hashSync(p, 10);
  await db.users.update(id, { passwordHash, mustChangePassword: false });
  await db.auditLogs.add({ timestamp: nowISO(), userId: id, action: "CHANGE_PASSWORD", meta: {} });
}
