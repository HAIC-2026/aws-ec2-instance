/* AllReady — live event detection. MIT licensed. Shared by the map and Insights pages.

   By default nothing on the dashboard is hypothetical. The "event" is whatever the National
   Weather Service has in force for Hawaiʻi right now, and the people at risk are the census
   tracts inside that alert's own polygons. No relevant alert → no event → no demand figures.
   A what-if scenario is still available, but only when the planner asks for one, and it is
   labelled as such everywhere.

   Only alerts that drive mass care are treated as events: hurricane / tropical storm,
   tsunami, flood and fire weather. A High Surf Advisory is real and is listed, but it does
   not open shelters. */

import { SCENARIOS } from "./scenario.js";
import { fetchT } from "./net.js";

const KIND = [
  ["hurricane", /hurricane|tropical storm|typhoon|storm surge/i],
  ["tsunami", /tsunami/i],
  ["wildfire", /red flag|fire weather|fire warning|extreme fire/i],
  ["flood", /flood/i],
];
const SEV = { Extreme: 4, Severe: 3, Moderate: 2, Minor: 1 };
const level = (name) => (/warning|emergency/i.test(name) ? 3 : /watch/i.test(name) ? 2 : 1);

/** Normalise either page's alert shape to { event, severity, area, until, geometry }. */
export const norm = (a) => (a.p ? { event: a.p.event, severity: a.p.severity, area: a.p.areaDesc || "", until: a.p.ends || a.p.expires || null, geometry: a.g || null } : a);

/**
 * The live event, or null. Picks the most serious mass-care alert in force and maps it onto
 * the matching hazard's phase: a Warning means shelters are opening; a Watch or Advisory
 * means the earlier, preparatory phase.
 */
export function liveEvent(alerts) {
  const list = (alerts || []).map(norm).map((a) => ({ a, kind: KIND.find(([, re]) => re.test(a.event || ""))?.[0] })).filter((x) => x.kind);
  if (!list.length) return null;
  list.sort((x, y) => level(y.a.event) - level(x.a.event) || (SEV[y.a.severity] || 0) - (SEV[x.a.severity] || 0));
  const top = list[0], sc = SCENARIOS[top.kind], lv = level(top.a.event);
  const open = sc.phases.findIndex((p) => p.roles.length);
  const phase = lv === 3 ? sc.phases[Math.max(0, open)] : sc.phases[Math.min(1, sc.phases.length - 1)];
  const same = list.filter((x) => x.kind === top.kind);
  return {
    hazard: top.kind, scenario: sc, phase, ramp: phase.ramp, roles: phase.roles.length ? phase.roles : null,
    alert: top.a, alerts: same.map((x) => x.a),
    label: `${top.a.event}${same.length > 1 ? ` +${same.length - 1}` : ""}`,
  };
}

function inRing(p, ring) { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const a = ring[i], b = ring[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
function inGeom(p, g) {
  if (!g) return false;
  const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
  return polys.some((poly) => inRing(p, poly[0]));
}
/** A test for "is this [lon, lat] inside any polygon of the event's alerts". */
export function insideEvent(ev) {
  const geoms = ev.alerts.map((a) => a.geometry).filter(Boolean);
  return { hasGeometry: geoms.length > 0, test: (p) => geoms.some((g) => inGeom(p, g)) };
}

/** Active Hawaiʻi alerts with polygons resolved (alerts issued by zone carry no geometry). */
export async function loadLiveAlerts() {
  const H = { headers: { Accept: "application/geo+json" } };
  const fs = (await (await fetchT("https://api.weather.gov/alerts/active?area=HI", H)).json()).features || [];
  const cache = new Map();
  const zone = async (u) => { if (!cache.has(u)) cache.set(u, fetchT(u, H).then((r) => (r.ok ? r.json() : null)).then((j) => j?.geometry || null).catch(() => null)); return cache.get(u); };
  return Promise.all(fs.map(async (f) => {
    let g = f.geometry;
    if (!g) {
      const gs = (await Promise.all((f.properties.affectedZones || []).slice(0, 45).map(zone))).filter(Boolean);
      const polys = gs.flatMap((x) => (x.type === "Polygon" ? [x.coordinates] : x.type === "MultiPolygon" ? x.coordinates : []));
      g = polys.length ? { type: "MultiPolygon", coordinates: polys } : null;
    }
    return { event: f.properties.event, severity: f.properties.severity, area: f.properties.areaDesc || "", until: f.properties.ends || f.properties.expires || null, geometry: g };
  }));
}

/* ---- supply the planner knows about but no feed publishes (cots, water, generators…) ----
   Entered by hand, stored in this browser, and always labelled "manual" wherever shown. */
const SKEY = "allready.supply.v1";
export const manualSupply = () => { try { return JSON.parse(localStorage.getItem(SKEY)) || {}; } catch { return {}; } };
export function setManualSupply(k, v) {
  const m = manualSupply();
  if (v === "" || v == null || Number.isNaN(+v)) delete m[k]; else m[k] = Math.max(0, +v);
  try { localStorage.setItem(SKEY, JSON.stringify(m)); } catch {}
}
export const stamp = (ms) => (ms ? new Date(ms).toLocaleTimeString("en-US", { timeZone: "Pacific/Honolulu", hour: "numeric", minute: "2-digit" }) + " HST" : "not read yet");
