/* AllReady — small ArcGIS REST query helper for the feeds we know by name. MIT licensed.
   src/arcgis.js handles arbitrary user-pasted services (it has to introspect first).
   This file is for the handful of services AllReady ships with: we already know the layer,
   the fields and the geometry, so we can go straight to /query and keep the code short.
   Everything here is a public, no-key, read-only GET. */

import { fetchT } from "./net.js";

const enc = encodeURIComponent;

/** One page of an ArcGIS feature layer, as Esri JSON (attributes + geometry in WGS84). */
async function page(url, { where = "1=1", fields = "*", geometry = true, offset = 0, count = 2000, signal, extra = "" } = {}) {
  const q = `${url}/query?where=${enc(where)}&outFields=${enc(fields)}&returnGeometry=${geometry}&outSR=4326&f=json${extra}` +
    (offset ? `&resultOffset=${offset}` : "") + `&resultRecordCount=${count}`;
  const r = await fetchT(q, { signal }, 12000);
  if (!r.ok) throw new Error(`${url.split("/services/")[1] || url} answered ${r.status}`);
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || "query failed");
  return j;
}

/** Every record of a layer, paged. Returns plain rows: { ...attributes, _lon, _lat }. */
export async function rows(url, opts = {}) {
  const out = [];
  for (let off = 0; off < (opts.max ?? 20000); off += 2000) {
    const j = await page(url, { ...opts, offset: off, count: 2000 });
    const fs = j.features || [];
    for (const f of fs) {
      const g = f.geometry || {};
      const row = { ...f.attributes };
      if (g.x != null) { row._lon = g.x; row._lat = g.y; }
      else if (g.rings) { const c = centroid(g.rings[0]); row._lon = c[0]; row._lat = c[1]; }
      out.push(row);
    }
    if (fs.length < 2000 || !j.exceededTransferLimit) break;
  }
  return out;
}

/** Polygon features as GeoJSON, for layers we draw rather than tabulate. */
export async function geo(url, opts = {}) {
  const q = `${url}/query?where=${enc(opts.where || "1=1")}&outFields=${enc(opts.fields || "*")}&returnGeometry=true&outSR=4326&f=geojson` +
    `&maxAllowableOffset=${opts.simplify ?? 0.0003}&geometryPrecision=5&resultRecordCount=${opts.count || 2000}`;
  const r = await fetchT(q, {}, 30000);
  if (!r.ok) throw new Error(`service answered ${r.status}`);
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || "query failed");
  return j;
}

function centroid(ring) {
  let x = 0, y = 0;
  for (const p of ring) { x += p[0]; y += p[1]; }
  return [x / ring.length, y / ring.length];
}

/* ---- small parsers shared by the feed normalizers ----
   County data is hand-maintained, so every one of these fields arrives dirty:
   blanks, " ", "None", "N/A", "yes with container", capacity as "1144\r\n".
   Tri-state on purpose: false and "we were never told" are different facts, and the
   readiness scorecard reports the second one rather than guessing. */

const BLANK = /^(|\s*|none|n\/?a|null|unknown|tbd|-)$/i;

/** "Yes (Bring Crate)" -> true, "no" -> false, "" / "None" / "N/A" -> null. */
export function yn(v) {
  const s = String(v ?? "").trim();
  if (BLANK.test(s)) return null;
  if (/^(y|yes|true|1)\b/i.test(s)) return true;
  if (/^(n|no|false|0)\b/i.test(s)) return false;
  return null;
}

/** "1144\r\n" -> 1144, "" / "None" -> null. Never returns 0 for "no number given". */
export function num(v) {
  const s = String(v ?? "").trim();
  if (BLANK.test(s)) return null;
  const n = Number(s.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Trim and collapse the " " / "None" placeholders down to an empty string. */
export function str(v) {
  const s = String(v ?? "").trim().replace(/\s+/g, " ");
  return BLANK.test(s) ? "" : s;
}
