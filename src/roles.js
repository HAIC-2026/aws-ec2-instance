/* AllReady — Coordination. MIT licensed.
   Commitments measured against need, the partner commitment register, roles by function, and
   how a warning reaches a resident. Data and rules live in src/match.js. */

import "./site.css";
import { mountTopBar } from "./nav.js";
import { FUNCTIONS, PLEDGE_TYPES, PLEDGE_NAME, pledges, addPledge, removePledge, savePledges, piiProblem, ageDays, STALE_DAYS, toCSV, fromCSV, pledgedSupply, who } from "./match.js";
import { COUNTY_LIST, loadExposure, zoneArea } from "./exposure.js";
import { LANGS_ALL } from "./scenario.js";
import { fetchSVI, rankTracts } from "./svi.js";
import { loadEmpower } from "./empower.js";
import { loadShelters } from "./shelters.js";
import { plan, HAZARDS } from "./model.js";

const $ = (id) => document.getElementById(id);
function h(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = v; else if (k.startsWith("on")) n.addEventListener(k.slice(2), v); else n.setAttribute(k, String(v));
  }
  for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(String(c)));
  return n;
}
const fmt = (n) => Math.round(n).toLocaleString("en-US");
const cname = (f) => (f === "state" ? "Statewide" : COUNTY_LIST.find((c) => c.fips === f)?.n || f);

mountTopBar($("top"), "roles", "ESF-6 planning");

/* ---------------- roles by function ---------------- */
$("roles").replaceChildren(h("table", { class: "s-t" },
  h("thead", {}, h("tr", {}, ["Function", "Lead", "Support", "State role", "Trigger", "How residents hear"].map((c) => h("th", {}, c)))),
  h("tbody", {}, FUNCTIONS.map((r) => h("tr", {},
    h("td", {}, h("span", { style: "display:flex;gap:9px;align-items:flex-start" }, r.cm === "—" ? h("span", { class: "chip", style: "background:var(--s-ink3)", title: "All CMIST areas" }, "·") : h("span", { class: "chip", style: `background:var(--c-${r.cm})` }, r.cm), h("b", {}, r.f))),
    h("td", {}, h("b", {}, r.lead)), h("td", {}, r.sup), h("td", {}, r.state), h("td", {}, r.trig), h("td", {}, r.ch))))));

/* ---------------- warning path ---------------- */
{
  const step = (n, title, items) => h("div", {}, h("h3", {}, h("i", {}, n), title), h("ul", {}, items.map((i) => h("li", {}, i))));
  $("paths").replaceChildren(
    step(1, "Forecast and warning", ["NWS Honolulu watches and warnings", "Central Pacific Hurricane Center", "Pacific Tsunami Warning Center"]),
    step(2, "State supports", ["HI-EMA State Emergency Operations Center", "DHS, ESF-6 co-lead for mass care", "Shares the AFN picture; fills requests"]),
    step(3, "County leads", ["County emergency management agency", "Opens shelters, orders evacuation", "Issues protective-action messages"]),
    step(4, "Partners act", ["Red Cross, Salvation Army, Hawaiʻi VOAD", "Healthcare coalition, paratransit, humane societies", "Aloha United Way 211"]),
    step(5, "Residents act", ["Wireless alert, sirens, radio, TV", "Trusted messengers: churches, community groups", "Audible, visual and text formats"]));
  $("langs").replaceChildren(...LANGS_ALL.map((l) => h("span", { class: "tag" }, l)), h("span", { class: "tag info" }, "ASL and captioning"), h("span", { class: "tag info" }, "Plain language"));
  $("langNote").textContent = "Languages named in the DHS brief and used in the Event planner's decision points. Machine translations need native-speaker review before use.";
}

/* ---------------- commitments register ---------------- */
$("ptype").append(...PLEDGE_TYPES.map(([k, n, u]) => h("option", { value: k }, `${n} (${u})`)));
$("pcounty").append(...COUNTY_LIST.map((c) => h("option", { value: c.fips }, c.long)), h("option", { value: "state" }, "Statewide (needs inter-island transport)"));
$("form").confirmed.value = new Date().toISOString().slice(0, 10);

function renderList() {
  const list = pledges();
  if (!list.length) {
    $("list").replaceChildren(h("p", { class: "s-empty", style: "margin:16px" }, "No commitments recorded yet. Add what a partner confirms after a call, or import a partner's CSV. Nothing here is example data."));
  } else {
    $("list").replaceChildren(h("table", { class: "s-t" },
      h("thead", {}, h("tr", {}, ["Organisation", "Resource", "County", "Quantity", "Confirmed", ""].map((c, i) => h("th", { class: i === 3 ? "r" : null }, c)))),
      h("tbody", {}, list.slice().sort((a, b) => (b.confirmed || "").localeCompare(a.confirmed || "")).map((p) => {
        const age = ageDays(p.confirmed), stale = age > STALE_DAYS;
        return h("tr", {},
          h("td", {}, h("b", {}, p.partner), p.role || p.notes ? h("span", { class: "sub" }, [p.role, p.notes].filter(Boolean).join(" · ")) : null),
          h("td", {}, PLEDGE_NAME[p.type]?.n || p.type), h("td", {}, cname(p.county)),
          h("td", { class: "num" }, fmt(+p.qty || 0), h("span", { class: "sub" }, PLEDGE_NAME[p.type]?.u)),
          h("td", {}, p.confirmed, h("span", { class: "sub" }, h("span", { class: stale ? "tag warn" : "tag ok" }, stale ? `Re-confirm · ${age} days` : `${age} days ago`))),
          h("td", { class: "no-print" }, h("button", { class: "s-btn sm", type: "button", "aria-label": `Remove ${p.partner} ${PLEDGE_NAME[p.type]?.n}`, onclick: () => { removePledge(p.id); renderList(); renderCoverage(); } }, "Remove")));
      }))));
  }
}

$("form").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.target, p = { partner: f.partner.value.trim(), type: f.type.value, county: f.county.value, qty: +f.qty.value, confirmed: f.confirmed.value, role: f.role.value.trim(), notes: f.notes.value.trim() };
  const bad = !p.partner ? "Name the organisation." : !(p.qty > 0) ? "Quantity must be a positive number." : piiProblem(`${p.partner} ${p.role} ${p.notes}`);
  $("formMsg").textContent = bad;
  if (bad) return;
  addPledge(p); f.qty.value = ""; f.notes.value = ""; $("formMsg").textContent = `Added: ${PLEDGE_NAME[p.type].n}, ${cname(p.county)}.`;
  renderList(); renderCoverage();
});
$("exp").onclick = () => {
  const a = h("a", { href: URL.createObjectURL(new Blob([toCSV()], { type: "text/csv;charset=utf-8" })), download: "allready-partner-commitments.csv" });
  document.body.append(a); a.click(); a.remove();
};
$("imp").onchange = async (e) => {
  const file = e.target.files?.[0]; if (!file) return;
  if (file.size > 1_000_000) { $("formMsg").textContent = "That file is larger than 1 MB; a commitments CSV should be a few kilobytes."; return; }
  const { rows, errors } = fromCSV(await file.text());
  savePledges([...pledges(), ...rows.map((r) => ({ id: Math.random().toString(36).slice(2, 10), ...r }))]);
  $("formMsg").textContent = `Imported ${rows.length} commitment${rows.length === 1 ? "" : "s"}.${errors.length ? " Skipped: " + errors.slice(0, 3).join("; ") + (errors.length > 3 ? "…" : "") : ""}`;
  e.target.value = ""; renderList(); renderCoverage();
};
renderList();

/* ---------------- commitments against need ---------------- */
const D = { tracts: [], exp: null, emp: null, shelters: [] };
const CV = { county: "15009", hazard: "wildfire" };
$("cvCounty").append(...COUNTY_LIST.map((c) => h("option", { value: c.fips }, c.long)));
$("cvHazard").append(...HAZARDS.map((z) => h("option", { value: z.k }, z.n)));
$("cvCounty").value = CV.county; $("cvHazard").value = CV.hazard;
$("cvCounty").onchange = (e) => { CV.county = e.target.value; renderCoverage(); };
$("cvHazard").onchange = (e) => { CV.hazard = e.target.value; renderCoverage(); };

function renderCoverage() {
  if (!D.tracts.length || !D.exp) return;
  const area = zoneArea(D.tracts, D.exp, CV.hazard, CV.county);
  const p = plan({ hazard: CV.hazard, area, emp: D.emp, shelters: D.shelters, fipsFilter: [CV.county] });
  const got = pledgedSupply(CV.county);
  const rows = PLEDGE_TYPES.map(([k, n, u]) => {
    const line = p.resources.find((x) => x.k === k);
    return { k, n, u, need: line?.need || 0, have: got[k]?.qty || 0, latest: got[k]?.latest, state: got[k]?.statewide || 0 };
  }).filter((r) => r.need > 0);
  $("coverage").replaceChildren(h("table", { class: "s-t" },
    h("thead", {}, h("tr", {}, ["Resource", "Needed", "Committed", "Covered", "Next step"].map((c, i) => h("th", { class: i === 1 || i === 2 ? "r" : null }, c)))),
    h("tbody", {}, rows.map((r) => {
      const share = r.need ? Math.min(1, r.have / r.need) : 0, w = who(r.k, CV.county);
      return h("tr", {},
        h("td", {}, h("b", {}, r.n), h("span", { class: "sub" }, r.u)),
        h("td", { class: "num" }, fmt(r.need)),
        h("td", { class: "num" }, r.have ? fmt(r.have) : "–", r.state ? h("span", { class: "sub" }, `${fmt(r.state)} statewide`) : null),
        h("td", {}, h("div", { style: "display:flex;gap:10px;align-items:center" }, h("div", { class: "bar", style: "flex:1" }, h("i", { style: `width:${(share * 100).toFixed(0)}%;--b:${share >= 1 ? "var(--s-ok)" : share > 0 ? "var(--s-warn)" : "var(--s-line)"}` })), h("span", { class: "num", style: "min-width:42px;text-align:right" }, `${Math.round(share * 100)}%`))),
        h("td", {}, share >= 1 ? h("span", { class: "tag ok" }, "Covered") : [h("b", {}, w.org), h("span", { class: "sub" }, w.ask)]));
    }))));
}

(async () => {
  const [svi, exp, emp, shel] = await Promise.allSettled([fetchSVI({ geometry: false }), loadExposure(), loadEmpower(), loadShelters()]);
  if (svi.status === "fulfilled") D.tracts = rankTracts(svi.value);
  if (exp.status === "fulfilled") D.exp = exp.value;
  if (emp.status === "fulfilled") D.emp = emp.value;
  if (shel.status === "fulfilled") D.shelters = shel.value.shelters || [];
  if (!D.tracts.length || !D.exp) { $("coverage").replaceChildren(h("p", { class: "s-empty", style: "margin:16px" }, "Census tracts or hazard zones did not load. Reload to try again.")); return; }
  renderCoverage();
})();
