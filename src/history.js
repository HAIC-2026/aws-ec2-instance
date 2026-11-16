/* AllReady — history. MIT licensed.
   What makes the History timeline actually show change over time.

   Before this, replay moved the playhead but the map kept drawing "now": the alert layer only
   ever held currently-active alerts and the weather layers only current conditions.

   - Alerts: every NWS watch / warning / advisory issued for Hawaiʻi over the past year, from
     the Iowa Environmental Mesonet's VTEC archive (the standard public archive of NWS
     products). Each event has an issue and an expiry time, so "what was in force at 3 pm on
     14 March" is a filter, not a guess.
   - Weather: hourly temperature, wind, rain and cloud for the Hawaiʻi grid at any past hour,
     from Open-Meteo (forecast API for recent weeks, its ERA5-based archive beyond that).

   All public, keyless, area-level. */

const IEM = "https://mesonet.agron.iastate.edu/json/vtec_events_bystate.py?state=HI&year=";
const NWS = "https://api.weather.gov";
const HDR = { headers: { Accept: "application/geo+json" } };
const DAY = 864e5;

// VTEC significance → the severity scale the rest of the app already colours by.
const BIG = new Set(["HU", "TS", "TO", "EW", "SS"]); // hurricane, tsunami, tornado, extreme wind, storm surge
function severity(ph, sig) {
  if (sig === "W") return BIG.has(ph) ? "Extreme" : "Severe";
  if (sig === "A") return "Moderate";
  return "Minor";
}

let events = null, loading = null;
/** A year of alerts, oldest first: { t0, t1, event, severity, zones[], id }. */
export function loadAlertHistory() {
  if (events) return Promise.resolve(events);
  if (loading) return loading;
  const y = new Date().getUTCFullYear();
  loading = Promise.allSettled([y - 1, y].map((yr) => fetch(IEM + yr).then((r) => (r.ok ? r.json() : { events: [] }))))
    .then((res) => {
      const lo = Date.now() - 366 * DAY;
      events = res.flatMap((r) => (r.status === "fulfilled" ? r.value.events || [] : []))
        .map((e) => ({
          id: `${e.wfo}-${e.phenomena}-${e.significance}-${e.eventid}-${e.issue}`,
          t0: Date.parse(e.issue), t1: Date.parse(e.expire || e.init_expire),
          event: `${e.ph_name} ${e.sig_name}`, severity: severity(e.phenomena, e.significance),
          zones: String(e.locations || "").split(",").map((s) => s.replace(/\[HI\]/, "").trim()).filter(Boolean),
        }))
        .filter((e) => e.t0 && e.t1 && e.t1 >= lo)
        .sort((a, b) => a.t0 - b.t0);
      return events;
    });
  return loading;
}

export const alertsAt = (t) => (events || []).filter((e) => e.t0 <= t && e.t1 >= t);

/* Zone geometry. The archive names zones ("Big Island Southeast", "Honolulu"); api.weather.gov
   has the polygons. One listing call maps names to ids, then each polygon is fetched once,
   only when an alert that needs it comes under the playhead. */
let zoneIndex = null;
const geomCache = new Map();
async function index() {
  if (zoneIndex) return zoneIndex;
  zoneIndex = new Map();
  const lists = await Promise.allSettled(["forecast", "county"].map((t) => fetch(`${NWS}/zones?area=HI&type=${t}`, HDR).then((r) => r.json())));
  for (const l of lists) if (l.status === "fulfilled") for (const f of l.value.features || []) {
    const k = f.properties.name.toLowerCase();
    if (!zoneIndex.has(k)) zoneIndex.set(k, f.properties["@id"] || f.id);
  }
  return zoneIndex;
}
/* api.weather.gov throttles bursts, and a statewide watch names all 43 zones at once — so
   polygons are fetched through a small pool, and a failure is retried next time rather
   than cached as "this zone has no shape". */
let active = 0; const queue = [];
function pooled(fn) {
  return new Promise((res) => {
    const run = () => { active++; fn().then(res, () => res(null)).finally(() => { active--; queue.shift()?.(); }); };
    active < 4 ? run() : queue.push(run);
  });
}
async function zoneGeometry(name) {
  const idx = await index();
  const url = idx.get(name.toLowerCase());
  if (!url) return null;
  if (geomCache.has(url)) return geomCache.get(url);
  const g = await pooled(() => fetch(url, HDR).then((r) => (r.ok ? r.json() : null)).then((j) => j?.geometry || null));
  if (g) geomCache.set(url, g);
  return g;
}
/* Storm-based warnings are archived against a county ("Kahoolawe in Maui"), and the county
   zone often has no polygon. Fall back to that county's forecast zones so the warning still
   lands on the right islands instead of vanishing from the map. */
const COUNTY_ZONES = {
  maui: /maui|molokai|lanai|haleakala|kahoolawe|kipahulu/i, kauai: /kauai|niihau/i,
  honolulu: /oahu|honolulu|koolau|waianae|olomana|ewa/i, hawaii: /big island|kona|kohala/i,
};
async function geometriesFor(name) {
  const g = await zoneGeometry(name);
  if (g) return [g];
  const m = name.match(/ in (\w+)$/i), re = m && COUNTY_ZONES[m[1].toLowerCase()];
  if (!re) return [];
  const idx = await index();
  return (await Promise.all([...idx.keys()].filter((k) => re.test(k) && !/ in /.test(k)).map(zoneGeometry))).filter(Boolean);
}

/** GeoJSON for the alerts in force at time t, shaped like the live NWS layer's features. */
export async function alertsGeoJSON(t) {
  const act = alertsAt(t);
  const features = [];
  await Promise.all(act.map(async (e) => {
    const geoms = (await Promise.all(e.zones.map(geometriesFor))).flat();
    const polys = geoms.flatMap((g) => (g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : []));
    if (!polys.length) return;
    features.push({ type: "Feature", geometry: { type: "MultiPolygon", coordinates: polys },
      properties: { severity: e.severity, event: e.event, headline: `${e.event} · ${e.zones.join(", ")}`, area: e.zones.join(", "), ends: new Date(e.t1).toISOString(), desc: "" } });
  }));
  return { type: "FeatureCollection", features };
}

/* Hourly weather for the Hawaiʻi grid on one UTC day. Returns rows aligned to the grid's
   point order: [{ temperature_2m:[24], wind_speed_10m:[24], … }]. */
const wxCache = new Map();
export function weatherDay(points, vars, day) {
  const key = day;
  if (wxCache.has(key)) return wxCache.get(key);
  const old = Date.now() - Date.parse(day) > 80 * DAY;
  const host = old ? "https://archive-api.open-meteo.com/v1/archive" : "https://api.open-meteo.com/v1/forecast";
  const u = `${host}?hourly=${vars}&wind_speed_unit=kmh&timezone=GMT&start_date=${day}&end_date=${day}` +
    `&latitude=${points.map((p) => p[0])}&longitude=${points.map((p) => p[1])}`;
  const p = fetch(u).then((r) => { if (!r.ok) throw new Error("open-meteo " + r.status); return r.json(); })
    .then((j) => (Array.isArray(j) ? j : [j]).map((x) => x.hourly))
    .catch((e) => { wxCache.delete(key); throw e; });
  wxCache.set(key, p);
  return p;
}

/** Fetch every zone polygon once, in the background, so scrubbing never waits on them. */
let warm = null;
export function warmZones() {
  return (warm ||= index().then((idx) => Promise.all([...idx.keys()].map(zoneGeometry))));
}
