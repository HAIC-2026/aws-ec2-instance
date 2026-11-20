/* AllReady — train the 7-day warning outlook. MIT licensed. No dependencies: node scripts/train-outlook.mjs

   What it learns: for each county and day, how likely the National Weather Service is to have a
   given warning in force, judged only from that day's weather forecast and the rain before it.

   Labels  — every NWS Honolulu watch and warning since 2022, from the Iowa Environmental Mesonet
             VTEC archive (public). A county-day is positive if the product was in force in any
             of that county's zones at any time that HST day.
               wildfire : Red Flag Warning (FW.W)
               flood    : Flood Watch (FA.A) or Flash Flood Warning (FF.W)
               wind     : High Wind Warning (HW.W)
   Features — Open-Meteo's archive of the forecasts that were actually issued (historical-forecast
             API), at 4–6 fixed points per county, so training sees the same kind of numbers the
             live page reads. Nothing about people goes in or comes out.
   Model   — L2-regularised logistic regression, one per hazard, county as a categorical input.
             Chosen because every weight can be read and argued with, and it gives probabilities.
   Check   — fitted on 2022–2024, judged on 2025 to the latest complete day it has never seen.
             Regularisation strength is picked on 2024 with 2022–2023 as training. */

import { writeFile } from "node:fs/promises";
import { featureRow, FEATURES } from "../src/outlook.js"; // the exact inputs the browser computes

const OUT = new URL("../public/data/outlook-model.json", import.meta.url);
const START = "2022-01-01", TRAIN_END = "2024-12-31", VAL_START = "2024-01-01";
const END = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10); // last complete day

export const POINTS = {
  "15003": [[21.31, -157.86], [21.44, -158.18], [21.41, -157.80], [21.50, -158.02], [21.65, -158.06]],
  "15009": [[20.89, -156.47], [20.88, -156.68], [20.79, -156.33], [20.76, -156.00], [21.09, -157.02], [20.83, -156.92]],
  "15001": [[19.72, -155.08], [19.64, -155.99], [20.02, -155.67], [19.20, -155.48], [20.24, -155.83], [19.49, -154.95]],
  "15007": [[21.98, -159.37], [21.96, -159.67], [22.20, -159.50], [22.07, -159.32]],
};
const COUNTIES = Object.keys(POINTS);
const DAILY = ["temperature_2m_max", "precipitation_sum", "precipitation_hours", "wind_speed_10m_max", "wind_gusts_10m_max", "relative_humidity_2m_min", "vapour_pressure_deficit_max"];

/* NWS Honolulu zone → county. The archive mixes numbering schemes: public zones 001–028 (old) and
   001–054 (current), fire-weather zones 201–228 (through 2023, the old public zones + 200, checked
   against the 7 Aug 2023 Red Flag Warning text) and 301–343 (from 2024). The ranges cover all. */
function ugcCounty(u) {
  if (/^HIC/.test(u)) return { HIC001: "15001", HIC003: "15003", HIC005: "15009", HIC007: "15007", HIC009: "15009" }[u] || null;
  const n = +u.slice(3);
  const m = n >= 200 && n < 300 ? n - 200 : n;
  if ((m >= 1 && m <= 4) || (m >= 29 && m <= 31) || (m >= 301 && m <= 306)) return "15007";
  if ((m >= 5 && m <= 11) || (m >= 32 && m <= 36) || (m >= 307 && m <= 316)) return "15003";
  if ((m >= 12 && m <= 22) || (m >= 37 && m <= 50) || (m >= 317 && m <= 335)) return "15009";
  if ((m >= 23 && m <= 28) || (m >= 51 && m <= 54) || (m >= 336 && m <= 343)) return "15001";
  return null;
}
const TARGETS = {
  wildfire: { label: "Red Flag Warning", match: (p, s) => p === "FW" && s === "W" },
  flood: { label: "Flood Watch or Flash Flood Warning", match: (p, s) => (p === "FA" && s === "A") || (p === "FF" && s === "W") },
  wind: { label: "High Wind Warning", match: (p, s) => p === "HW" && s === "W" },
};

const hstDay = (iso) => new Date(Date.parse(iso) - 10 * 36e5).toISOString().slice(0, 10);
const addDays = (d, n) => new Date(Date.parse(d + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);

// Responses are cached on disk (git-ignored) so a re-run does not hit the free tiers again.
const CACHE = new URL("../.cache/outlook/", import.meta.url);
async function getJSON(url, tries = 6) {
  const { createHash } = await import("node:crypto"), { readFile, mkdir } = await import("node:fs/promises");
  const f = new URL(createHash("sha1").update(url).digest("hex") + ".json", CACHE);
  try { return JSON.parse(await readFile(f, "utf8")); } catch {}
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "AllReady outlook trainer (public data)" } });
      if (r.status === 429 && i < tries) { process.stdout.write("(rate limit, waiting) "); await new Promise((s) => setTimeout(s, 65000)); continue; }
      if (!r.ok) throw new Error(r.status + " " + url);
      const j = await r.json(); await mkdir(CACHE, { recursive: true }); await writeFile(f, JSON.stringify(j)); return j;
    } catch (e) { if (i >= tries) throw e; await new Promise((s) => setTimeout(s, 1500 * (i + 1))); }
  }
}

/* ---------- labels ---------- */
async function labels() {
  const pos = { wildfire: new Set(), flood: new Set(), wind: new Set() }; // "fips|day"
  const counts = { wildfire: 0, flood: 0, wind: 0 }, unmapped = new Set();
  for (let y = +START.slice(0, 4); y <= +END.slice(0, 4); y++) {
    const { events } = await getJSON(`https://mesonet.agron.iastate.edu/json/vtec_events_bywfo.py?wfo=HFO&year=${y}`);
    for (const e of events) {
      for (const [k, t] of Object.entries(TARGETS)) {
        if (!t.match(e.phenomena, e.significance)) continue;
        const c = ugcCounty(e.ugc); if (!c) { unmapped.add(e.ugc); continue; }
        const a = hstDay(e.issue || e.product_issued), b = hstDay(e.expire || e.init_expired || e.issue);
        counts[k]++;
        for (let d = a; d <= b && d <= END; d = addDays(d, 1)) pos[k].add(c + "|" + d);
      }
    }
    process.stdout.write(`labels ${y} `);
  }
  console.log(unmapped.size ? "unmapped zones: " + [...unmapped].join(" ") : "every zone mapped to a county");
  return { pos, counts };
}

/* ---------- features ---------- */
async function weather() {
  const all = {}; // fips -> day -> [per point {..}]
  for (const c of COUNTIES) {
    const pts = POINTS[c]; all[c] = {};
    for (let y = +START.slice(0, 4); y <= +END.slice(0, 4); y++) {
      const s = `${y}-01-01` < START ? START : `${y}-01-01`, e = `${y}-12-31` > END ? END : `${y}-12-31`;
      const url = "https://historical-forecast-api.open-meteo.com/v1/forecast?timezone=Pacific%2FHonolulu&wind_speed_unit=kmh"
        + `&latitude=${pts.map((p) => p[0])}&longitude=${pts.map((p) => p[1])}&start_date=${s}&end_date=${e}&daily=${DAILY}`;
      let j = await getJSON(url); if (!Array.isArray(j)) j = [j];
      j.forEach((loc) => loc.daily.time.forEach((d, i) => {
        (all[c][d] ||= []).push(Object.fromEntries(DAILY.map((v) => [v, loc.daily[v][i]])));
      }));
      process.stdout.write(`${c}:${y} `);
    }
  }
  console.log();
  return all;
}

/* ---------- logistic regression ---------- */
const sig = (z) => 1 / (1 + Math.exp(-z));
function fit(X, y, lambda, iters = 3000) {
  const n = X.length, d = X[0].length; let w = new Array(d).fill(0), b = Math.log((y.reduce((s, v) => s + v, 0) + 1) / (n - y.reduce((s, v) => s + v, 0) + 1));
  // Adam on full batch: small, deterministic, no dependencies
  const m = new Array(d + 1).fill(0), v = new Array(d + 1).fill(0), lr = 0.05, b1 = 0.9, b2 = 0.999;
  for (let t = 1; t <= iters; t++) {
    const g = new Array(d + 1).fill(0);
    for (let i = 0; i < n; i++) { const e = sig(b + X[i].reduce((s, x, j) => s + x * w[j], 0)) - y[i]; for (let j = 0; j < d; j++) g[j] += e * X[i][j]; g[d] += e; }
    for (let j = 0; j < d; j++) g[j] = g[j] / n + lambda * w[j]; g[d] /= n;
    for (let j = 0; j <= d; j++) { m[j] = b1 * m[j] + (1 - b1) * g[j]; v[j] = b2 * v[j] + (1 - b2) * g[j] ** 2; const st = (lr * (m[j] / (1 - b1 ** t))) / (Math.sqrt(v[j] / (1 - b2 ** t)) + 1e-8); if (j < d) w[j] -= st; else b -= st; }
  }
  return { w, b };
}
const predict = (M, x) => sig(M.b + x.reduce((s, v, j) => s + v * M.w[j], 0));
const logloss = (p, y) => -y.reduce((s, v, i) => s + (v ? Math.log(Math.max(p[i], 1e-9)) : Math.log(Math.max(1 - p[i], 1e-9))), 0) / y.length;
const brier = (p, y) => p.reduce((s, v, i) => s + (v - y[i]) ** 2, 0) / y.length;
function auc(p, y) {
  const idx = p.map((v, i) => [v, y[i]]).sort((a, b) => a[0] - b[0]);
  let rank = 0, sumPos = 0, nPos = 0;
  for (let i = 0; i < idx.length; ) { let j = i; while (j < idx.length && idx[j][0] === idx[i][0]) j++; const r = (i + 1 + j) / 2; for (let k = i; k < j; k++) if (idx[k][1]) { sumPos += r; nPos++; } i = j; rank = j; }
  const nNeg = idx.length - nPos; return nPos && nNeg ? (sumPos - (nPos * (nPos + 1)) / 2) / (nPos * nNeg) : null;
}

/* ---------- main ---------- */
const { pos, counts } = await labels();
const wx = await weather();
const rows = [];
for (const c of COUNTIES) for (let d = addDays(START, 14); d <= END; d = addDays(d, 1)) {
  const f = featureRow(d, (k) => wx[c][k]); if (!f) continue;
  rows.push({ c, d, f, y: Object.fromEntries(Object.keys(TARGETS).map((k) => [k, pos[k].has(c + "|" + d) ? 1 : 0])) });
}
const keys = FEATURES.map(([k]) => k);
const tr = rows.filter((r) => r.d <= TRAIN_END), te = rows.filter((r) => r.d > TRAIN_END);
const stats = keys.map((k) => { const v = tr.map((r) => r.f[k]), m = v.reduce((s, x) => s + x, 0) / v.length; return { k, mean: m, sd: Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / v.length) || 1 }; });
const CDUM = COUNTIES.slice(1); // Honolulu is the reference county
const vec = (r) => [...stats.map((s) => (r.f[s.k] - s.mean) / s.sd), ...CDUM.map((c) => (r.c === c ? 1 : 0))];

const models = {};
for (const [k, t] of Object.entries(TARGETS)) {
  // pick lambda on 2024 with 2022–2023 as training
  const a = tr.filter((r) => r.d < VAL_START), v = tr.filter((r) => r.d >= VAL_START);
  let best = null;
  for (const lambda of [0.0003, 0.003, 0.03, 0.3]) {
    const M = fit(a.map(vec), a.map((r) => r.y[k]), lambda, 1500);
    const ll = logloss(v.map((r) => predict(M, vec(r))), v.map((r) => r.y[k]));
    if (process.env.DEBUG) console.log(k, lambda, "val logloss", ll.toFixed(5), "val auc", auc(v.map((r) => predict(M, vec(r))), v.map((r) => r.y[k]))?.toFixed(3), "val events", v.reduce((s, r) => s + r.y[k], 0));
    if (!best || ll < best.ll) best = { lambda, ll };
  }
  const M = fit(tr.map(vec), tr.map((r) => r.y[k]), best.lambda);
  const p = te.map((r) => predict(M, vec(r))), y = te.map((r) => r.y[k]);
  const base = tr.reduce((s, r) => s + r.y[k], 0) / tr.length;
  const bClim = brier(p.map(() => base), y), bMod = brier(p, y);
  // Levels are relative to an ordinary day, because Red Flag and High Wind days are rare (about
  // 1 day in 100) and a calibrated probability for them rarely reaches double digits.
  // "Elevated" = higher than on 90% of training days; "High" = higher than on 98% of them.
  const trP = tr.map((r) => predict(M, vec(r))).sort((a, b) => a - b), q = (f) => trP[Math.min(trP.length - 1, Math.floor(f * trP.length))];
  const ELEV = q(0.9), HIGH = q(0.98);
  const flaggedHigh = p.filter((x) => x >= HIGH).length, hitsHigh = p.filter((x, i) => x >= HIGH && y[i]).length;
  const events = y.reduce((s, v) => s + v, 0), caught = p.filter((x, i) => x >= ELEV && y[i]).length;
  // reliability: five bins of predicted probability
  const bins = [[0, 0.05], [0.05, 0.1], [0.1, 0.3], [0.3, 0.6], [0.6, 1.01]].map(([lo, hi]) => {
    const ix = p.map((x, i) => (x >= lo && x < hi ? i : -1)).filter((i) => i >= 0);
    return { lo, hi: Math.min(hi, 1), n: ix.length, predicted: ix.length ? ix.reduce((s, i) => s + p[i], 0) / ix.length : null, observed: ix.length ? ix.reduce((s, i) => s + y[i], 0) / ix.length : null };
  });
  const coef = keys.map((kk, j) => ({ k: kk, w: +M.w[j].toFixed(4) }));
  models[k] = {
    label: t.label, lambda: best.lambda, thresholds: { elevated: +ELEV.toFixed(4), high: +HIGH.toFixed(4) }, intercept: +M.b.toFixed(4), coef,
    county: Object.fromEntries(CDUM.map((c, j) => [c, +M.w[keys.length + j].toFixed(4)])),
    trainBaseRate: +base.toFixed(4),
    test: {
      days: y.length, events, auc: +(auc(p, y) ?? 0).toFixed(3), brier: +bMod.toFixed(4), brierClimatology: +bClim.toFixed(4),
      skill: +(1 - bMod / bClim).toFixed(3), flaggedHigh, hitsHigh, caughtElevated: caught, bins,
    },
    drivers: coef.slice().sort((x, z) => Math.abs(z.w) - Math.abs(x.w)).slice(0, 4).map((x) => ({ k: x.k, dir: x.w > 0 ? "up" : "down" })),
  };
  console.log(k, `λ=${best.lambda}`, "test AUC", models[k].test.auc, "skill", models[k].test.skill, "events", events, "caught≥elev", caught, "flagged high", flaggedHigh, "hits", hitsHigh, "th", ELEV.toFixed(3), HIGH.toFixed(3));
}

const out = {
  generated: new Date().toISOString().slice(0, 10),
  method: "L2-regularised logistic regression per hazard; inputs standardised with training means; county as indicator (Honolulu reference).",
  train: { from: addDays(START, 14), to: TRAIN_END, rows: tr.length }, test: { from: addDays(TRAIN_END, 1), to: END, rows: te.length },
  sources: [
    { n: "NWS Honolulu watches and warnings (VTEC), via Iowa Environmental Mesonet", url: "https://mesonet.agron.iastate.edu/vtec/", products: counts },
    { n: "Open-Meteo historical forecast archive", url: "https://open-meteo.com/en/docs/historical-forecast-api" },
  ],
  points: POINTS, features: FEATURES.map(([k, n], j) => ({ k, n, mean: +stats[j].mean.toFixed(5), sd: +stats[j].sd.toFixed(5) })), models,
};
await writeFile(OUT, JSON.stringify(out, null, 1) + "\n");
console.log("wrote", OUT.pathname);
