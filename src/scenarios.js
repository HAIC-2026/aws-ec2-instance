/* AllReady — scenario planner. MIT licensed.

   The live map answers "what is happening now". This page answers the planning question DHS
   asked: before anything happens, for each county and each hazard, who lives where the hazard
   reaches, what will they need, what do the county's records and partners cover, and who
   decides what, when.

   Every number is computed here from public feeds and the published hazard zones. The page
   never shows a figure it cannot trace: a supply line with no published source is marked
   "ask" and names the organisation that holds the answer. */

import "./site.css";
import { mountTopBar } from "./nav.js";
import { fetchSVI, rankTracts } from "./svi.js";
import { loadShelters } from "./shelters.js";
import { loadEmpower } from "./empower.js";
import { plan, supply, FACTORS, SHELTER_RANGE, HAZARDS } from "./model.js";
import { SCENARIOS, OWNERS, fmtOffset } from "./scenario.js";
import { loadExposure, zoneArea, share, COUNTY_LIST, ZONES } from "./exposure.js";
import { backtest } from "./backtest.js";
import { who, pledgedSupply, csvCell } from "./match.js";
import { createAssistant } from "./assistant.js";
import { loadLiveAlerts, liveEvent, stamp } from "./live.js";

const $ = (id) => document.getElementById(id);
function h(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = v;
    else if (k === "style") n.setAttribute("style", v);
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(String(c)));
  return n;
}
const fmt = (n) => (n == null || Number.isNaN(n) ? "–" : Math.round(n).toLocaleString("en-US"));
const pct = (x, d = 0) => (x == null ? "–" : (x * 100).toFixed(d) + "%");

mountTopBar($("top"), "scenarios", "ESF-6 planning");

/* ---------------- state ---------------- */
const KEY = "allready.scenario.v1";
const qs = new URLSearchParams(location.search);
const saved = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })();
const S = {
  county: qs.get("county") || saved.county || "15009",
  hazard: qs.get("hazard") || saved.hazard || "wildfire",
  intensity: saved.intensity || "standard",
  over: saved.over || {}, // custom slider values for the current hazard
  days: saved.days || 7,
};
if (!SCENARIOS[S.hazard]) S.hazard = "wildfire";
if (S.county !== "state" && !COUNTY_LIST.some((c) => c.fips === S.county)) S.county = "15009";
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} };

const D = { tracts: [], shelters: [], emp: null, exp: null, observed: {}, live: null };
const HZ = Object.fromEntries(HAZARDS.map((x) => [x.k, x]));
const hzColor = (k) => `var(--h-${k})`;
const countyName = (f) => (f === "state" ? "All of Hawaiʻi" : COUNTY_LIST.find((c) => c.fips === f)?.long || f);

/* ---------------- intensity presets ---------------- */
const INTENSITY = [
  ["near", "Near miss", "Calibrated to turnout counted in a past Hawaiʻi event"],
  ["standard", "Planning standard", "The documented planning factors"],
  ["high", "Worst case", `Standard × ${SHELTER_RANGE.high}: the top of the planning range`],
  ["custom", "Custom", "Your own slider settings"],
];
/** Rates for a hazard at an intensity: { evac, pub, up, note, ok } */
function ratesFor(hazard, intensity) {
  const evac = FACTORS.evac[hazard].v, pub = FACTORS.publicShelter[hazard].v, up = FACTORS.afnUplift.v;
  if (intensity === "near") {
    const o = D.observed[hazard];
    if (!o) return { evac, pub, up, ok: false, note: "No sourced past shelter count for this hazard yet, so planning standard is shown." };
    return { evac, pub: Math.min(1, o.rate / evac), up, ok: true, note: `Calibrated to ${o.label}: ${pct(o.rate, 2)} of residents in the area reached a public shelter.` };
  }
  if (intensity === "high") return { evac, pub: Math.min(1, pub * SHELTER_RANGE.high), up, ok: true, note: `Public-shelter share doubled to ${pct(Math.min(1, pub * SHELTER_RANGE.high))} of evacuees.` };
  if (intensity === "custom" && hazard === S.hazard) return { evac: S.over.evac ?? evac, pub: S.over.pub ?? pub, up: S.over.up ?? up, ok: true, note: "Custom assumptions set on this page." };
  return { evac, pub, up, ok: true, note: "Documented planning factors (see Data & method)." };
}

/* ---------------- computation ---------------- */
function compute(county, hazard, intensity) {
  const fips = county === "state" ? null : county;
  const area = zoneArea(D.tracts, D.exp, hazard, fips);
  const r = ratesFor(hazard, intensity);
  const p = plan({ hazard, area, emp: D.emp, shelters: D.shelters, fipsFilter: fips ? [fips] : null, over: { evac: r.evac, pub: r.pub, up: r.up } });
  // Residents with each barrier who live in the zone (before anyone moves)
  let dmeZone = 0, dialZone = 0, o2Zone = 0;
  for (const f of area.fips) { const c = D.emp?.byFips?.[f]; if (!c) continue; const k = area.countyFrac[f] || 0; dmeZone += c.dme * k; dialZone += c.dialysis * k; o2Zone += c.oxygen * k; }
  return { area, rates: r, plan: p, zone: { pop: area.pop, dis: area.dis, lep: area.lep, nov: area.nov, a65: area.a65, a17: area.a17, dme: dmeZone, dialysis: dialZone, oxygen: o2Zone } };
}

/* ---------------- controls ---------------- */
function renderIntensity() {
  const sel = $("intensity"); sel.textContent = "";
  for (const [k, n, tip] of INTENSITY) {
    if (k === "custom" && S.intensity !== "custom") continue;
    const o = h("option", { value: k, title: tip }, n); sel.append(o);
  }
  sel.value = S.intensity;
  sel.onchange = () => { S.intensity = sel.value; if (S.intensity !== "custom") S.over = {}; save(); render(); };
}

function renderMatrix() {
  const cells = {};
  for (const c of COUNTY_LIST) for (const z of HAZARDS) cells[c.fips + z.k] = compute(c.fips, z.k, S.intensity);
  const max = Math.max(1, ...Object.values(cells).map((x) => x.plan.demand.shelterPop));
  const t = h("table", { class: "s-t heat" },
    h("thead", {}, h("tr", {}, h("th", {}, "County"), HAZARDS.map((z) => h("th", { class: "r" }, h("span", { class: "sw", style: `background:${hzColor(z.k)};margin-right:6px` }), z.n)))),
    h("tbody", {}, COUNTY_LIST.map((c) => h("tr", {},
      h("td", {}, h("b", {}, c.long), h("span", { class: "sub" }, c.island)),
      HAZARDS.map((z) => {
        const x = cells[c.fips + z.k], d = x.plan.demand, on = S.county === c.fips && S.hazard === z.k;
        const a = 0.06 + 0.4 * (Math.log1p(d.shelterPop) / Math.log1p(max));
        return h("td", { class: "cell" }, h("button", {
          type: "button", style: `--hc:${hzColor(z.k)};--a:${a.toFixed(3)}`, "aria-pressed": String(on),
          "aria-label": `${c.long}, ${z.n}: ${fmt(d.shelterPop)} likely in public shelter, ${fmt(x.area.pop)} residents in the zone`,
          onclick: () => { S.county = c.fips; S.hazard = z.k; if (S.intensity === "custom") { S.intensity = "standard"; S.over = {}; } save(); render(); scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); },
        }, h("b", {}, fmt(d.shelterPop)), h("span", {}, `${fmt(x.area.pop)} in zone`)));
      })))));
  $("matrix").replaceChildren(t);
  const it = INTENSITY.find(([k]) => k === S.intensity);
  $("mxSrc").textContent = `${it[1]}: ${it[2]}. Residents in each zone from 2020 Census blocks inside the State's published hazard layers; hurricane counts the whole county.`;
}

function renderControls() {
  const sel = $("county");
  if (!sel.options.length) {
    for (const c of COUNTY_LIST) sel.append(h("option", { value: c.fips }, c.long));
    sel.append(h("option", { value: "state" }, "All of Hawaiʻi"));
    sel.onchange = () => { S.county = sel.value; save(); render(); };
  }
  sel.value = S.county;
  const hz = $("hazard"); hz.textContent = "";
  for (const z of HAZARDS) hz.append(h("button", { type: "button", "aria-pressed": String(S.hazard === z.k), onclick: () => { S.hazard = z.k; if (S.intensity === "custom") { S.intensity = "standard"; S.over = {}; } save(); render(); } }, h("i", { class: "sw", style: `background:${hzColor(z.k)}` }), z.n));

  const r = ratesFor(S.hazard, S.intensity);
  const box = $("sliders"); box.textContent = "";
  const slider = (key, label, val, min, max, step, show, help) => {
    const id = "sl-" + key, out = h("output", { for: id }, show(val));
    const input = h("input", { id, type: "range", min, max, step, value: val });
    input.oninput = () => {
      const v = +input.value; out.textContent = show(v);
      if (key === "days") S.days = v;
      else { S.over = { evac: r.evac, pub: r.pub, up: r.up, ...S.over, [key]: v }; S.intensity = "custom"; }
      save(); clearTimeout(input._t); input._t = setTimeout(() => render(false), 120);
    };
    box.append(h("label", { class: "s-range", for: id }, h("span", {}, label), out, input, help ? h("small", {}, help) : null));
  };
  slider("evac", "Residents in the zone who evacuate", r.evac, 0, 1, 0.01, (v) => pct(v), FACTORS.evac[S.hazard].src);
  slider("pub", "Evacuees who use a public shelter", r.pub, 0, 1, 0.005, (v) => pct(v, 1), FACTORS.publicShelter[S.hazard].src);
  slider("up", "AFN over-representation in shelters", r.up, 1, 2, 0.05, (v) => "×" + v.toFixed(2), "Households with access and functional needs have fewer alternatives to a public shelter.");
  slider("days", "Days of shelter operation", S.days, 1, 30, 1, (v) => v + (v === 1 ? " day" : " days"), "Turns daily water, meals and staffing into totals.");
}

/* ---------------- detail ---------------- */
function kpi(label, value, sub, color) {
  return h("div", {}, h("div", { class: "l" }, color ? h("i", { class: "k", style: `--k:${color}` }) : null, label), h("div", { class: "v" }, value), sub ? h("div", { class: "s" }, sub) : null);
}

function supplyFor(r, x, fips) {
  // A zero that only exists because the record never states the attribute is not a supply
  // figure, it is a missing record: treat it as unknown, not as a shortage.
  const rec = fips === "15009" ? "FEMA shelter registry" : fips ? "County shelter records" : "County records and FEMA registry";
  if (x.have != null && !x.manual && !(x.have === 0 && x.blocked)) return { have: x.have, src: x.blocked ? `${rec}, partial: ${x.blocked}` : rec, partial: !!x.blocked };
  const pl = fips ? D.pledges?.[x.k] : null;
  if (pl && pl.qty > 0) return { have: pl.qty, src: `Partner commitment${pl.n > 1 ? "s" : ""}, confirmed ${pl.latest}${pl.statewide ? " (includes statewide; needs inter-island transport)" : ""}`, pledge: true };
  return { have: null, src: x.blocked || "No published figure" };
}

const DAILY = new Set(["water", "meals", "staff", "interpreters"]);

function render(full = true) {
  if (!D.tracts.length || !D.exp) return;
  renderIntensity(); renderMatrix(); renderControls();
  const R = compute(S.county, S.hazard, S.intensity);
  const fips = S.county === "state" ? null : S.county;
  D.pledges = fips ? pledgedSupply(fips) : {};
  const d = R.plan.demand, sup = R.plan.supply, z = R.zone, hz = HZ[S.hazard];
  const countyPop = R.area.countyPop || 1;

  $("dTitle").textContent = `${countyName(S.county)} · ${hz.n}`;
  $("dBasis").textContent = `Zone: ${ZONES[S.hazard].basis}. ${R.rates.note}`;
  document.title = `AllReady · ${countyName(S.county)} ${hz.n}`;
  const ISL = { "15003": "oahu", "15001": "hawaii", "15009": "maui", "15007": "kauai" };
  $("toMap").href = `index.html?whatif=1&hazard=${S.hazard}${fips ? `&county=${fips}&island=${ISL[fips]}` : ""}`;
  $("sumMeta").textContent = INTENSITY.find(([k]) => k === S.intensity)[1];

  const capKnown = sup.sites - sup.capacityUnknownSites;
  $("kpis").replaceChildren(
    kpi("Residents in the zone", fmt(z.pop), `${pct(z.pop / countyPop)} of ${S.county === "state" ? "the state" : "the county"}`, hzColor(S.hazard)),
    kpi("Likely in public shelter", fmt(d.shelterPop), `range ${fmt(d.shelterLow)}–${fmt(d.shelterHigh)}`, "var(--s-brand)"),
    kpi("Spaces on record", sup.spaces ? fmt(sup.spaces) : "Not published", sup.sites ? `${capKnown} of ${sup.sites} sites state a capacity${fips === "15009" ? " (FEMA registry)" : ""}` : "no sites on record"),
    kpi("With a disability", fmt(z.dis), "in the zone", "var(--c-I)"),
    kpi("Limited English", fmt(z.lep), "in the zone", "var(--c-C)"),
    kpi("Power-dependent", fmt(z.dme), "Medicare, in the zone", "var(--c-M)"),
  );

  renderCmist(R, fips);
  renderChart(R);
  renderResources(R, fips);
  renderCompare();
  if (full) { renderTimeline(); renderTracts(R); }
}

function renderCmist(R, fips) {
  const d = R.plan.demand, z = R.zone, res = Object.fromEntries(R.plan.resources.map((x) => [x.k, x]));
  const rows = [
    ["C", "Communication", z.lep, "speak English less than well", d.cmist.C.v, "interpreters"],
    ["M", "Medical", z.dme, `power-dependent Medicare beneficiaries; ${fmt(z.dialysis)} on dialysis`, d.cmist.M.v, "power"],
    ["I", "Independence", z.dis, "living with a disability", d.cmist.I.v, "accessible"],
    ["S", "Safety and support", z.a65 + z.a17, "aged 65+ or under 18", d.cmist.S.v, "pets"],
    ["T", "Transportation", z.nov, "households with no vehicle", d.cmist.T.v, "transport"],
  ];
  const t = h("table", { class: "s-t" },
    h("thead", {}, h("tr", {}, ["Need", "In the zone", "Likely in shelter", "Key resource", "Supply", "Confirm with"].map((c, i) => h("th", { class: i === 1 || i === 2 ? "r" : null }, c)))),
    h("tbody", {}, rows.map(([k, n, inZone, what, inShelter, rk]) => {
      const x = res[rk], s = x ? supplyFor(R, x, fips) : null, w = who(rk, fips);
      return h("tr", {},
        h("td", {}, h("span", { style: "display:flex;gap:9px;align-items:center" }, h("span", { class: "chip", style: `background:var(--c-${k})` }, k), h("b", {}, n))),
        h("td", { class: "num" }, fmt(inZone), h("span", { class: "sub" }, what)),
        h("td", { class: "num" }, fmt(inShelter)),
        h("td", {}, x ? [x.n, h("span", { class: "sub" }, `${fmt(x.need)} ${x.unit}`)] : "—"),
        h("td", {}, !s ? "—" : s.have == null ? h("span", { class: "tag warn" }, "Confirm") : h("span", { class: s.have >= x.need ? "tag ok" : "tag bad" }, `${fmt(s.have)} on record`)),
        h("td", { class: "who" }, h("b", {}, w.org), h("span", { class: "sub" }, w.ask)));
    })));
  $("cmist").replaceChildren(t);
}

function renderResources(R, fips) {
  const rows = R.plan.resources.filter((x) => x.need > 0);
  D.csv = [["Resource", "CMIST", "Needed", "Unit", "Supply", "Supply source", "Gap", "Confirm with", "What to confirm", "Basis"]];
  const tb = h("tbody");
  for (const x of rows) {
    const s = supplyFor(R, x, fips), w = who(x.k, fips);
    const daily = DAILY.has(x.k), need = daily ? x.need * S.days : x.need, have = s.have == null ? null : daily && s.pledge ? s.have * S.days : s.have;
    const gap = have == null ? null : Math.max(0, need - have);
    const status = have == null ? h("span", { class: "tag warn" }, "Confirm") : gap > 0 ? h("span", { class: s.partial ? "tag warn" : "tag bad" }, (s.partial ? "At least " : "Short ") + fmt(gap) + (s.partial ? " short" : "")) : h("span", { class: "tag ok" }, "Covered");
    const cm = x.cmist !== "—" ? h("span", { class: "chip", style: `background:var(--c-${x.cmist})` }, x.cmist) : h("span", { class: "s-muted" }, "—");
    tb.append(h("tr", {},
      h("td", {}, h("b", {}, x.n), h("span", { class: "sub" }, x.how)),
      h("td", {}, cm),
      h("td", { class: "num" }, fmt(need), h("span", { class: "sub" }, daily ? `${x.unit.replace("/day", "")} over ${S.days} d` : x.unit)),
      h("td", { class: "num" }, have == null ? "–" : fmt(have)),
      h("td", {}, status, h("span", { class: "sub", style: "margin-top:4px" }, s.src)),
      h("td", { class: "who" }, have == null || gap > 0 ? [h("b", {}, w.org), h("span", { class: "sub" }, w.ask)] : h("span", { class: "s-muted" }, "—"))));
    D.csv.push([x.n, x.cmist, Math.round(need), daily ? `${x.unit} × ${S.days} days` : x.unit, have == null ? "" : Math.round(have), s.src, gap == null ? "unknown" : Math.round(gap), w.org, w.ask, x.how]);
  }
  $("resources").replaceChildren(h("table", { class: "s-t" }, h("thead", {}, h("tr", {}, ["Resource", "CMIST", "Needed", "Supply", "Status", "Confirm with"].map((c, i) => h("th", { class: i === 2 || i === 3 ? "r" : null }, c)))), tb));
  const pl = Object.keys(D.pledges || {}).length;
  $("rsSrc").textContent = `${pl ? pl + " resource types have current partner commitments for this county." : "No partner commitments recorded for this county yet (Coordination)."} Commitments older than 30 days are not counted.`;
}

function renderCompare() {
  const cols = [["near", "Near miss"], ["standard", "Standard"], ["high", "Worst case"]];
  const val = (r, k) => r.plan.resources.find((x) => x.k === k)?.need;
  const t = h("table", { class: "s-t" },
    h("thead", {}, h("tr", {}, ["", "In shelter", "ADA", "Lift runs"].map((c, i) => h("th", { class: i ? "r" : null }, c)))),
    h("tbody", {}, cols.map(([k, n]) => { const r = compute(S.county, S.hazard, k); return h("tr", { title: r.rates.note }, h("td", {}, h("b", {}, n), k === "near" && !r.rates.ok ? h("span", { class: "sub" }, "no past count") : null), h("td", { class: "num" }, fmt(r.plan.demand.shelterPop)), h("td", { class: "num" }, fmt(val(r, "accessible"))), h("td", { class: "num" }, fmt(val(r, "lift")))); })));
  $("compare").replaceChildren(t);
}

/* ---------------- chart: shelter population across the phases ---------------- */
function renderChart(R) {
  const sc = SCENARIOS[S.hazard], fips = S.county === "state" ? null : S.county;
  const d = R.plan.demand;
  const pts = sc.phases.map((p) => {
    const s = supply({ shelters: D.shelters, hazard: S.hazard, roles: p.roles.length ? p.roles : ["__none__"], fipsFilter: fips ? [fips] : null });
    return { t: p.t, n: p.n, open: p.roles.length > 0, likely: d.shelterPop * p.ramp, lo: d.shelterLow * p.ramp, hi: d.shelterHigh * p.ramp, cap: p.roles.length ? s.spaces : 0 };
  });
  const W = 860, H = 250, L = 56, Rr = 14, T = 14, B = 46;
  const t0 = pts[0].t, t1 = pts[pts.length - 1].t, ymax = Math.max(1, ...pts.map((p) => Math.max(p.hi, p.cap))) * 1.08;
  const x = (t) => L + ((t - t0) / (t1 - t0 || 1)) * (W - L - Rr), y = (v) => T + (1 - v / ymax) * (H - T - B);
  const path = (k) => pts.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p[k]).toFixed(1)}`).join("");
  const band = pts.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.hi).toFixed(1)}`).join("") + pts.slice().reverse().map((p) => `L${x(p.t).toFixed(1)},${y(p.lo).toFixed(1)}`).join("") + "Z";
  const step = pts.map((p, i) => (i ? `L${x(p.t).toFixed(1)},${y(pts[i - 1].cap).toFixed(1)}L${x(p.t).toFixed(1)},${y(p.cap).toFixed(1)}` : `M${x(p.t).toFixed(1)},${y(p.cap).toFixed(1)}`)).join("") + `L${x(t1).toFixed(1)},${y(pts[pts.length - 1].cap).toFixed(1)}`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ymax * f);
  const known = R.plan.supply.spaces > 0;
  // Only phases where shelters are meant to be open can be "over capacity".
  const cross = known ? pts.find((p) => p.open && p.likely > p.cap && p.likely > 0) : null;
  const c = hzColor(S.hazard);
  const svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Shelter demand by phase for ${HZ[S.hazard].n} in ${countyName(S.county)}">
    <g class="grid">${ticks.map((v) => `<line x1="${L}" x2="${W - Rr}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 8}" y="${y(v) + 3}" text-anchor="end">${fmt(v)}</text>`).join("")}</g>
    <path d="${band}" fill="${c}" opacity=".14"/>
    <path d="${path("likely")}" fill="none" stroke="${c}" stroke-width="2.5"/>
    ${known ? "" : "<!-- no published capacity -->"}<path d="${known ? step : ""}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="5 4" style="color:var(--s-ink2)"/>
    ${(() => { let last = -1e9; return pts.map((p) => { const px = x(p.t), lab = px - last >= 52 ? ((last = px), `<text x="${px}" y="${H - B + 16}" text-anchor="middle">${fmtOffset(p.t, sc.unit)}</text>`) : ""; return `<circle cx="${px}" cy="${y(p.likely)}" r="3.2" fill="${c}"/>${lab}`; }).join(""); })()}
    ${cross ? `<line x1="${x(cross.t)}" x2="${x(cross.t)}" y1="${T}" y2="${H - B}" stroke="var(--s-bad)" stroke-width="1.2"/><text x="${x(cross.t) + 5}" y="${T + 10}" style="fill:var(--s-bad)">demand passes published spaces</text>` : ""}
  </svg>`;
  const host = $("chart"); host.innerHTML = svg; // numbers and fixed labels only, never user text
  host.append(h("div", { class: "legend" },
    h("span", {}, h("i", { style: `--lc:${c}` }), "Likely shelter population"),
    h("span", {}, h("i", { class: "band", style: `--lc:${c}` }), "Planning range"),
    h("span", {}, h("i", { class: "dash", style: "--lc:var(--s-ink2)" }), "Spaces on record for shelters open in that phase")));
  $("chSub").textContent = cross
    ? `Under these assumptions demand passes the published capacity at ${fmtOffset(cross.t, sc.unit)} (${cross.n}). Capacity counts only sites whose county publishes a figure.`
    : known ? "Demand stays within the published capacity in every phase. Capacity counts only sites whose county publishes a figure." : "No published capacity for this county, so only demand is drawn.";
}

/* ---------------- decision points ---------------- */
function renderTimeline() {
  const sc = SCENARIOS[S.hazard], tb = h("tbody");
  for (let i = 0; i < sc.phases.length; i++) {
    const p = sc.phases[i], next = sc.phases[i + 1]?.t ?? Infinity;
    tb.append(h("tr", { class: "grp" }, h("td", { class: "num", style: "text-align:left" }, fmtOffset(p.t, sc.unit)), h("td", { colspan: "4" }, p.n, h("span", { class: "s-muted", style: "font-weight:400" }, " — " + p.note))));
    for (const q of sc.points.filter((x) => x.t >= p.t && x.t < next)) {
      const o = OWNERS[q.owner];
      tb.append(h("tr", {},
        h("td", { class: "num", style: "text-align:left;color:var(--s-ink3)" }, fmtOffset(q.t, sc.unit)),
        h("td", {}, h("b", {}, o.n), q.afn ? h("span", { class: "sub" }, "AFN action") : null),
        h("td", {}, q.action),
        h("td", {}, q.trigger),
        h("td", {}, q.comms ? [q.comms.channel, h("span", { class: "sub" }, `${q.comms.messenger}${q.comms.langs.length ? ` · ${q.comms.langs.length} languages` : ""}`)] : h("span", { class: "s-muted" }, "Internal"))));
    }
  }
  $("timeline").replaceChildren(h("table", { class: "s-t" }, h("thead", {}, h("tr", {}, ["When", "Who", "Action", "Trigger", "Residents told by"].map((c) => h("th", {}, c)))), tb));
}

/* ---------------- tracts ---------------- */
function renderTracts(R) {
  const list = R.area.list.map(({ t, w }) => ({ t, w, dis: (t.disability || 0) * w, lep: (t.limited_english || 0) * w, nov: (t.no_vehicle || 0) * w, pop: (t.pop || 0) * w }))
    .sort((a, b) => b.dis + b.lep + b.nov * 2 - (a.dis + a.lep + a.nov * 2)).slice(0, 10);
  if (!list.length) { $("tracts").replaceChildren(h("p", { class: "s-empty", style: "margin:16px" }, "No census tract in this county has residents inside the zone.")); return; }
  $("tracts").replaceChildren(h("table", { class: "s-t" },
    h("thead", {}, h("tr", {}, ["Census tract", "In zone", "Share", "Disability", "Limited English", "No vehicle (hh)", "AFN index"].map((c, i) => h("th", { class: i ? "r" : null }, c)))),
    h("tbody", {}, list.map(({ t, w, dis, lep, nov, pop }) => h("tr", {},
      h("td", {}, h("b", {}, t.tract || t.fips), h("span", { class: "sub" }, t.county)),
      h("td", { class: "num" }, fmt(pop)), h("td", { class: "num" }, pct(w)),
      h("td", { class: "num" }, fmt(dis)), h("td", { class: "num" }, fmt(lep)), h("td", { class: "num" }, fmt(nov)),
      h("td", { class: "num" }, Math.round(t.afn_index) + " / 100"))))));
}

/* ---------------- assistant ---------------- */
function context() {
  const R = compute(S.county, S.hazard, S.intensity), d = R.plan.demand, fips = S.county === "state" ? null : S.county;
  return {
    app: "AllReady event planner", mode: "WHAT-IF scenario chosen by the planner. Not a real event, not a forecast.",
    scenario: { county: countyName(S.county), hazard: HZ[S.hazard].n, intensity: INTENSITY.find(([k]) => k === S.intensity)[1], rateBasis: R.rates.note, zoneBasis: ZONES[S.hazard].basis, shelterDays: S.days },
    inZone: Object.fromEntries(Object.entries(R.zone).map(([k, v]) => [k, Math.round(v)])),
    needs: { likelyInPublicShelter: d.shelterPop, range: [d.shelterLow, d.shelterHigh], cmistInShelter: Object.fromEntries(Object.entries(d.cmist).map(([k, v]) => [k, { name: v.n, people: v.v, meaning: v.what }])) },
    resources: R.plan.resources.filter((x) => x.need > 0).map((x) => { const s = supplyFor(R, x, fips), w = who(x.k, fips); return { resource: x.n, needed: x.need, unit: x.unit, supply: s.have, supplySource: s.src, gap: s.have == null ? "unknown" : Math.max(0, x.need - s.have), confirmWith: w.org }; }),
    shelterSupply: { sitesOnRecord: R.plan.supply.sites, spacesOnRecord: R.plan.supply.spaces, sitesWithoutCapacity: R.plan.supply.capacityUnknownSites },
    decisionPoints: SCENARIOS[S.hazard].points.map((p) => ({ when: fmtOffset(p.t, SCENARIOS[S.hazard].unit), who: OWNERS[p.owner].n, action: p.action, trigger: p.trigger })),
  };
}

createAssistant($("ai"), {
  getContext: context,
  intro: "Ask about the scenario on this page: the gaps, who to call, what to do first. Answers use only these figures.",
  prompts: [
    { label: "Brief this scenario", q: "Write a five-bullet planning brief for this scenario: who is affected, the biggest gaps, and the first three actions with who owns them." },
    { label: "Unknowns and who to call", q: "List the resource lines whose supply is unknown, and for each say who to call and what to ask." },
    { label: "First 24 hours", q: "What should the county and State do in the first 24 hours of this scenario for residents with access and functional needs?" },
  ],
});

/* ---------------- print, export, share ---------------- */
$("print").onclick = () => window.print();
$("csv").onclick = () => {
  const blob = new Blob(["﻿" + (D.csv || []).map((r) => r.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const a = h("a", { href: URL.createObjectURL(blob), download: `allready-${S.hazard}-${S.county}.csv` }); document.body.append(a); a.click(); a.remove();
};
$("copy").onclick = async () => {
  const u = new URL(location.href); u.search = new URLSearchParams({ county: S.county, hazard: S.hazard }).toString();
  try { await navigator.clipboard.writeText(u.toString()); $("copy").textContent = "Link copied"; } catch { $("copy").textContent = u.toString(); }
  setTimeout(() => ($("copy").textContent = "Copy link"), 2500);
};
$("reset").onclick = () => { S.intensity = "standard"; S.over = {}; S.days = 7; save(); render(); };

/* ---------------- load ---------------- */
function ribbon(parts) {
  $("ribbon").replaceChildren(...parts.map(([s, b, t]) => h("span", {}, h("span", { class: "dot", "data-s": s }), b ? h("b", {}, b + " ") : null, t)));
}
(async () => {
  const [svi, shel, emp, exp] = await Promise.allSettled([fetchSVI({ geometry: false }), loadShelters(), loadEmpower(), loadExposure()]);
  if (svi.status === "fulfilled") D.tracts = rankTracts(svi.value);
  if (shel.status === "fulfilled") D.shelters = shel.value.shelters || shel.value.list || shel.value;
  if (emp.status === "fulfilled") D.emp = emp.value;
  if (exp.status === "fulfilled") D.exp = exp.value;
  if (!Array.isArray(D.shelters)) D.shelters = [];
  // Near-miss calibration: observed turnout from the past-events check, per hazard (highest observed).
  for (const r of backtest(D.tracts)) {
    if (!r.pop || r.observed == null) continue;
    const cur = D.observed[r.hazard];
    if (!cur || r.observed > cur.rate) D.observed[r.hazard] = { rate: r.observed, label: `${r.name} ${r.date.slice(0, 4)} (${r.place})` };
  }
  const now = Date.now();
  ribbon([
    [D.tracts.length ? "on" : "off", "Census tracts", D.tracts.length ? `${D.tracts.length} read from CDC/ATSDR at ${stamp(now)}` : "unavailable"],
    [D.exp ? "on" : "off", "Hazard zones", D.exp ? `${Object.keys(D.exp.tracts).length} tracts processed ${new Date(D.exp.generated).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : "unavailable"],
    [D.shelters.length ? "on" : "warn", "Shelters", D.shelters.length ? `${D.shelters.length} sites: 3 county services and FEMA registry (Maui), live` : "county feeds unavailable"],
    [D.emp ? "on" : "warn", "emPOWER", D.emp ? "read live" : "unavailable"],
  ]);
  if (!D.tracts.length || !D.exp) { $("dTitle").textContent = "A data source did not answer. Reload the page to try again."; return; }
  render();
  // A real event changes the question: point to the live map.
  try {
    const al = await loadLiveAlerts(); const ev = liveEvent(al.alerts || al);
    if (ev) $("ribbon").prepend(h("span", {}, h("span", { class: "dot", "data-s": "warn" }), h("b", {}, "Real alert in force: "), ev.label + " — ", h("a", { href: "index.html" }, "open the live map")));
  } catch { /* the planner works without it */ }
})();
