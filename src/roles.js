/* AllReady — Partners & roles. MIT licensed.
   Roles matrix, communication pathways and the partner capacity register (see src/match.js). */

import "./site.css";
import { mountTopBar } from "./nav.js";
import { FUNCTIONS, PLEDGE_TYPES, PLEDGE_NAME, pledges, addPledge, removePledge, savePledges, piiProblem, ageDays, STALE_DAYS, toCSV, fromCSV } from "./match.js";
import { COUNTY_LIST } from "./exposure.js";
import { LANGS_ALL } from "./scenario.js";

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

mountTopBar($("top"), "roles", "Partners & roles");

/* ---------------- roles matrix ---------------- */
{
  const t = h("table", { class: "s-t" },
    h("thead", {}, h("tr", {}, ["Function", "CMIST", "Lead", "Support", "State role", "Trigger", "How residents hear"].map((c) => h("th", {}, c)))),
    h("tbody", {}, FUNCTIONS.map((r) => h("tr", {},
      h("td", {}, h("b", {}, r.f)),
      h("td", {}, r.cm === "—" ? h("span", { class: "s-muted" }, "all") : h("span", { class: "cmk", style: `background:var(--c-${r.cm})` }, r.cm)),
      h("td", {}, h("span", { class: "tag info" }, r.lead)),
      h("td", {}, r.sup), h("td", {}, r.state), h("td", {}, r.trig), h("td", {}, r.ch)))));
  $("roles").replaceChildren(h("div", { class: "s-tw" }, t));
}

/* ---------------- pathways ---------------- */
{
  const step = (n, title, items, color) => h("div", { class: "s-card", style: `border-top:4px solid ${color};padding-top:14px` },
    h("p", { class: "s-eyebrow", style: `color:${color};margin-bottom:6px` }, "Step " + n), h("h3", { style: "font-size:15px" }, title),
    h("ul", { style: "margin:8px 0 0;padding-left:18px;font-size:13px;color:var(--s-ink2)" }, items.map((i) => h("li", {}, i))));
  $("paths").replaceChildren(
    step(1, "Forecast and warning", ["NWS Honolulu: watches and warnings", "Central Pacific Hurricane Center", "Pacific Tsunami Warning Center", "AllReady reads these live (Live map)"], "var(--h-tsunami)"),
    step(2, "State (supports)", ["HI-EMA State Emergency Operations Center", "DHS as ESF-6 co-lead for mass care", "Shares the AFN picture with the county", "Fills resource requests; FEMA if exhausted"], "var(--h-hurricane)"),
    step(3, "County (leads)", ["County emergency management agency", "Opens shelters and orders evacuation", "Issues protective-action messages", "Requests State support"], "var(--s-brand)"),
    step(4, "Partners", ["Red Cross, Salvation Army, Hawaiʻi VOAD", "Healthcare coalition and DOH", "Paratransit and humane societies", "Aloha United Way 211"], "var(--c-T)"),
    step(5, "Residents", ["Wireless alert, sirens, radio, TV", "Trusted messengers: churches, community groups", "Every language of the affected tracts", "Audible, visual and text formats"], "var(--c-M)"));
  $("langs").replaceChildren(...LANGS_ALL.map((l) => h("span", { class: "tag" }, l)), h("span", { class: "tag info" }, "ASL / captioning"), h("span", { class: "tag info" }, "Plain language / easy read"));
  $("langNote").textContent = "Languages named in the DHS brief and the decision points on Scenarios. Translations need native-speaker review before use; Chuukese and Marshallese messages should be routed to human translators.";
}

/* ---------------- partner capacity register ---------------- */
$("ptype").append(...PLEDGE_TYPES.map(([k, n, u]) => h("option", { value: k }, `${n} (${u})`)));
$("pcounty").append(...COUNTY_LIST.map((c) => h("option", { value: c.fips }, c.long)), h("option", { value: "state" }, "Statewide (needs inter-island lift)"));
$("form").confirmed.value = new Date().toISOString().slice(0, 10);

function renderList() {
  const list = pledges();
  if (!list.length) {
    $("summary").replaceChildren();
    $("list").replaceChildren(h("div", { class: "s-empty" }, "No pledges recorded yet. Add what a partner has confirmed after a call, or import a CSV from a partner. Nothing here is example data."));
    return;
  }
  // Summary: current capacity by county and resource
  const by = {};
  for (const p of list) { if (ageDays(p.confirmed) > STALE_DAYS) continue; const k = p.county + "|" + p.type; by[k] = (by[k] || 0) + (+p.qty || 0); }
  const counties = [...new Set(list.map((p) => p.county))];
  const types = [...new Set(list.map((p) => p.type))];
  const sum = h("table", { class: "s-t" },
    h("thead", {}, h("tr", {}, h("th", {}, "Current capacity"), counties.map((c) => h("th", { class: "r" }, cname(c))))),
    h("tbody", {}, types.map((t) => h("tr", {}, h("td", {}, h("b", {}, PLEDGE_NAME[t].n), h("span", { class: "s-muted" }, " " + PLEDGE_NAME[t].u)), counties.map((c) => h("td", { class: "num" }, by[c + "|" + t] ? fmt(by[c + "|" + t]) : "–"))))));
  $("summary").replaceChildren(h("div", { class: "s-tw" }, sum), h("p", { class: "s-src" }, `Pledges confirmed more than ${STALE_DAYS} days ago are left out of current capacity and shown as stale below. The Scenarios page counts current pledges against each gap.`));

  const t = h("table", { class: "s-t" },
    h("thead", {}, h("tr", {}, ["Organisation", "Resource", "County", "Quantity", "Confirmed", ""].map((c, i) => h("th", { class: i === 3 ? "r" : null }, c)))),
    h("tbody", {}, list.slice().sort((a, b) => (b.confirmed || "").localeCompare(a.confirmed || "")).map((p) => {
      const age = ageDays(p.confirmed), stale = age > STALE_DAYS;
      return h("tr", {},
        h("td", {}, h("b", {}, p.partner), p.role ? h("div", { class: "s-muted", style: "font-size:12px" }, p.role) : null, p.notes ? h("div", { class: "s-muted", style: "font-size:12px" }, p.notes) : null),
        h("td", {}, PLEDGE_NAME[p.type]?.n || p.type), h("td", {}, cname(p.county)),
        h("td", { class: "num" }, fmt(+p.qty || 0)),
        h("td", {}, p.confirmed, " ", h("span", { class: stale ? "tag warn" : "tag ok" }, stale ? `stale · ${age} d` : `${age} d ago`)),
        h("td", { class: "no-print" }, h("button", { class: "s-btn sm", type: "button", "aria-label": `Remove ${p.partner} ${PLEDGE_NAME[p.type]?.n}`, onclick: () => { removePledge(p.id); renderList(); } }, "Remove")));
    })));
  $("list").replaceChildren(h("div", { class: "s-tw" }, t));
}

$("form").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.target, p = { partner: f.partner.value.trim(), type: f.type.value, county: f.county.value, qty: +f.qty.value, confirmed: f.confirmed.value, role: f.role.value.trim(), notes: f.notes.value.trim() };
  const bad = !p.partner ? "Name the organisation." : !(p.qty > 0) ? "Quantity must be a positive number." : piiProblem(`${p.partner} ${p.role} ${p.notes}`);
  $("formMsg").textContent = bad;
  if (bad) return;
  addPledge(p); f.qty.value = ""; f.notes.value = ""; $("formMsg").textContent = `Added ${PLEDGE_NAME[p.type].n} for ${cname(p.county)}.`;
  renderList();
});
$("exp").onclick = () => {
  const a = h("a", { href: URL.createObjectURL(new Blob([toCSV()], { type: "text/csv;charset=utf-8" })), download: "allready-partner-pledges.csv" });
  document.body.append(a); a.click(); a.remove();
};
$("imp").onchange = async (e) => {
  const file = e.target.files?.[0]; if (!file) return;
  const { rows, errors } = fromCSV(await file.text());
  savePledges([...pledges(), ...rows.map((r) => ({ id: Math.random().toString(36).slice(2, 10), ...r }))]);
  $("formMsg").textContent = `Imported ${rows.length} pledge${rows.length === 1 ? "" : "s"}.${errors.length ? " Skipped: " + errors.slice(0, 3).join("; ") + (errors.length > 3 ? "…" : "") : ""}`;
  e.target.value = ""; renderList();
};
renderList();
