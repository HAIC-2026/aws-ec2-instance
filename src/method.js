/* AllReady — Data & method. MIT licensed.

   A planning number is only as good as a reviewer's ability to check it. This page checks
   every source live from the visitor's own browser, shows coverage against the three DHS
   goals, lists every planning factor, re-runs the check against past events, and asks DHS
   the questions the public data cannot answer. */

import "./site.css";
import { mountTopBar } from "./nav.js";
import { FACTORS, SHELTER_RANGE } from "./model.js";
import { backtest, reading, rate } from "./backtest.js";
import { fetchSVI, rankTracts } from "./svi.js";
import { loadExposure, COUNTY_LIST, ZONES } from "./exposure.js";
import { COUNTIES } from "./shelters.js";
import { loadModel, OUTLOOK_HAZARDS } from "./outlook.js";

const $ = (id) => document.getElementById(id);
function h(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = v; else if (k === "style") n.setAttribute("style", v); else if (k.startsWith("on")) n.addEventListener(k.slice(2), v); else n.setAttribute(k, String(v));
  }
  for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(String(c)));
  return n;
}
const fmt = (n) => (n == null ? "–" : Math.round(n).toLocaleString("en-US"));
const pc = (x, d = 1) => (x * 100).toFixed(d) + "%";

mountTopBar($("top"), "method", "ESF-6 planning");

/* ---------------- sources, with a live check ---------------- */
const SVI = "https://onemap.cdc.gov/onemapservices/rest/services/SVI/CDC_ATSDR_Social_Vulnerability_Index_2022_USA/FeatureServer/2";
const HAZ = "https://geodata.hawaii.gov/arcgis/rest/services/Hazards/MapServer";
const count = (u, where = "1=1") => `${u}/query?where=${encodeURIComponent(where)}&returnCountOnly=true&f=json`;
const shel = (fips) => COUNTIES.find((c) => c.fips === fips);
const SRC = [
  { n: "Honolulu Dept. of Emergency Management — shelters", owner: "City and County of Honolulu", use: "Shelter sites and open/closed status, Oʻahu", lvl: 3, fresh: "Live; re-read every 5 min", url: shel("15003").url, probe: count(shel("15003").url), note: "No capacity, ADA, power, pet or hardening fields" },
  { n: "Hawaiʻi County Civil Defense — emergency shelters", owner: "County of Hawaiʻi", use: "Sites, capacity, ADA, animals, power, hardening", lvl: 3, fresh: "Live; re-read every 5 min", url: shel("15001").url, probe: count(shel("15001").url), note: "Richest AFN schema in the state" },
  { n: "Kauaʻi Emergency Management Agency — shelters", owner: "County of Kauaʻi", use: "Sites, capacity, hazard eligibility", lvl: 3, fresh: "Live; re-read every 5 min", url: shel("15007").url, probe: count(shel("15007").url), note: "ADA mostly blank" },
  { n: "FEMA National Shelter System — Maui County sites", owner: "FEMA Mass Care, synchronised with the American Red Cross", use: "Maui shelter sites, registered capacity, accessibility, generators, pets", lvl: 3, fresh: "Live; re-read with the county feeds", url: "https://gis.fema.gov/arcgis/rest/services/NSS/FEMA_NSS/MapServer/5", probe: count("https://gis.fema.gov/arcgis/rest/services/NSS/FEMA_NSS/MapServer/5", "state='HI'"), note: "Used for Maui only, where the County publishes no list; a registration is not a county designation. Contact fields are never requested." },
  { n: "Maui County's own shelter list", owner: "Maui Emergency Management Agency", use: "Would be the authoritative Maui list", lvl: 1, fresh: "Announced per event on web pages", url: "https://www.mauicounty.gov/2300/Emergency-Management-Agency", probe: null, note: "Not published as data" },
  { n: "National Weather Service — active alerts", owner: "NOAA / NWS Honolulu", use: "The live event and its polygons", lvl: 3, fresh: "Live; re-read every 5 min", url: "https://api.weather.gov/alerts/active?area=HI", probe: "https://api.weather.gov/alerts/active/count", note: "" },
  { n: "CDC/ATSDR Social Vulnerability Index 2022", owner: "CDC / ATSDR (ACS 2018–2022)", use: "Residents, disability, limited English, no vehicle, age, by tract", lvl: 3, fresh: "Latest federal release; re-read every 30 min", url: "https://www.atsdr.cdc.gov/place-health/php/svi/index.html", probe: count(SVI, "ST_ABBR='HI'"), note: "Survey estimates with margins of error" },
  { n: "HHS emPOWER — public REST service", owner: "HHS ASPR / CMS", use: "Electricity-dependent Medicare beneficiaries, dialysis, oxygen", lvl: 3, fresh: "Monthly HHS release; re-read every 30 min", url: "https://empowerprogram.hhs.gov/empowermap", probe: count("https://services2.arcgis.com/ZQ4jTQn6k7VPXEwO/arcgis/rest/services/HHS_emPOWER_REST_Service_Public/FeatureServer/2", "State_FIPS_Code='15'"), note: "Medicare only, so a floor; small counts suppressed by HHS" },
  { n: "2020 Census blocks (TIGERweb)", owner: "U.S. Census Bureau", use: "Where residents live inside each hazard zone", lvl: 3, fresh: "Decennial; processed by scripts/build-exposure.mjs", url: "https://tigerweb.geo.census.gov/", probe: count("https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Tracts_Blocks/MapServer/2", "STATE='15' AND POP100>0"), note: "" },
  { n: "Hawaiʻi Statewide GIS — hazard zones", owner: "Office of Planning and Sustainable Development", use: "Tsunami evacuation zones, fire risk areas, FEMA flood zones (DFIRM)", lvl: 3, fresh: "As republished by the State", url: "https://geoportal.hawaii.gov/", probe: count(`${HAZ}/11`), note: "" },
  { n: "FEMA National Flood Hazard Layer", owner: "FEMA", use: "Flood hazard map layer", lvl: 3, fresh: "As published by FEMA", url: "https://www.fema.gov/flood-maps/national-flood-hazard-layer", probe: "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer?f=json", note: "" },
  { n: "Iowa Environmental Mesonet — NWS alert archive", owner: "Iowa State University", use: "Past alerts for History replay, and the labels the warning-outlook model learned from", lvl: 2, fresh: "Archive, read on demand", url: "https://mesonet.agron.iastate.edu/vtec/", probe: `https://mesonet.agron.iastate.edu/json/vtec_events_bystate.py?state=HI&year=${new Date().getFullYear()}`, note: "" },
  { n: "USGS earthquakes", owner: "U.S. Geological Survey", use: "Earthquakes M2.5+", lvl: 3, fresh: "Live", url: "https://earthquake.usgs.gov/", probe: `https://earthquake.usgs.gov/fdsnws/event/1/count?minlatitude=18&maxlatitude=23&minlongitude=-161&maxlongitude=-154&minmagnitude=2.5&starttime=${new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)}`, note: "" },
  { n: "Open-Meteo", owner: "Open-Meteo (open data)", use: "Weather layers, hourly replay, and the forecast the warning outlook reads", lvl: 3, fresh: "Hourly; cached 30–60 min", url: "https://open-meteo.com/", probe: "https://api.open-meteo.com/v1/forecast?latitude=21.3&longitude=-157.85&current=temperature_2m", note: "Free tier is rate-limited per network" },
  { n: "Partner capacity (Red Cross, Salvation Army, VOAD, paratransit)", owner: "Each partner organisation", use: "Cots, meals, staff, transport, interpreters", lvl: 0, fresh: "Phone call; recorded on Partners & roles", url: "roles.html", probe: null, note: "No public source; the register is the first rung" },
];

async function probe(u) {
  const t0 = performance.now();
  try {
    const r = await fetch(u, { signal: AbortSignal.timeout(12000) });
    const ms = Math.round(performance.now() - t0);
    if (!r.ok) return { ok: false, ms, msg: "HTTP " + r.status };
    let msg = "answering";
    try { const j = await r.clone().json(); if (j.error) return { ok: false, ms, msg: "service error" }; if (j.count != null) msg = fmt(j.count) + " records"; else if (Array.isArray(j.events)) msg = fmt(j.events.length) + " alerts this year"; else if (j.current) msg = "current reading"; } catch { const t = await r.text(); if (/^\d+$/.test(t.trim())) msg = fmt(+t) + " this week"; }
    return { ok: true, ms, msg };
  } catch (e) {
    // Some services refuse cross-origin reads but still answer: an opaque reply means reachable.
    try { await fetch(u, { mode: "no-cors", signal: AbortSignal.timeout(8000) }); return { ok: true, ms: Math.round(performance.now() - t0), msg: "reachable" }; }
    catch { return { ok: false, ms: null, msg: e.name === "TimeoutError" ? "timed out" : "not reachable" }; }
  }
}

const HOW = ["Ask the owner", "Web page or PDF", "Downloadable file", "Live query service"];
async function renderSources() {
  const cells = new Map();
  const t = h("table", { class: "s-t" },
    h("thead", {}, h("tr", {}, ["Source", "Used for", "How it is read", "Refresh", "Status", "Notes"].map((c) => h("th", {}, c)))),
    h("tbody", {}, SRC.map((s) => {
      const st = h("td", {}, s.probe ? h("span", { class: "tag" }, "Checking…") : h("span", { class: "tag" }, "Not queryable"));
      cells.set(s, st);
      return h("tr", {},
        h("td", {}, h("a", { href: s.url, target: s.url.startsWith("http") ? "_blank" : null, rel: "noopener noreferrer" }, h("b", {}, s.n)), h("span", { class: "sub" }, s.owner)),
        h("td", {}, s.use), h("td", {}, h("span", { class: s.lvl === 3 ? "tag info" : "tag" }, HOW[s.lvl])), h("td", {}, s.fresh), st, h("td", { class: "s-muted", style: "font-size:12.5px" }, s.note || "—"));
    })));
  $("sources").replaceChildren(t);
  const res = await Promise.all(SRC.map(async (s) => {
    if (!s.probe) return null;
    const r = await probe(s.probe);
    cells.get(s).replaceChildren(h("span", { class: r.ok ? "tag ok" : "tag bad" }, r.ok ? "Answering" : "Not answering"), h("span", { class: "sub", style: "margin-top:4px" }, `${r.msg}${r.ms != null ? " · " + r.ms + " ms" : ""}`));
    return r.ok;
  }));
  const tested = res.filter((x) => x !== null), up = tested.filter(Boolean).length;
  $("ribbon").replaceChildren(h("span", {}, h("span", { class: "dot", "data-s": up === tested.length ? "on" : "warn" }), h("b", {}, `${up} of ${tested.length} live sources answering`), ` · checked ${new Date().toLocaleTimeString("en-US", { timeZone: "Pacific/Honolulu", hour: "numeric", minute: "2-digit" })} HST from this browser · every source is public and needs no key`));
}
$("recheck").onclick = renderSources;
renderSources();

/* ---------------- coverage, past events ---------------- */
(async () => {
  const [exp, svi] = await Promise.allSettled([loadExposure(), fetchSVI({ geometry: false })]);
  const E = exp.status === "fulfilled" ? exp.value : null;
  const tracts = svi.status === "fulfilled" ? rankTracts(svi.value) : [];
  const n = E ? Object.keys(E.tracts).length : 0;
  const k = (l, v, sub) => h("div", {}, h("div", { class: "l" }, l), h("div", { class: "v" }, v), h("div", { class: "s" }, sub));
  $("goals").replaceChildren(
    k("Census tracts mapped", E ? `${n} of ${n}` : "–", "every populated 2020 tract, all four hazards"),
    k("Hazards", "4 of 4", "hurricane, wildfire, tsunami, flood"),
    k("Counties with shelter data", "4 of 4", "3 county services; Maui from FEMA's registry"),
    k("CMIST areas with a source", "5 of 5", "SVI for C, I, S, T; emPOWER for M"),
    k("Past shelter counts checked", "5", "Hurricane Lane 2018; Maui wildfires 2023"));

  if (E) {
    const rows = COUNTY_LIST.map((c) => {
      const t = Object.entries(E.tracts).filter(([f]) => f.startsWith(c.fips)).map(([, v]) => v);
      const s = (key) => t.reduce((a, v) => a + v[key], 0);
      return { c, n: t.length, pop: s("pop20"), tsunami: s("tsunami"), wildfire: s("wildfire"), flood: s("flood") };
    });
    const cell = (v, pop) => h("td", { class: "num" }, fmt(v), h("div", { class: "s-muted", style: "font-size:11px" }, pc(v / pop)));
    const t = h("table", { class: "s-t" },
      h("thead", {}, h("tr", {}, ["County", "Tracts", "Residents (2020)", "Hurricane", "Tsunami zone", "High fire-risk area", "FEMA flood zone"].map((x, i) => h("th", { class: i ? "r" : null }, x)))),
      h("tbody", {}, rows.map((r) => h("tr", {}, h("td", {}, h("b", {}, r.c.long)), h("td", { class: "num" }, r.n), h("td", { class: "num" }, fmt(r.pop)), cell(r.pop, r.pop), cell(r.tsunami, r.pop), cell(r.wildfire, r.pop), cell(r.flood, r.pop)))));
    $("coverage").replaceChildren(t);
    $("covSrc").textContent = (`Method: ${E.method} Processed ${new Date(E.generated).toLocaleDateString("en-US", { dateStyle: "medium" })} from ${E.sources.map((s) => `${s.n} (${fmt(s.count)} features)`).join("; ")}. Kalawao County (82 residents) is included in state totals. Statewide: ${fmt(E.totals.pop20)} residents, matching the 2020 Census count.`);
  }

  if (tracts.length) {
    const rows = backtest(tracts);
    const t = h("table", { class: "s-t" },
      h("thead", {}, h("tr", {}, ["Event", "Area", "Published", "Model likely (range)", "Turnout observed / assumed", "Result", "Source"].map((x, i) => h("th", { class: i >= 2 && i <= 4 ? "r" : null }, x)))),
      h("tbody", {}, rows.map((r) => h("tr", {},
        h("td", {}, h("b", {}, r.name), h("div", { class: "s-muted", style: "font-size:12px" }, r.date)), h("td", {}, r.place),
        h("td", { class: "num" }, fmt(r.published)), h("td", { class: "num" }, `${fmt(r.likely)} (${fmt(r.low)}–${fmt(r.high)})`),
        h("td", { class: "num" }, `${rate(r.observed)} / ${rate(r.assumed)}`),
        h("td", {}, h("span", { class: r.inside ? "tag ok" : "tag warn" }, r.verdict), r.context ? h("div", { class: "s-muted", style: "font-size:12px" }, r.context) : null),
        h("td", {}, h("a", { href: r.url, target: "_blank", rel: "noopener noreferrer", title: r.quote }, "Open ↗"))))));
    $("backtest").replaceChildren(h("div", { class: "panel-b s-note", style: "border-bottom:1px solid var(--s-line2)" }, reading(rows)), h("div", { class: "s-tw" }, t),
      h("p", { class: "s-src" }, "The Near miss intensity in the Event planner uses the highest turnout observed per hazard in this table."));
  }
})();

/* ---------------- warning-outlook model check ---------------- */
loadModel().then((m) => {
  const DRV = { gust: ["stronger gusts", "weaker gusts"], wind: ["stronger winds", "lighter winds"], rhmin: ["more humid air", "drier air"], vpd: ["drier air", "moister air"], rain: ["heavier rain", "less rain"], rainh: ["longer spells of rain", "rain in short, intense bursts"], rain3: ["wet ground from the days before", "dry days before"], dry14: ["a wet fortnight", "a dry fortnight"], tmax: ["hotter days", "cooler days"] };
  const p0 = (x) => Math.round(x * 100) + "%";
  $("olCheck").replaceChildren(h("table", { class: "s-t" },
    h("thead", {}, h("tr", {}, ["Warning predicted", "Warning days in test", "Ranks a warning day above a quiet day", "Better than the seasonal average", "Warning days it rated elevated or high", "Days it rated high that had the warning", "What raises the chance"].map((c, i) => h("th", { class: i > 0 && i < 6 ? "r" : null }, c)))),
    h("tbody", {}, OUTLOOK_HAZARDS.map((z) => {
      const M = m.models[z.k], t = M.test;
      return h("tr", {},
        h("td", {}, h("b", {}, M.label), h("span", { class: "sub" }, `${z.n} · rehearses the ${z.plan} plan`)),
        h("td", { class: "num" }, fmt(t.events), h("span", { class: "sub" }, `of ${fmt(t.days)} county-days`)),
        h("td", { class: "num" }, p0(t.auc), h("span", { class: "sub" }, "AUC; 50% is a coin toss")),
        h("td", { class: "num" }, t.skill > 0 ? p0(t.skill) : "No", h("span", { class: "sub" }, "Brier skill score")),
        h("td", { class: "num" }, t.events ? `${fmt(t.caughtElevated)} of ${fmt(t.events)}` : "–"),
        h("td", { class: "num" }, t.flaggedHigh ? `${fmt(t.hitsHigh)} of ${fmt(t.flaggedHigh)}` : "none rated high"),
        h("td", {}, M.drivers.filter((d) => DRV[d.k]).slice(0, 3).map((d) => DRV[d.k][d.dir === "up" ? 0 : 1]).join("; ")));
    }))));
  $("olRel").replaceChildren(h("div", { class: "s-grid3" }, OUTLOOK_HAZARDS.map((z) => {
    const b = m.models[z.k].test.bins, top = Math.max(0.05, ...b.map((x) => Math.max(x.predicted || 0, x.observed || 0)));
    return h("div", {}, h("h3", { class: "s-h3" }, `${m.models[z.k].label}: predicted vs what happened`),
      h("div", { class: "rel", role: "img", "aria-label": b.map((x) => `${p0(x.lo)}–${p0(x.hi)}: predicted ${x.predicted == null ? "none" : p0(x.predicted)}, observed ${x.observed == null ? "none" : p0(x.observed)}, ${x.n} days`).join("; ") },
        b.map((x) => h("div", { title: `${x.n} days` }, h("i", { class: "p", style: `height:${((x.predicted || 0) / top) * 100}%` }), h("i", { class: "o", style: `height:${((x.observed || 0) / top) * 100}%` })))),
      h("div", { class: "rel-l" }, b.map((x) => h("span", {}, `${p0(x.lo)}+`))));
  })), h("p", { class: "s-src", style: "padding:8px 0 0" }, "Light bar: average chance the model gave. Dark bar: share of those days that really had the warning. Close bars mean the percentages can be taken at face value."));
  $("olMeth").textContent = `Trained ${m.train.from} to ${m.train.to} (${fmt(m.train.rows)} county-days), tested ${m.test.from} to ${m.test.to} (${fmt(m.test.rows)}). ${m.method} Inputs: the forecast actually issued for each day at 4–6 points per county (Open-Meteo forecast archive) and the rain in the days before. Labels: every NWS Honolulu watch and warning in the period (Iowa Environmental Mesonet). Retrain with node scripts/train-outlook.mjs. It scores weather, never people, and issues no alerts.`;
}).catch(() => $("olCheck").replaceChildren(h("p", { class: "s-empty", style: "margin:14px" }, "The model file did not load.")));

/* ---------------- data in this browser (governance) ---------------- */
// Every key AllReady writes, described in plain words. Anything unrecognised is still listed.
const LOCAL = [
  [/^allready\.markup\./, "Map markup", "Shapes, icons and notes drawn on the Live map; may include facility or agency points of contact", "Planner entry. Organisations and facilities only, never residents", "Until you delete it"],
  [/^allready\.partners\./, "Partner commitments", "What partner organisations committed after a call (Coordination)", "Planner entry. The form refuses phone numbers, emails and ID numbers", "Until you remove it; flagged for re-confirmation after 30 days"],
  [/^allready\.supply\./, "Supply counts entered on the map", "Resource counts a planner typed in during an event", "Planner entry. Counts only", "Until you clear it"],
  [/^allready\.shelters\.last\./, "Last shelter list per county", "A copy of each county's public shelter feed: reused for 5 minutes so pages do not re-ask, and shown if the feed stops answering", "Public facility records", "Replaced on every successful read"],
  [/^allready\.wx\./, "Weather grid", "The last weather readings for the map layers", "Public", "30 minutes"],
  [/^allready\.outlook\./, "Forecast for the warning outlook", "The last 7-day forecast the model read", "Public", "60 minutes"],
  [/^allready\.scenario\./, "Current what-if", "County, hazard and intensity, shared by the Event planner and the Live map", "Settings", "Until changed"],
  [/^allready\.(ws|insights)\./, "Panel layout", "How the Live map and Insights panels are arranged", "Settings", "Until changed"],
  [/^allready\.(v\d+|theme|lang|guide)/, "Preferences", "Layers, light or dark, language, and which guides you hid", "Settings", "Until changed"],
];
function renderLocal() {
  let keys = []; try { keys = Object.keys(localStorage).filter((k) => k.startsWith("allready.")).sort(); } catch { /* storage blocked */ }
  const size = (k) => { try { return (localStorage.getItem(k) || "").length; } catch { return 0; } };
  const groups = new Map();
  for (const k of keys) { const d = LOCAL.find(([re]) => re.test(k)) || [null, "Other setting", k, "Settings", "Until changed"]; const g = groups.get(d[1]) || { d, keys: [] }; g.keys.push(k); groups.set(d[1], g); }
  const kb = (n) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`);
  $("local").replaceChildren(!keys.length ? h("p", { class: "s-empty", style: "margin:16px" }, "Nothing is stored in this browser.") : h("table", { class: "s-t" },
    h("thead", {}, h("tr", {}, ["Item", "What it holds", "Kind of data", "Kept", "Size", ""].map((c, i) => h("th", { class: i === 4 ? "r" : null }, c)))),
    h("tbody", {}, [...groups.values()].map(({ d, keys: ks }) => h("tr", {},
      h("td", {}, h("b", {}, d[1])), h("td", {}, d[2]), h("td", {}, d[3]), h("td", {}, d[4]),
      h("td", { class: "num" }, kb(ks.reduce((t, k) => t + size(k), 0))),
      h("td", { class: "no-print" }, h("button", { class: "s-btn sm", type: "button", "aria-label": `Clear ${d[1]}`, onclick: () => {
        if (/markup|commitments|Supply/.test(d[1]) && !confirm(`Delete ${d[1].toLowerCase()} from this browser? This cannot be undone. Export first if you need a copy.`)) return;
        ks.forEach((k) => { try { localStorage.removeItem(k); } catch {} }); renderLocal();
      } }, "Clear")))))));
}
$("clearAll").onclick = () => {
  if (!confirm("Delete everything AllReady has stored in this browser, including map markup and partner commitments? This cannot be undone. Export first if you need a copy.")) return;
  try { Object.keys(localStorage).filter((k) => k.startsWith("allready.")).forEach((k) => localStorage.removeItem(k)); } catch {}
  renderLocal();
};
renderLocal();

/* ---------------- factors ---------------- */
{
  const NAMES = { afnUplift: "AFN over-representation in shelters", space: "Shelter floor space", spaceAfn: "Floor space, AFN resident", water: "Drinking water", waterOps: "Water, all uses", meals: "Meals", cots: "Cots", blankets: "Blankets", dialysisSessions: "Dialysis", interpreter: "Interpreters", shifts: "Shifts", liftCapacity: "Lift-equipped van", ambulatoryPerRun: "Transport run", staffRatio: "Shelter staffing", petHouseholds: "Pet-owning households", petsPerHousehold: "Animals per household", generatorPerShelter: "Generators" };
  const rows = [];
  for (const [k, v] of Object.entries(FACTORS)) {
    if (v.v != null) rows.push([NAMES[k] || k, v]);
    else for (const [hz, f] of Object.entries(v)) rows.push([`${k === "evac" ? "Evacuate" : "Go to a public shelter"} — ${hz}`, f]);
  }
  rows.push(["Shelter demand range", { v: `${SHELTER_RANGE.low}× – ${SHELTER_RANGE.high}×`, u: "of the likely figure", src: SHELTER_RANGE.src, std: false, note: "Shelter turnout is the least certain number in mass-care planning." }]);
  const t = h("table", { class: "s-t" },
    h("thead", {}, h("tr", {}, ["Factor", "Value", "Source", "Type", "Note"].map((x, i) => h("th", { class: i === 1 ? "r" : null }, x)))),
    h("tbody", {}, rows.map(([n, f]) => h("tr", {}, h("td", {}, h("b", {}, n)), h("td", { class: "num" }, typeof f.v === "number" && f.v < 1 && f.v > 0 ? pc(f.v, 0) : f.v, h("div", { class: "s-muted", style: "font-size:11px" }, f.u)), h("td", {}, f.src), h("td", {}, h("span", { class: f.std ? "tag ok" : "tag hyp" }, f.std ? "Published" : "Assumption")), h("td", { class: "s-muted", style: "font-size:12.5px" }, f.note || "—")))));
  $("factors").replaceChildren(t);
}
