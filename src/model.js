/* AllReady — needs and resource model. MIT licensed.

   This is part 2 of the DHS framework: "model the types and scale of support required for
   each disaster scenario, including AFN population needs to secure safe sheltering options.
   Outputs should help Counties estimate needs and highlight potential gaps."

   Three rules this file follows, because a planning number nobody trusts is worse than none:

   1. Every factor is named, sourced and editable. Nothing is hard-coded inside a formula.
      `std: true` means a published standard we are applying. `std: false` means a AllReady
      planning assumption, and the UI says so next to the number.
   2. Demand and supply are computed separately, and a gap is only reported as a number when
      both sides are actually known. Where a county never published the attribute, the gap is
      reported as *unknown* and turned into a data action instead of a fabricated figure.
   3. Nothing here touches a person. Demand comes from census-tract rates and ZIP-level
      emPOWER counts; supply comes from facility records. No individual is represented. */

import { LINES } from "./empower.js";
import { usableFor } from "./shelters.js";

const f = (v, u, src, std = true, note = "") => ({ v, u, src, std, note });

/**
 * Planning factors. Judges and planners can argue with any of these — that is the point.
 * Everything marked std:false is ours and should be validated with DHS and the counties.
 */
export const FACTORS = {
  // --- how many people end up in a public shelter ---
  evac: {
    hurricane: f(0.35, "of at-risk population", "AllReady assumption", false, "Hurricane evacuation in Hawaiʻi is mostly vertical or in-place; islands cannot be emptied."),
    tsunami: f(0.95, "of evacuation-zone population", "Zone-based: the whole zone is ordered out", true),
    flood: f(0.20, "of at-risk population", "AllReady assumption", false),
    wildfire: f(0.60, "of at-risk population", "AllReady assumption", false, "Lahaina and Kula showed little-notice fire evacuation is near-total inside the threat area."),
  },
  publicShelter: {
    hurricane: f(0.20, "of evacuees", "AllReady assumption", false, "Most evacuees self-shelter with family or in hotels; public shelter is the remainder."),
    tsunami: f(0.25, "of evacuees", "AllReady assumption", false, "Short duration, so many simply move uphill rather than to a shelter."),
    flood: f(0.25, "of evacuees", "AllReady assumption", false),
    wildfire: f(0.35, "of evacuees", "AllReady assumption", false, "Fire destroys the homes people would otherwise return to."),
  },
  // AFN households have fewer alternatives — no vehicle, no money for a hotel, medical
  // dependence — so they are over-represented in public shelters relative to their share
  // of the population. Flagged as an assumption; validate against past events with DHS.
  afnUplift: f(1.3, "× population share", "AllReady assumption", false, "Set to 1.0 to assume AFN residents shelter at the same rate as everyone else."),

  // --- congregate care consumption ---
  space: f(40, "sq ft per person", "American Red Cross congregate shelter planning", true),
  spaceAfn: f(60, "sq ft per person", "American Red Cross congregate shelter planning", true, "Cots, medical space and circulation for mobility devices."),
  water: f(1, "gal per person per day (drinking)", "FEMA preparedness guidance", true),
  waterOps: f(3, "gal per person per day (all uses)", "Shelter operations planning", true, "Drinking, food preparation and sanitation."),
  meals: f(3, "meals per person per day", "Shelter feeding planning", true),
  cots: f(1, "cot per shelter resident", "Shelter operations planning", true),
  blankets: f(2, "blankets per shelter resident", "Shelter operations planning", true),

  // --- CMIST-specific ---
  dialysisSessions: f(3, "sessions per patient per week", "ESRD standard of care", true),
  interpreter: f(50, "LEP residents per interpreter per shift", "AllReady assumption", false, "Three shifts a day for a 24-hour shelter."),
  shifts: f(3, "shifts per day", "24-hour shelter operation", true),
  liftCapacity: f(3, "wheelchair positions per paratransit run", "AllReady assumption", false, "A lift-equipped van typically carries 2–3 wheelchair users plus ambulatory riders."),
  ambulatoryPerRun: f(8, "ambulatory riders per run", "AllReady assumption", false),
  staffRatio: f(20, "shelter residents per staff member", "Shelter operations planning", true),
  petHouseholds: f(0.57, "of households own a pet", "AVMA pet ownership rate", true),
  petsPerHousehold: f(1.6, "animals per pet-owning household", "AVMA", true),
  generatorPerShelter: f(1, "generator per shelter without backup power", "AllReady assumption", false),
};

/* Low and high bounds on public-shelter demand, as multiples of the likely figure. Shelter
   turnout is the least certain number in mass-care planning, so a single figure overstates
   what is known. This spread is an AllReady assumption, not a published
   rate, and is one of the factors to agree with DHS. */
export const SHELTER_RANGE = { low: 0.4, high: 2, src: "AllReady assumption", std: false };

export const HAZARDS = [
  { k: "hurricane", n: "Hurricane", c: "#a78bfa" },
  { k: "wildfire", n: "Wildfire", c: "#fb923c" },
  { k: "tsunami", n: "Tsunami", c: "#22d3ee" },
  { k: "flood", n: "Flood", c: "#38bdf8" },
];

const r0 = (n) => Math.max(0, Math.round(n));

/**
 * Demand: how many people, and which CMIST needs, for one hazard over one affected area.
 *
 * `area` is the already-filtered census-tract summary:
 *   { pop, dis, lep, nov, a65, a17, hh, tracts, fips[] }
 * `emp` is the emPOWER result; `ramp` (0..1) is how far through the evacuation we are.
 */
export function demand({ hazard, area, emp, ramp = 1 }) {
  const evac = FACTORS.evac[hazard]?.v ?? 0.3;
  const pub = FACTORS.publicShelter[hazard]?.v ?? 0.2;
  const up = FACTORS.afnUplift.v;

  const atRisk = area.pop || 0;
  const evacuating = atRisk * evac * ramp;
  const shelterPop = evacuating * pub;

  // Share of the affected population carrying each CMIST barrier, lifted by `afnUplift`
  // because those households have fewer alternatives to a public shelter.
  const share = (n) => (atRisk ? Math.min(1, (n / atRisk) * up) : 0);
  const inShelter = {
    disability: shelterPop * share(area.dis || 0),
    lep: shelterPop * share(area.lep || 0),
    a65: shelterPop * share(area.a65 || 0),
    a17: shelterPop * share(area.a17 || 0),
  };
  // No-vehicle is a household count, so it scales with households, not people.
  const noVehicleHH = (area.nov || 0) * evac * ramp;

  // emPOWER is county-level; scale it to the share of county population inside the area.
  const e = { dme: 0, dialysis: 0, oxygen: 0, homeHealth: 0, hospice: 0 };
  for (const fips of area.fips || []) {
    const c = emp?.byFips?.[fips];
    if (!c) continue;
    const frac = area.countyFrac?.[fips] ?? 1;
    for (const l of LINES) e[l.k] += (c[l.k] || 0) * frac;
  }
  const evacShare = evac * ramp;

  const households = area.hh || Math.max(1, atRisk / 3);
  const petHH = households * evacShare * pub * FACTORS.petHouseholds.v;

  return {
    hazard, ramp,
    atRisk: r0(atRisk), evacuating: r0(evacuating), shelterPop: r0(shelterPop),
    shelterLow: r0(shelterPop * SHELTER_RANGE.low), shelterHigh: r0(shelterPop * SHELTER_RANGE.high),
    tracts: area.tracts || 0,
    cmist: {
      C: { n: "Communication", v: r0(inShelter.lep), what: "Shelter residents who speak English less than well" },
      M: { n: "Medical", v: r0(e.dme * evacShare), what: "Electricity-dependent medical equipment users displaced" },
      I: { n: "Independence", v: r0(inShelter.disability), what: "Shelter residents living with a disability" },
      S: { n: "Safety & support", v: r0(inShelter.a65 + inShelter.a17), what: "Children and residents 65+ in shelter" },
      T: { n: "Transportation", v: r0(noVehicleHH), what: "Households with no vehicle inside the evacuation area" },
    },
    detail: {
      dialysis: r0(e.dialysis * evacShare),
      oxygen: r0(e.oxygen * evacShare),
      homeHealth: r0(e.homeHealth * evacShare),
      hospice: r0(e.hospice * evacShare),
      dme: r0(e.dme * evacShare),
      a65: r0(inShelter.a65), a17: r0(inShelter.a17),
      disability: r0(inShelter.disability), lep: r0(inShelter.lep),
      noVehicleHH: r0(noVehicleHH), petHH: r0(petHH),
    },
  };
}

/** Supply: what the counties' own shelter records say is available for this hazard and phase. */
export function supply({ shelters, hazard, roles = null, fipsFilter = null }) {
  let pool = usableFor(shelters, hazard);
  if (fipsFilter?.length) pool = pool.filter((s) => fipsFilter.includes(s.fips));
  // A phase may only permit certain roles (pre-impact shelters close at landfall).
  const open = roles ? pool.filter((s) => roles.includes(s.role) || s.role === "unknown") : pool;
  const petPool = (fipsFilter?.length ? shelters.filter((s) => fipsFilter.includes(s.fips)) : shelters)
    .filter((s) => s.role === "pets" || s.pets === true);

  const sum = (arr, pick = (s) => s.capacity) => arr.reduce((t, s) => t + (pick(s) || 0), 0);
  const unk = (arr, k) => arr.filter((s) => (k === "capacity" ? s.capacity == null : s[k] == null)).length;

  return {
    sites: open.length,
    spaces: sum(open),
    capacityUnknownSites: unk(open, "capacity"),
    accessible: sum(open.filter((s) => s.ada === true)),
    accessibleSites: open.filter((s) => s.ada === true).length,
    adaUnknownSites: unk(open, "ada"),
    powered: sum(open.filter((s) => s.power === true)),
    poweredSites: open.filter((s) => s.power === true).length,
    powerUnknownSites: unk(open, "power"),
    hardened: sum(open.filter((s) => s.hardened === true)),
    hardenedSites: open.filter((s) => s.hardened === true).length,
    hardenedUnknownSites: unk(open, "hardened"),
    petSites: petPool.length,
    petSpaces: sum(petPool),
    petUnknownSites: unk(open, "pets"),
    openNow: open.filter((s) => s.status === "open").length,
    byCounty: countBy(open),
    pool: open,
  };
}

function countBy(arr) {
  const m = {};
  for (const s of arr) (m[s.county] ||= { sites: 0, spaces: 0 }), (m[s.county].sites++), (m[s.county].spaces += s.capacity || 0);
  return m;
}

/**
 * Resource lines. Each one is { need, have, unit, how } and, where supply is unknowable
 * from published data, `blocked` carries the reason instead of a false gap.
 */
export function resources(d, sup, manual = {}) {
  const F = FACTORS;
  const p = d.shelterPop;
  const afn = d.cmist.I.v; // residents needing the larger AFN footprint
  const general = Math.max(0, p - afn);

  const L = [];
  const add = (k, n, cmist, need, unit, how, have = null, blocked = "") =>
    L.push({ k, n, cmist, need: r0(need), unit, how, have: have == null ? null : r0(have), blocked });

  add("space", "Shelter space", "—", general * F.space.v + afn * F.spaceAfn.v, "sq ft",
    `${F.space.v} sq ft general + ${F.spaceAfn.v} sq ft per AFN resident (Red Cross)`,
    sup.spaces * F.space.v,
    sup.capacityUnknownSites ? `${sup.capacityUnknownSites} of ${sup.sites} shelters publish no capacity` : "");

  add("people", "Shelter spaces (people)", "—", p, "people",
    `${(F.evac[d.hazard]?.v * 100).toFixed(0)}% evacuate × ${(F.publicShelter[d.hazard]?.v * 100).toFixed(0)}% to public shelter`,
    sup.spaces,
    sup.capacityUnknownSites ? `supply understated: ${sup.capacityUnknownSites} sites without a capacity figure` : "");

  add("accessible", "Accessible (ADA) spaces", "I", afn, "people",
    "One accessible space per shelter resident living with a disability",
    sup.accessible,
    sup.adaUnknownSites ? `ADA status unknown for ${sup.adaUnknownSites} of ${sup.sites} shelters` : "");

  add("hardened", "Wind-hardened spaces", "—",
    d.hazard === "hurricane" ? p : 0, "people",
    "Hurricane only. DOE schools are not hardened for high wind.",
    sup.hardened,
    sup.hardenedUnknownSites ? `hardening unknown for ${sup.hardenedUnknownSites} of ${sup.sites} shelters` : "");

  add("power", "Shelter spaces with backup power", "M", d.cmist.M.v, "people",
    "One powered space per displaced electricity-dependent resident",
    sup.powered,
    sup.powerUnknownSites ? `backup power unknown for ${sup.powerUnknownSites} of ${sup.sites} shelters` : "");

  add("generators", "Generators for shelters without power", "M",
    Math.max(0, sup.sites - sup.poweredSites) * F.generatorPerShelter.v, "units",
    "One per shelter not confirmed to have backup power", null,
    sup.powerUnknownSites ? "count includes shelters whose power status is simply unknown" : "");

  add("cots", "Cots", "—", p * F.cots.v, "units", "One per shelter resident");
  add("blankets", "Blankets", "—", p * F.blankets.v, "units", `${F.blankets.v} per shelter resident`);
  add("water", "Water", "—", p * F.waterOps.v, "gal/day", `${F.waterOps.v} gal/person/day all uses (${F.water.v} gal drinking)`);
  add("meals", "Meals", "—", p * F.meals.v, "meals/day", `${F.meals.v} per person per day`);

  add("dialysis", "Dialysis sessions", "M", d.detail.dialysis * F.dialysisSessions.v, "sessions/week",
    `${F.dialysisSessions.v} per ESRD patient per week (emPOWER)`);
  add("oxygen", "Oxygen resupply", "M", d.detail.oxygen, "residents", "Concentrator power or cylinder resupply (emPOWER)");

  add("interpreters", "Interpreters", "C",
    Math.ceil(d.cmist.C.v / F.interpreter.v) * F.shifts.v, "staff/day",
    `1 per ${F.interpreter.v} LEP residents × ${F.shifts.v} shifts`);

  add("lift", "Paratransit lift runs", "T",
    Math.ceil(d.detail.disability / F.liftCapacity.v), "runs",
    `${F.liftCapacity.v} wheelchair positions per run`);
  add("transport", "Transport runs (ambulatory)", "T",
    Math.ceil(Math.max(0, d.cmist.T.v - d.detail.disability) / F.ambulatoryPerRun.v), "runs",
    `${F.ambulatoryPerRun.v} riders per run, households with no vehicle`);

  add("pets", "Companion-animal spaces", "S",
    d.detail.petHH * F.petsPerHousehold.v, "animals",
    `${(F.petHouseholds.v * 100).toFixed(0)}% of households × ${F.petsPerHousehold.v} animals`,
    sup.petSpaces,
    sup.petUnknownSites ? `animal policy unknown for ${sup.petUnknownSites} of ${sup.sites} shelters` : "");

  add("staff", "Shelter staff", "—", Math.ceil(p / F.staffRatio.v) * F.shifts.v, "staff/day",
    `1 per ${F.staffRatio.v} residents × ${F.shifts.v} shifts`);

  // Supply entered by the planner fills lines no feed publishes. It never overrides a
  // published figure, and it is flagged so nobody mistakes it for county data.
  for (const x of L) if (x.have == null && manual[x.k] != null) { x.have = r0(manual[x.k]); x.manual = true; x.blocked = ""; }
  return L.map((x) => ({
    ...x,
    gap: x.have == null ? null : Math.max(0, x.need - x.have),
    // "unknown" is a real state: we know what is needed but not what exists.
    state: x.have == null ? (x.blocked ? "unknown" : "demand-only") : x.need > x.have ? "short" : "met",
  }));
}

/**
 * The gaps that are not shortages but missing records — the ones DHS can close with a
 * phone call rather than a procurement. Ranked by how many decisions they unblock.
 */
export function dataActions(score) {
  const out = [];
  for (const c of score) {
    if (!c.published) {
      out.push({ county: c.county, weight: 1000, n: 0, title: `${c.county} publishes no shelter layer`,
        action: `Ask ${c.agency} to publish its shelter list as a public feature layer, or export the current list to CSV with capacity, ADA, animals, power and hardening columns.`,
        unblocks: "Every needs estimate and gap figure for this county." });
      continue;
    }
    for (const a of c.attrs) {
      const missing = a.of - a.have;
      if (!missing) continue;
      out.push({
        county: c.county, weight: missing * (a.k === "capacity" ? 3 : a.k === "ada" ? 2.5 : a.k === "hardened" ? 2 : 1),
        n: missing,
        title: `${a.n} unknown for ${missing} of ${a.of} ${c.county} shelters`,
        action: `Confirm ${a.n.toLowerCase()} with ${c.agency} and write it back to the published layer.`,
        unblocks: a.why,
      });
    }
  }
  return out.sort((a, b) => b.weight - a.weight);
}

/** One call: area + shelters + emPOWER in, a complete plan out. */
export function plan({ hazard, area, emp, shelters, ramp = 1, roles = null, fipsFilter = null, manual = {} }) {
  const d = demand({ hazard, area, emp, ramp });
  const s = supply({ shelters, hazard, roles, fipsFilter });
  return { demand: d, supply: s, resources: resources(d, s, manual) };
}
