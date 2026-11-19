/* AllReady — Insights. MIT licensed.

   The map page answers "where". This page answers "so what", and it is where the heavy
   reading moved to: gaps, readiness, assumptions, decision points, and a query box for the
   question nobody built a panel for.

   Everything is a widget on a grid you own. Add, duplicate, resize, reorder, remove — and
   nothing is ever lost, because the palette can always put it back. The layout persists per
   browser; a planner's dashboard should still be their dashboard tomorrow morning.

   Same data, same model, same numbers as the map. Nothing here is recomputed differently. */

import "./insights.css";
import { mountThemeToggle } from "./theme.js";
import { mountLanguage } from "./lang.js";
import { navLinks } from "./nav.js";
import { fetchSVI, rankTracts, areaOf, COUNTY_NAMES } from "./svi.js";
import { loadShelters, readiness } from "./shelters.js";
import { loadEmpower, LINES } from "./empower.js";
import { plan as buildPlan, dataActions, HAZARDS } from "./model.js";
import { SCENARIOS } from "./scenario.js";
import { WIDGETS, WIDGET_LIST } from "./widgets.js";
import { liveEvent, insideEvent, loadLiveAlerts, manualSupply, stamp } from "./live.js";

const $ = (id) => document.getElementById(id);
const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };
const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

mountThemeToggle($("theme-host"));
mountLanguage($("lang-host"));
$("pgnav")?.append(...navLinks("insights", "lnk"));
setInterval(() => ($("clk").textContent = new Date().toLocaleTimeString("en-US", { timeZone: "Pacific/Honolulu", hour12: false }) + " HST"), 1000);

/* ---------------- state ---------------- */

/* Layout is explicit, like Grafana's: every widget has a cell rectangle {x, y, w, h} on a
   12-column grid with fixed-height rows. Dragging and resizing snap to cells, a widget that
   lands on another pushes it down, and everything then floats up to close gaps — so nothing
   is ever free-floating or overlapping. */
const COLS = 12, ROW = 40, GAP = 12;
const DEFAULT_LAYOUT = [
  { k: "stat", w: 2, h: 3, state: { metric: "shelters_open" } }, { k: "stat", w: 2, h: 3, state: { metric: "shelter_spaces" } },
  { k: "stat", w: 2, h: 3, state: { metric: "population" } }, { k: "stat", w: 2, h: 3, state: { metric: "afn_high_pct" } },
  { k: "stat", w: 2, h: 3, state: { metric: "power_dependent" } }, { k: "stat", w: 2, h: 3, state: { metric: "alerts_active" } },
  { k: "summary", w: 5, h: 8 }, { k: "gaps", w: 7, h: 8 },
  { k: "readiness", w: 6, h: 9 }, { k: "cmist", w: 3, h: 9 }, { k: "empower", w: 3, h: 9 },
  { k: "actions", w: 6, h: 9 }, { k: "tracts", w: 6, h: 9 }, { k: "backtest", w: 12, h: 12 }, { k: "sources", w: 12, h: 7 },
];

const S = Object.assign(
  { hazard: "live", phaseIdx: null, scope: "state", layout: null },
  store.get("allready.insights.v7", {}),
);
const hit = (a, b) => a !== b && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
/** First free cell rectangle of size w×h, scanning top-down. */
function firstFit(w, h, list) {
  for (let y = 0; ; y++) for (let x = 0; x <= COLS - w; x++) {
    const r = { x, y, w, h };
    if (!list.some((o) => hit(r, o))) return r;
  }
}
function seed(w, list = S.layout || []) {
  const def = WIDGETS[w.k];
  const ww = Math.min(COLS, w.w ?? def?.w ?? 6), hh = w.h ?? def?.h ?? 6;
  const pos = w.x != null ? { x: w.x, y: w.y } : firstFit(ww, hh, list);
  return { uid: `w${Math.random().toString(36).slice(2, 9)}`, k: w.k, x: pos.x, y: pos.y, w: ww, h: hh, state: w.state || {} };
}
/** Push anything the moved widget overlaps downward, then let everything float up. */
function settle(fixed) {
  const L = S.layout;
  const push = (m) => { for (const o of L) if (o !== fixed && hit(m, o)) { o.y = m.y + m.h; push(o); } };
  if (fixed) push(fixed);
  for (const o of [...L].sort((a, b) => a.y - b.y || a.x - b.x)) {
    if (o === fixed) continue;
    while (o.y > 0 && !L.some((q) => hit({ ...o, y: o.y - 1 }, q) && q !== o)) o.y--;
  }
}
if (!Array.isArray(S.layout) || !S.layout.length || S.layout.some((w) => w.x == null)) {
  S.layout = []; for (const w of DEFAULT_LAYOUT) S.layout.push(seed(w, S.layout));
}
const save = () => store.set("allready.insights.v7", { hazard: S.hazard, phaseIdx: S.phaseIdx, scope: S.scope, layout: S.layout });

const DATA = { tracts: [], shelters: [], score: [], actions: [], emp: null, alerts: null, quakes: null, error: null, read: { live: 0, base: 0 } };

/* ---------------- scope + scenario bar ---------------- */

const SCOPES = [["state", "All of Hawaiʻi"], ...Object.entries(COUNTY_NAMES).filter(([f]) => f !== "15005")];

function buildScopeBar() {
  const host = $("scopebar");
  host.textContent = "";

  const mk = (label, options, value, onChange) => {
    const wrap = el("label", "sb");
    wrap.append(el("span", null, label));
    const s = el("select", "sel");
    options.forEach(([v, n]) => { const o = el("option", null, n); o.value = v; s.append(o); });
    s.value = value;
    s.onchange = () => onChange(s.value);
    wrap.append(s);
    return wrap;
  };

  host.append(mk("Event", [["live", "Live (NWS alerts)"], ...HAZARDS.map((h) => [h.k, "What-if: " + h.n])], S.hazard, (v) => { S.hazard = v; S.phaseIdx = null; save(); renderAll(); }));
  if (S.hazard !== "live") {
    const sc = SCENARIOS[S.hazard];
    const defaultIdx = Math.max(0, sc.phases.findIndex((p) => p.roles.length));
    const idx = S.phaseIdx == null ? defaultIdx : Math.min(S.phaseIdx, sc.phases.length - 1);
    host.append(mk("Phase", sc.phases.map((p, i) => [String(i), p.n]), String(idx), (v) => { S.phaseIdx = +v; save(); renderAll(); }));
  }

  host.append(mk("Area", SCOPES, S.scope, (v) => { S.scope = v; save(); renderAll(); }));
}

function currentContext() {
  /* Live by default: the event is the NWS alert in force and the people at risk are the
     tracts inside its polygons. A what-if is only used when it is picked in the Event box. */
  const live = S.hazard === "live";
  const ev = live ? liveEvent(DATA.alerts) : null;
  let sc = null, phase = null, tracts = S.scope === "state" ? DATA.tracts : DATA.tracts.filter((t) => t.countyFips === S.scope);
  if (live && ev) {
    sc = ev.scenario; phase = ev.phase;
    const { hasGeometry, test } = insideEvent(ev);
    if (hasGeometry) tracts = tracts.filter((t) => t._centroid && test(t._centroid));
  } else if (!live) {
    sc = SCENARIOS[S.hazard];
    const defaultIdx = Math.max(0, sc.phases.findIndex((p) => p.roles.length));
    phase = sc.phases[S.phaseIdx == null ? defaultIdx : Math.min(S.phaseIdx, sc.phases.length - 1)];
  }
  const hazardKey = live ? ev?.hazard : S.hazard;
  const area = areaOf(tracts);
  const fipsFilter = S.scope === "state" ? (live && ev ? area.fips : null) : [S.scope];

  const plan = DATA.tracts.length && sc && area.pop
    ? buildPlan({
        hazard: hazardKey, area, emp: DATA.emp, shelters: DATA.shelters,
        ramp: phase.ramp, roles: phase.roles.length ? phase.roles : null, fipsFilter, manual: manualSupply(),
      })
    : null;
  const modeLabel = live ? (ev ? `Live · ${ev.label}` : "Live · no active event") : `What-if · ${sc.n} · ${phase.n}`;
  const idle = live && !ev ? "No hurricane, tsunami, flood or fire-weather alert is in force for Hawaiʻi, so no needs or gaps are calculated. Pick a What-if in the Event box, or open Scenarios to compare every county and hazard." : "No census tracts fall inside this event for the selected area.";

  const scopeName = SCOPES.find(([k]) => k === S.scope)?.[1] || "All of Hawaiʻi";
  const shelterScope = DATA.shelters.filter((x) => S.scope === "state" || x.fips === S.scope);
  /* What the AI summary is handed: the same figures the tiles and tables show. */
  const aiContext = () => ({
    app: "AllReady Insights", scope: scopeName,
    mode: live ? (ev ? `LIVE — real NWS alert in force: ${ev.label}` : "LIVE — no hurricane, tsunami, flood or fire-weather alert in force; no needs or gaps are calculated") : "WHAT-IF — hypothetical scenario chosen by the planner, not a real event",
    eventClock: sc ? { hazard: sc.n, phase: phase.n, evacuationProgressPct: Math.round(phase.ramp * 100) } : null,
    shelterSupplyOnRecord: { sites: shelterScope.length, openNow: shelterScope.filter((x) => x.status === "open").length, spaces: shelterScope.reduce((t, x) => t + (x.capacity || 0), 0) },
    feedsRead: stamp(DATA.read.live),
    area: { censusTracts: area.tracts, residents: area.pop, withDisability: area.dis, limitedEnglish: area.lep, householdsNoVehicle: area.nov, age65plus: area.a65 },
    needs: plan ? { atRisk: plan.demand.atRisk, evacuating: plan.demand.evacuating, inPublicShelter: plan.demand.shelterPop, cmist: Object.fromEntries(Object.entries(plan.demand.cmist).map(([k, v]) => [k, { name: v.n, people: v.v }])) } : null,
    resources: plan ? plan.resources.map((r) => ({ resource: r.n, needed: r.need, unit: r.unit, confirmedSupply: r.have, gap: r.gap, state: r.state, whyUnknown: r.blocked || undefined })) : [],
    shelterReadinessByCounty: DATA.score.map((c) => ({ county: c.county, publishes: c.published, sites: c.count, spacesOnRecord: c.capacity, openNow: c.open, attributeCompletenessPct: c.pct })),
    alertsInForce: (DATA.alerts || []).slice(0, 10).map((a) => ({ event: a.event, severity: a.severity, area: a.area.slice(0, 140) })),
    earthquakesPast7Days: DATA.quakes,
    topDataActions: DATA.actions.slice(0, 4).map((a) => a.title),
  });
  return { plan, scenario: sc, phase, hazard: hazardKey, modeLabel, idle, live, tracts, area, scopeName, aiContext, rerender: renderAll, all: DATA, readAt: stamp(DATA.read.live), shelters: DATA.shelters, score: DATA.score, actions: DATA.actions, emp: DATA.emp };
}

/* ---------------- widget chrome ---------------- */

const ICON = (d) => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I_COPY = ICON('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>');
const I_X = ICON('<path d="M18 6 6 18M6 6l12 12"/>');

const place = (card, w) => { card.style.gridColumn = `${w.x + 1} / span ${w.w}`; card.style.gridRow = `${w.y + 1} / span ${w.h}`; };
const placeAll = () => { for (const w of S.layout) { const c = document.querySelector(`[data-uid="${w.uid}"]`); if (c) place(c, w); } };

function widgetEl(w, ctx) {
  const def = WIDGETS[w.k];
  const card = el("section", "card");
  place(card, w);
  card.dataset.uid = w.uid;
  card.setAttribute("aria-label", def?.title || w.k);

  const head = el("header", "card-h");
  head.tabIndex = 0;
  head.setAttribute("aria-label", `${def?.title}. Drag to move. Arrow keys move it, Shift plus arrow keys resize it.`);
  head.append(el("h3", null, def?.title || w.k));
  const tools = el("div", "card-t");
  const dup = el("button", "card-b");
  dup.type = "button"; dup.innerHTML = I_COPY; dup.title = "Duplicate"; dup.setAttribute("aria-label", `Duplicate ${def?.title}`);
  dup.onclick = () => { S.layout.push(seed({ k: w.k, w: w.w, h: w.h, state: { ...w.state } })); save(); renderAll(); };
  const rm = el("button", "card-b");
  rm.type = "button"; rm.innerHTML = I_X; rm.title = "Remove — add it back any time from Add widget"; rm.setAttribute("aria-label", `Remove ${def?.title}`);
  rm.onclick = () => { S.layout = S.layout.filter((x) => x.uid !== w.uid); settle(); save(); renderAll(); };
  tools.append(dup, rm);
  head.append(tools);
  card.append(head);

  const body = el("div", "card-b-body");
  try {
    const st = { ...w.state, save: () => { w.state = { ...st }; delete w.state.save; save(); } };
    def?.render(body, ctx, st);
  } catch (e) {
    body.append(el("p", "q-err", `This widget could not render: ${e.message}`));
    console.warn("widget", w.k, e);
  }
  card.append(body);

  // resize from any edge or corner
  for (const d of ["n", "e", "s", "w", "ne", "nw", "se", "sw"]) { const hnd = el("i", "card-rs rs-" + d); hnd.dataset.rs = d; card.append(hnd); }

  /* Pointer drag for move and resize. Positions are recomputed from a snapshot on every
     move, so a widget pushed aside springs back the moment the dragged one leaves. */
  const begin = (e, mode) => {
    if (e.button || matchMedia("(max-width: 700px)").matches) return;
    e.preventDefault();
    const grid = $("grid"), gr = grid.getBoundingClientRect();
    const cw = (gr.width + GAP) / COLS, rh = ROW + GAP;
    const snap = S.layout.map((o) => ({ o, x: o.x, y: o.y, w: o.w, h: o.h }));
    const me = snap.find((q) => q.o === w), x0 = e.clientX, y0 = e.clientY;
    card.classList.add("is-drag"); document.body.classList.add("ins-dragging");
    const move = (ev) => {
      for (const q of snap) Object.assign(q.o, { x: q.x, y: q.y, w: q.w, h: q.h });
      const dx = Math.round((ev.clientX - x0) / cw), dy = Math.round((ev.clientY - y0) / rh);
      if (mode === "move") { w.x = Math.max(0, Math.min(COLS - w.w, me.x + dx)); w.y = Math.max(0, me.y + dy); }
      else {
        if (mode.includes("e")) w.w = Math.max(2, Math.min(COLS - me.x, me.w + dx));
        if (mode.includes("s")) w.h = Math.max(2, me.h + dy);
        if (mode.includes("w")) { const nx = Math.max(0, Math.min(me.x + me.w - 2, me.x + dx)); w.w = me.w + (me.x - nx); w.x = nx; }
        if (mode.includes("n")) { const ny = Math.max(0, Math.min(me.y + me.h - 2, me.y + dy)); w.h = me.h + (me.y - ny); w.y = ny; }
      }
      settle(w); placeAll();
    };
    const up = () => {
      removeEventListener("pointermove", move); removeEventListener("pointerup", up);
      card.classList.remove("is-drag"); document.body.classList.remove("ins-dragging");
      settle(); placeAll(); save();
    };
    addEventListener("pointermove", move); addEventListener("pointerup", up);
  };
  head.addEventListener("pointerdown", (e) => { if (!e.target.closest("button")) begin(e, "move"); });
  card.addEventListener("pointerdown", (e) => { const r = e.target.closest("[data-rs]"); if (r) begin(e, r.dataset.rs); });
  head.addEventListener("keydown", (e) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!d || e.target !== head) return;
    e.preventDefault();
    if (e.shiftKey) { w.w = Math.max(2, Math.min(COLS - w.x, w.w + d[0])); w.h = Math.max(2, w.h + d[1]); }
    else { w.x = Math.max(0, Math.min(COLS - w.w, w.x + d[0])); w.y = Math.max(0, w.y + d[1]); }
    settle(w); settle(); placeAll(); save();
  });

  return card;
}

/* ---------------- render ---------------- */

function renderAll() {
  buildScopeBar();
  const grid = $("grid");
  grid.textContent = "";
  if (DATA.error) { grid.append(el("p", "ins-err", DATA.error)); return; }
  if (!DATA.tracts.length) return;
  const ctx = currentContext();
  if (!S.layout.length) {
    const p = el("div", "ins-blank");
    p.append(el("p", null, "Every widget has been removed."));
    const b = el("button", "btn", "Restore the default dashboard");
    b.type = "button";
    b.onclick = () => { S.layout = []; for (const w of DEFAULT_LAYOUT) S.layout.push(seed(w, S.layout)); save(); renderAll(); };
    p.append(b);
    grid.append(p);
    return;
  }
  for (const w of S.layout) grid.append(widgetEl(w, ctx));
}

/* ---------------- palette ---------------- */

function buildPalette() {
  const list = $("palList");
  list.textContent = "";
  for (const d of WIDGET_LIST) {
    const b = el("button", "pal-i");
    b.type = "button";
    b.append(el("b", null, d.title), el("p", null, d.hint));
    const n = S.layout.filter((w) => w.k === d.k).length;
    if (n) b.append(el("em", null, `${n} on the dashboard`));
    b.onclick = () => {
      S.layout.push(seed({ k: d.k }));
      save(); renderAll(); buildPalette();
      closePalette();
      requestAnimationFrame(() => document.querySelector(`[data-uid="${S.layout[S.layout.length - 1].uid}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
    };
    list.append(b);
  }
}
const openPalette = () => { buildPalette(); $("palette").hidden = false; $("palClose").focus(); };
const closePalette = () => { $("palette").hidden = true; $("addWidget").focus(); };
$("addWidget").onclick = openPalette;
$("printBtn")?.addEventListener("click", () => window.print());
$("palClose").onclick = closePalette;
$("palette").addEventListener("click", (e) => { if (e.target === $("palette")) closePalette(); });
addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("palette").hidden) closePalette(); });

/* ---------------- load ---------------- */

(async function start() {
  buildScopeBar();
  const status = $("status");
  const settled = await Promise.allSettled([
    fetchSVI({ geometry: false }).then(rankTracts),
    loadShelters(),
    loadEmpower(),
  ]);
  const [tr, sh, emp] = settled;

  if (tr.status === "fulfilled") DATA.tracts = tr.value;
  if (sh.status === "fulfilled") { DATA.shelters = sh.value.shelters; DATA.score = readiness(DATA.shelters); DATA.actions = dataActions(DATA.score); }
  else DATA.score = readiness([]);
  if (emp.status === "fulfilled") DATA.emp = emp.value;

  if (!DATA.tracts.length) {
    DATA.error = "Census tract data (CDC/ATSDR SVI) could not be loaded, so nothing on this page can be computed. It is a public service — check the connection and reload.";
  }

  const missing = [
    tr.status === "rejected" && "census tracts",
    sh.status === "rejected" && "county shelter feeds",
    emp.status === "rejected" && "HHS emPOWER",
  ].filter(Boolean);

  status.textContent = missing.length
    ? `Loaded with gaps — ${missing.join(" and ")} unavailable. Figures that depend on them are marked.`
    : `${DATA.tracts.length} census tracts · ${DATA.shelters.length} shelters from ${DATA.score.filter((c) => c.published).length} of 4 counties · emPOWER loaded`;
  status.dataset.tone = missing.length ? "warn" : "ok";

  renderAll();
})();

/* Live feeds for the tiles: alerts, quakes and shelter status change by the minute, so they
   are re-read every five minutes. A refresh never interrupts someone typing a query. */
async function loadLive() {
  const H = { headers: { Accept: "application/geo+json" } };
  const [al, qk, sh] = await Promise.allSettled([
    loadLiveAlerts(),
    fetch(`https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)}&minlatitude=18&maxlatitude=23&minlongitude=-161&maxlongitude=-154&minmagnitude=2.5`).then((r) => r.json()),
    loadShelters(),
  ]);
  if (al.status === "fulfilled") DATA.alerts = al.value;
  DATA.read.live = Date.now();
  const st = $("status"); if (st && DATA.tracts.length) st.textContent = `Live feeds read ${stamp(DATA.read.live)} (shelters, NWS alerts, USGS) · refresh every 5 min · ${DATA.tracts.length} census tracts (SVI 2022) · ${DATA.shelters.length} shelters from ${DATA.score.filter((c) => c.published).length} of 4 counties`;
  if (qk.status === "fulfilled") { const m = (qk.value.features || []).map((f) => f.properties.mag); DATA.quakes = { count: m.length, max: m.length ? Math.max(...m) : null }; }
  if (sh.status === "fulfilled" && sh.value.shelters.length) { DATA.shelters = sh.value.shelters; DATA.score = readiness(DATA.shelters); DATA.actions = dataActions(DATA.score); }
  if (!/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "")) renderAll();
}
loadLive();
setInterval(loadLive, 5 * 60 * 1000);
/* Census tracts and emPOWER are re-queried too (every 30 minutes and on the refresh button),
   so a new CDC or HHS release shows up without anyone touching the site. */
async function reloadBase() {
  const [tr, emp] = await Promise.allSettled([fetchSVI({ geometry: false }).then(rankTracts), loadEmpower()]);
  if (tr.status === "fulfilled" && tr.value.length) DATA.tracts = tr.value;
  if (emp.status === "fulfilled") DATA.emp = emp.value;
  DATA.read.base = Date.now();
}
setInterval(() => reloadBase().then(loadLive), 30 * 60 * 1000);
$("refresh")?.addEventListener("click", async (e) => { const b = e.currentTarget; b.disabled = true; b.dataset.busy = "1"; await reloadBase(); await loadLive(); b.disabled = false; delete b.dataset.busy; });

window.__insights = { S, DATA, context: currentContext };
