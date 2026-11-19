/* AllReady — match needs to the organisations that meet them. MIT licensed.

   Part 3 of the DHS framework: "connect needs to resources … with clear roles". Three things
   live here, used by the Scenarios and Partners & roles pages:

   1. WHO — for every resource line, which organisation a planner would call to confirm supply.
      Organisation names are public. Every assignment is a PROPOSAL to be confirmed with the
      county: counties lead mass care and own these relationships.
   2. FUNCTIONS — the roles matrix: lead, support, State role, trigger, public channel.
   3. The partner capacity register — pledges a planner records after a call ("Red Cross can
      stand up 400 cots on Maui, confirmed 12 Nov"). Organisation-level only, stored in this
      browser, exportable as CSV. It never holds a resident, a name or a personal number. */

export const COUNTY_ORGS = {
  "15003": { ema: "Honolulu Dept. of Emergency Management", para: "TheHandi-Van (Honolulu DTS)", humane: "Hawaiian Humane Society", power: "Hawaiian Electric" },
  "15001": { ema: "Hawaiʻi County Civil Defense Agency", para: "Hele-On paratransit (Mass Transit Agency)", humane: "Hawaiʻi Island Humane Society", power: "Hawaiian Electric" },
  "15009": { ema: "Maui Emergency Management Agency", para: "Maui Bus ADA Paratransit", humane: "Maui Humane Society", power: "Hawaiian Electric" },
  "15007": { ema: "Kauaʻi Emergency Management Agency", para: "Kauaʻi Bus paratransit", humane: "Kauaʻi Humane Society", power: "Kauaʻi Island Utility Cooperative" },
};
const ORG = (fips) => COUNTY_ORGS[fips] || { ema: "County emergency management agency", para: "County paratransit", humane: "County humane society", power: "Electric utility" };

/** Who to call to confirm supply for each resource line. */
export function who(k, fips) {
  const o = ORG(fips);
  const W = {
    space: [o.ema, "Shelter capacity per site"],
    people: [o.ema, "Shelter capacity per site"],
    accessible: [o.ema, "ADA accessibility per site"],
    hardened: [o.ema + " with HI-EMA", "Wind-hardening status per site"],
    power: [o.ema, "Backup power per site"],
    generators: ["HI-EMA logistics with " + o.ema, "Generators that can be staged"],
    cots: ["American Red Cross Pacific Islands Region", "Cots that can be deployed to this county"],
    blankets: ["American Red Cross Pacific Islands Region", "Blanket and comfort-kit stock"],
    water: ["Hawaiʻi VOAD and The Salvation Army", "Water that can be delivered per day"],
    meals: ["The Salvation Army Hawaiian & Pacific Islands Division", "Meals per day, mobile feeding"],
    dialysis: ["Healthcare Association of Hawaiʻi (healthcare coalition) with DOH", "Dialysis chairs and surge sessions"],
    oxygen: ["Hawaiʻi Department of Health with DME suppliers", "Oxygen resupply and concentrator power"],
    interpreters: ["State Office of Language Access and community organisations", "Interpreters by language, per shift"],
    lift: [o.para, "Lift-equipped vehicles and drivers"],
    transport: [o.para + " and county transit", "Accessible and standard vehicles"],
    pets: [o.humane, "Animal crates and co-located pet spaces"],
    staff: ["American Red Cross and Hawaiʻi VOAD", "Trained shelter staff per shift"],
  };
  const [org, ask] = W[k] || [o.ema, "Confirm supply"];
  return { org, ask };
}

/** Roles matrix. Lead/support follow the county-led, State-supported model; all are proposals. */
export const FUNCTIONS = [
  { f: "Open and run shelters", cm: "—", lead: "County EMA", sup: "American Red Cross; The Salvation Army; Hawaiʻi VOAD", state: "HI-EMA and DHS (ESF-6) fill shortfalls; mutual aid", trig: "Warning issued / evacuation ordered", ch: "Wireless alert, radio, TV, county site" },
  { f: "Accessible shelter space (ADA)", cm: "I", lead: "County EMA", sup: "Red Cross disability integration staff; Disability and Communication Access Board (advice)", state: "DHS coordinates AFN service providers", trig: "Shelter roster confirmed", ch: "Shelter listings that say which sites are accessible" },
  { f: "Power for medical equipment", cm: "M", lead: "County EMA with DOH", sup: "Electric utility; DME suppliers; health plans", state: "HI-EMA stages generators; emPOWER ZIP counts guide priority", trig: "Watch issued; outage forecast", ch: "Health-plan and provider outreach" },
  { f: "Dialysis continuity", cm: "M", lead: "DOH", sup: "Healthcare Association of Hawaiʻi coalition; dialysis providers", state: "HI-EMA transport support", trig: "Watch issued", ch: "Provider-to-patient notification" },
  { f: "Language access", cm: "C", lead: "County EMA", sup: "State Office of Language Access; community and faith organisations", state: "DHS supports multilingual messaging", trig: "Any public protective-action message", ch: "Messages in the languages of the affected tracts, through trusted messengers" },
  { f: "Accessible transport", cm: "T", lead: "County transit / paratransit", sup: "HDOT; school bus contractors", state: "HI-EMA coordinates inter-island lift", trig: "Warning issued; before winds or water close roads", ch: "Direct outreach through existing service rosters" },
  { f: "Older adults and children", cm: "S", lead: "County EMA", sup: "Executive Office on Aging; Aging and Disability Resource Centers; schools", state: "DHS human-services programs", trig: "Shelter opening", ch: "Caregiver networks, schools, Aloha United Way 211" },
  { f: "Animals and service animals", cm: "S", lead: "County EMA", sup: "County humane society", state: "Hawaiʻi Department of Agriculture (animal issues)", trig: "Shelter opening", ch: "Shelter listings that say which sites accept animals" },
  { f: "Feeding and water", cm: "—", lead: "County EMA", sup: "The Salvation Army; Red Cross; Hawaiʻi Foodbank; VOAD", state: "ESF-6 resource requests to FEMA if exhausted", trig: "Shelters open", ch: "Shelter and distribution-point listings" },
  { f: "Family reunification", cm: "S", lead: "American Red Cross", sup: "County EMA; Aloha United Way 211", state: "DHS supports casework", trig: "Shelter intake rising", ch: "Hotline and shelter intake" },
];

/** Resource types a partner can pledge, keyed to the model's resource lines. */
export const PLEDGE_TYPES = [
  ["cots", "Cots", "units"], ["blankets", "Blankets", "units"], ["water", "Water", "gal/day"], ["meals", "Meals", "meals/day"],
  ["staff", "Shelter staff", "staff/day"], ["interpreters", "Interpreters", "staff/day"], ["lift", "Paratransit lift runs", "runs"],
  ["transport", "Transport runs (ambulatory)", "runs"], ["generators", "Generators", "units"], ["pets", "Companion-animal spaces", "animals"],
  ["dialysis", "Dialysis sessions", "sessions/week"], ["oxygen", "Oxygen resupply", "residents"],
];
export const PLEDGE_NAME = Object.fromEntries(PLEDGE_TYPES.map(([k, n, u]) => [k, { n, u }]));

/* ---------------- partner capacity register ---------------- */
const KEY = "allready.partners.v1";
export const STALE_DAYS = 30; // planning mode: capacity is "current" for a season-length month

export function pledges() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } }
export function savePledges(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {} }

/** Refuse anything that looks like personal data. Organisation lines only. */
const PII = [/@/, /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/, /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/, /\b(dob|ssn|patient|client\s*id|case\s*(no|number))\b/i];
export function piiProblem(text) { return PII.some((r) => r.test(String(text || ""))) ? "Looks like a phone number, email or personal identifier. Record organisations and roles only." : ""; }

export function addPledge(p) {
  const list = pledges();
  list.push({ id: Math.random().toString(36).slice(2, 10), ...p });
  savePledges(list);
  return list;
}
export function removePledge(id) { const list = pledges().filter((p) => p.id !== id); savePledges(list); return list; }

export const ageDays = (d) => (d ? Math.floor((Date.now() - Date.parse(d)) / 864e5) : Infinity);

/** Sum of current (not stale) pledges for one county, plus statewide pledges, by resource. */
export function pledgedSupply(fips) {
  const out = {};
  for (const p of pledges()) {
    if (p.county !== fips && p.county !== "state") continue;
    if (ageDays(p.confirmed) > STALE_DAYS) continue;
    const o = (out[p.type] ||= { qty: 0, n: 0, statewide: 0, latest: null });
    o.qty += +p.qty || 0; o.n++;
    if (p.county === "state") o.statewide += +p.qty || 0;
    if (!o.latest || p.confirmed > o.latest) o.latest = p.confirmed;
  }
  return out;
}

const COLS = ["partner", "type", "county", "qty", "confirmed", "role", "notes"];
export function toCSV(list = pledges()) {
  const esc = (v) => { const t = v == null ? "" : String(v); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  return "﻿" + [COLS.join(","), ...list.map((p) => COLS.map((c) => esc(p[c])).join(","))].join("\n") + "\n";
}
export function fromCSV(text) {
  const rows = [], lines = String(text).replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  const parse = (l) => { const o = []; let cur = "", q = false; for (let i = 0; i < l.length; i++) { const c = l[i]; if (q) { if (c === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; } else if (c === '"') q = true; else if (c === ",") { o.push(cur); cur = ""; } else cur += c; } o.push(cur); return o; };
  const head = parse(lines[0] || "").map((h) => h.trim().toLowerCase());
  const errors = [];
  for (let i = 1; i < lines.length; i++) {
    const v = parse(lines[i]), r = Object.fromEntries(head.map((h, j) => [h, (v[j] || "").trim()]));
    const bad = !PLEDGE_NAME[r.type] ? "unknown type" : !(+r.qty > 0) ? "quantity must be a positive number" : piiProblem(r.partner + " " + r.role + " " + r.notes);
    if (bad) { errors.push(`Row ${i + 1}: ${bad}`); continue; }
    rows.push({ partner: r.partner, type: r.type, county: r.county || "state", qty: +r.qty, confirmed: r.confirmed || new Date().toISOString().slice(0, 10), role: r.role || "", notes: r.notes || "" });
  }
  return { rows, errors };
}
