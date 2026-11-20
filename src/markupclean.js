/* AllReady — validation for imported map markup. MIT licensed. */

/* Imported markup is untrusted input: a file from email or a shared drive. Every item is rebuilt
   field by field from an allow-list — known kinds, finite coordinates in range, bounded text,
   colours that are colours — so a malformed or hostile file cannot break the map or carry
   anything the editor would not create itself. */
const KINDS = new Set(["icon", "circle", "line", "arrow", "path", "area"]);
export const MAX_IMPORT_BYTES = 2_000_000;
const txt = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");
const num = (v, lo, hi, d) => (Number.isFinite(+v) ? Math.min(hi, Math.max(lo, +v)) : d);
const ll = (p) => (Array.isArray(p) && Number.isFinite(+p[0]) && Number.isFinite(+p[1]) && Math.abs(+p[0]) <= 180 && Math.abs(+p[1]) <= 90 ? [+p[0], +p[1]] : null);
const iso = (v) => (v && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : undefined);
export function cleanMarkup(x, newId, icons = {}) {
  if (!x || typeof x !== "object" || !KINDS.has(x.kind)) return null;
  const o = { id: /^[\w-]{1,40}$/.test(x.id) ? x.id : newId(), kind: x.kind, title: txt(x.title, 200), notes: txt(x.notes, 2000), color: /^#[0-9a-f]{6}$/i.test(x.color) ? x.color : "#ffffff" };
  if (x.status === "reported") { o.status = "reported"; o.reportedAt = iso(x.reportedAt); } else o.status = "plan";
  o.from = iso(x.from); o.to = iso(x.to);
  if (typeof x.parent === "string" && /^[\w-]{1,40}$/.test(x.parent)) o.parent = x.parent;
  if (x.kind === "icon") {
    o.at = ll(x.at); if (!o.at) return null;
    o.icon = typeof x.icon === "string" && Object.hasOwn(icons, x.icon) ? x.icon : "note"; o.size = num(x.size, 0.6, 2.4, 1);
    const c = x.contact && typeof x.contact === "object" ? x.contact : {};
    o.contact = { name: txt(c.name, 120), role: txt(c.role, 120), phone: txt(c.phone, 40), email: txt(c.email, 160) };
  } else if (x.kind === "circle") {
    o.center = ll(x.center); if (!o.center) return null;
    o.radiusKm = num(x.radiusKm, 0.05, 500, 1); o.width = num(x.width, 1, 10, 2); o.fill = num(x.fill, 0, 0.8, 0.32);
  } else {
    o.coords = (Array.isArray(x.coords) ? x.coords.slice(0, 5000) : []).map(ll).filter(Boolean);
    if (o.coords.length < (x.kind === "area" ? 3 : 2)) return null;
    o.width = num(x.width, 1, 10, 3); if (x.kind === "area") o.fill = num(x.fill, 0, 0.8, 0.32);
  }
  for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k];
  return o;
}

