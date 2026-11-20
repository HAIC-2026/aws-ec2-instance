/* AllReady — 7-day warning outlook. MIT licensed.

   A trained model (scripts/train-outlook.mjs, weights in public/data/outlook-model.json) reads
   the next seven days of forecast weather for each county and gives the chance that the National
   Weather Service will have each warning in force that day:
     wildfire → Red Flag Warning · flood → Flood Watch or Flash Flood Warning · wind → High Wind Warning
   It is a planning signal for "which county and hazard should we rehearse this week", not a
   forecast or a warning. NWS decides warnings; AllReady issues none.

   featureRow() and FEATURES are shared with the training script, so the browser computes
   exactly the inputs the model was trained on. */

const MODEL_URL = ((import.meta.env && import.meta.env.BASE_URL) || "./") + "data/outlook-model.json";
const HOSTS = ["https://api.open-meteo.com/v1/forecast", "https://historical-forecast-api.open-meteo.com/v1/forecast"];
const DAILY = ["temperature_2m_max", "precipitation_sum", "precipitation_hours", "wind_speed_10m_max", "wind_gusts_10m_max", "relative_humidity_2m_min", "vapour_pressure_deficit_max"];
const KEY = "allready.outlook.v1", TTL = 60 * 60 * 1000;

export const OUTLOOK_HAZARDS = [
  { k: "wildfire", n: "Wildfire", warn: "Red Flag Warning", plan: "wildfire" },
  { k: "flood", n: "Flood", warn: "Flood Watch or Flash Flood Warning", plan: "flood" },
  { k: "wind", n: "Wind", warn: "High Wind Warning", plan: "hurricane" },
];
export const COUNTY_NAMES = { "15003": "Honolulu", "15009": "Maui", "15001": "Hawaiʻi", "15007": "Kauaʻi" };

const addDays = (d, n) => new Date(Date.parse(d + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
const num = (v) => (v == null || Number.isNaN(+v) ? null : +v);
const vals = (a, k) => a.map((p) => num(p[k])).filter((x) => x != null);
const mx = (a, k) => { const v = vals(a, k); return v.length ? Math.max(...v) : null; };
const mn = (a, k) => { const v = vals(a, k); return v.length ? Math.min(...v) : null; };
const mean = (a, k) => { const v = vals(a, k); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };

export const FEATURES = [
  ["gust", "Strongest wind gust (km/h)"], ["wind", "Strongest sustained wind (km/h)"], ["rhmin", "Lowest humidity (%)"],
  ["vpd", "Peak vapour-pressure deficit (kPa)"], ["rain", "Wettest point's rain, log mm"], ["rainh", "Hours of rain"],
  ["rain3", "Rain over the previous 3 days, log mm"], ["dry14", "Rain over the previous 14 days, log mm"], ["tmax", "Highest temperature (°C)"],
  ["sin", "Season (sine of day of year)"], ["cos", "Season (cosine of day of year)"],
];

/** One row of model inputs for a county-day; get(day) returns that day's records at the county's points. */
export function featureRow(day, get) {
  const t = get(day); if (!t?.length) return null;
  let r3 = 0, r14 = 0;
  for (let i = 1; i <= 14; i++) { const p = get(addDays(day, -i)); if (!p) return null; const wet = mx(p, "precipitation_sum") ?? 0, avg = mean(p, "precipitation_sum") ?? 0; if (i <= 3) r3 += wet; r14 += avg; }
  const doy = (Date.parse(day + "T00:00:00Z") - Date.parse(day.slice(0, 4) + "-01-01T00:00:00Z")) / 864e5;
  const row = {
    gust: mx(t, "wind_gusts_10m_max"), wind: mx(t, "wind_speed_10m_max"), rhmin: mn(t, "relative_humidity_2m_min"),
    vpd: mx(t, "vapour_pressure_deficit_max"), rain: Math.log1p(mx(t, "precipitation_sum") ?? 0), rainh: mx(t, "precipitation_hours"),
    rain3: Math.log1p(r3), dry14: Math.log1p(r14), tmax: mx(t, "temperature_2m_max"),
    sin: Math.sin((2 * Math.PI * doy) / 365.25), cos: Math.cos((2 * Math.PI * doy) / 365.25),
  };
  return Object.values(row).some((v) => v == null || Number.isNaN(v)) ? null : row;
}

/** Plain-words reason for one input pushing the chance up. */
function reason(k, f) {
  const r = Math.round, e = (x) => r(Math.expm1(x));
  return {
    gust: `gusts to ${r(f.gust)} km/h`, wind: `winds to ${r(f.wind)} km/h`, rhmin: `humidity down to ${r(f.rhmin)}%`,
    vpd: `very dry air (VPD ${f.vpd.toFixed(1)} kPa)`, rain: `up to ${e(f.rain)} mm of rain`, rainh: `${r(f.rainh)} hours of rain`,
    rain3: `${e(f.rain3)} mm in the 3 days before`, dry14: `only ${e(f.dry14)} mm in the past 2 weeks`, tmax: `highs of ${r(f.tmax)} °C`,
    sin: "the time of year", cos: "the time of year",
  }[k];
}

export function score(model, fips, f) {
  const z = Object.fromEntries(model.features.map((s) => [s.k, (f[s.k] - s.mean) / s.sd]));
  const out = {};
  for (const hz of OUTLOOK_HAZARDS) {
    const M = model.models[hz.k]; if (!M) continue;
    const parts = M.coef.map((c) => ({ k: c.k, v: c.w * z[c.k] }));
    const logit = M.intercept + parts.reduce((s, p) => s + p.v, 0) + (M.county[fips] || 0);
    const why = parts.filter((p) => p.v > 0.15 && !(p.k === "cos" || p.k === "sin")).sort((a, b) => b.v - a.v).slice(0, 2).map((p) => reason(p.k, f));
    out[hz.k] = { p: 1 / (1 + Math.exp(-logit)), why };
  }
  return out;
}

/** "high" = higher than on 98% of 2022–2024 days, "elevated" = higher than on 90% (per hazard). */
export const level = (p, th = { elevated: 0.1, high: 0.3 }) => (p >= th.high ? "high" : p >= th.elevated ? "elevated" : "low");
export const pct = (p) => (p < 0.01 ? "<1%" : Math.round(p * 100) + "%");

let modelP = null;
export function loadModel() { return (modelP ||= fetch(MODEL_URL).then((r) => { if (!r.ok) throw new Error("outlook model " + r.status); return r.json(); })); }

async function fetchWeather(model) {
  const flat = Object.entries(model.points).flatMap(([c, pts]) => pts.map((p) => ({ c, p })));
  const q = `?timezone=Pacific%2FHonolulu&wind_speed_unit=kmh&past_days=15&forecast_days=7&daily=${DAILY}`
    + `&latitude=${flat.map((x) => x.p[0])}&longitude=${flat.map((x) => x.p[1])}`;
  let last;
  for (const host of HOSTS) {
    try {
      // A blocked or rate-limited host can hang rather than fail: give each one 8 seconds.
      const r = await fetch(host + q, { credentials: "omit", signal: AbortSignal.timeout(8000) }); if (!r.ok) throw new Error("open-meteo " + r.status);
      let j = await r.json(); if (!Array.isArray(j)) j = [j];
      const byC = {};
      j.forEach((loc, i) => { const c = flat[i].c; loc.daily.time.forEach((d, n) => { ((byC[c] ||= {})[d] ||= []).push(Object.fromEntries(DAILY.map((v) => [v, loc.daily[v][n]]))); }); });
      return { byC, host: new URL(host).hostname };
    } catch (e) { last = e; }
  }
  throw last;
}

/** { model, at, host, stale, days:[iso], rows:{fips:[{day, lead, f, s:{wildfire:{p,why},…}}]} } */
export async function loadOutlook({ force = false } = {}) {
  const model = await loadModel();
  let wx = null;
  try { const c = JSON.parse(localStorage.getItem(KEY)); if (c && c.v === model.generated && (!force && Date.now() - c.at < TTL)) wx = c; } catch {}
  if (!wx) {
    try { const w = await fetchWeather(model); wx = { v: model.generated, at: Date.now(), ...w }; try { localStorage.setItem(KEY, JSON.stringify(wx)); } catch {} }
    catch (e) { try { const c = JSON.parse(localStorage.getItem(KEY)); if (c?.v === model.generated) wx = { ...c, stale: true }; } catch {} if (!wx) throw e; }
  }
  const today = new Date(Date.now() - 10 * 36e5).toISOString().slice(0, 10); // HST
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const rows = {};
  for (const c of Object.keys(model.points)) {
    rows[c] = days.map((d, lead) => { const f = featureRow(d, (k) => wx.byC[c]?.[k]); return f ? { day: d, lead, f, s: score(model, c, f) } : null; }).filter(Boolean);
  }
  return { model, at: wx.at, host: wx.host, stale: !!wx.stale, days, rows };
}

/** The highest chance per county and hazard over the first `n` days. */
export function peaks(o, n = 3) {
  const out = [];
  for (const [c, list] of Object.entries(o.rows)) for (const hz of OUTLOOK_HAZARDS) {
    let best = null; for (const r of list.slice(0, n)) { const x = r.s[hz.k]; if (x && (!best || x.p > best.p)) best = { ...x, day: r.day, lead: r.lead }; }
    if (best) out.push({ fips: c, county: COUNTY_NAMES[c], hz, ...best });
  }
  return out.sort((a, b) => b.p - a.p);
}

export const dayName = (d, lead) => (lead === 0 ? "Today" : lead === 1 ? "Tomorrow" : new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }) + " " + +d.slice(8));

/** Short text for the assistant: which warnings are most likely this week, per county. */
export function outlookContext(o) {
  return {
    what: "Machine-learning estimate of the chance the NWS has each warning in force, from forecast weather. Not a forecast or a warning; NWS issues warnings.",
    weatherFetched: new Date(o.at).toISOString(), stale: o.stale,
    next3Days: peaks(o, 3).slice(0, 6).map((x) => ({ county: x.county, warning: x.hz.warn, chance: pct(x.p), day: x.day, because: x.why.join("; ") })),
  };
}
