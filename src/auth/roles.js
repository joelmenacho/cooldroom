export const ROLES = {
  ADMIN: "ADMIN",
  QC_PROCESS: "QC_PROCESS",
  QC_DISPATCH: "QC_DISPATCH",
  DISPATCH: "DISPATCH",
  STORAGE: "STORAGE",
  VIEWER: "VIEWER",
};

export const ROLE_LABEL = {
  [ROLES.ADMIN]: "Admin",
  [ROLES.QC_PROCESS]: "Calidad (Proceso)",
  [ROLES.QC_DISPATCH]: "Calidad (Despacho)",
  [ROLES.DISPATCH]: "Despacho",
  [ROLES.STORAGE]: "Cámara / Almacén",
  [ROLES.VIEWER]: "Lectura",
};

export function canAccess(role, area) {
  const r = String(role || ROLES.VIEWER);
  if (r === ROLES.ADMIN) return true;

  switch (area) {
    case "QUALITY_PROCESS":
      return r === ROLES.QC_PROCESS;
    case "QUALITY_DISPATCH":
      return r === ROLES.QC_DISPATCH;
    case "QUALITY":
      return r === ROLES.QC_PROCESS || r === ROLES.QC_DISPATCH;
    case "DISPATCH":
      return r === ROLES.DISPATCH;
    case "STORAGE":
      return r === ROLES.STORAGE;
    case "REPORTS":
      return true;
    default:
      return false;
  }
}
