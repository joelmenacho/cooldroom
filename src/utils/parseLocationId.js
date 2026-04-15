export function parseLocationId(id) {
  const m = /^F(\d)-([LR])-([A-L])(\d{2})$/.exec(id);
  if (!m) return null;
  return { floor: Number(m[1]), side: m[2], row: m[3], slot: Number(m[4]) };
}
