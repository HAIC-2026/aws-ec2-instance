/* AllReady — HHS emPOWER. MIT licensed.

   This is the "M" in CMIST: Medicare beneficiaries who depend on electricity for
   life-maintaining medical equipment, plus dialysis, oxygen, home health and at-home
   hospice. DHS named emPOWER as an allowed source and the kickoff called it out by name.

   Privacy: emPOWER is published by CMS/HHS already de-identified and aggregated — the
   smallest unit is a ZIP code, never a person or an address. AllReady reads the public
   REST service and never joins it to anything that could re-identify a household.

   Coverage caveat worth saying out loud in a briefing: emPOWER counts Medicare
   beneficiaries only. People on Medicaid, private insurance or no insurance who are
   equally electricity-dependent are not in it, so every number here is a floor. */

import { rows, num } from "./arcq.js";

const SVC = "https://services2.arcgis.com/ZQ4jTQn6k7VPXEwO/arcgis/rest/services/HHS_emPOWER_REST_Service_Public/FeatureServer";
const COUNTY_LAYER = `${SVC}/2`; // Electricity Dependent DME - ALL - CountyLevel
const ZIP_LAYER = `${SVC}/1`; // Electricity Dependent DME - ALL - ZipLevel

/** The five service lines emPOWER breaks out, each with what it actually costs a planner. */
export const LINES = [
  { k: "dme", f: "Power_Dependent_Devices_DME", n: "Electricity-dependent equipment", need: "Backup power, or an accessible shelter with a generator" },
  { k: "dialysis", f: "Facility_ESRD_Dialysis_Any_DME", n: "Dialysis (ESRD)", need: "Three sessions a week; a missed week is life-threatening" },
  { k: "oxygen", f: "O2_Services_Any_DME", n: "Oxygen services", need: "Concentrator power, or cylinder resupply" },
  { k: "homeHealth", f: "Home_Health_Services_Any_DME", n: "Home health services", need: "Care continuity when roads close" },
  { k: "hospice", f: "AtHome_Hospice_Any_DME", n: "At-home hospice", need: "Shelter-in-place support; moving is often unsafe" },
];

const pick = (a) => {
  const o = { benes: num(a.Medicare_Benes) || 0 };
  for (const l of LINES) o[l.k] = num(a[l.f]) || 0;
  return o;
};

/**
 * County and ZIP level counts for Hawaiʻi.
 * Returns { byFips, byZip, state, asOf } — byFips keyed by 5-digit county FIPS.
 */
export async function loadEmpower() {
  const [cty, zip] = await Promise.all([
    rows(COUNTY_LAYER, { where: "State_FIPS_Code='15'", geometry: false }),
    rows(ZIP_LAYER, { where: "State_FIPS_Code='15'", geometry: false }).catch(() => []),
  ]);
  if (!cty.length) throw new Error("emPOWER returned no Hawaiʻi counties");

  const byFips = {};
  for (const a of cty) {
    const fips = String(a.FIPS_Code || "").padStart(5, "0");
    byFips[fips] = { fips, county: String(a.County || a.NAME || "").trim(), ...pick(a) };
  }
  const byZip = zip.map((a) => ({
    zip: String(a.Zip_Code || a.Zip_Code_Recode || "").trim(),
    county: String(a.COUNTY || "").trim(),
    ...pick(a),
  })).filter((z) => z.zip);

  const state = { benes: 0 };
  for (const l of LINES) state[l.k] = 0;
  for (const f of Object.values(byFips)) { state.benes += f.benes; for (const l of LINES) state[l.k] += f[l.k]; }

  return { byFips, byZip, state, asOf: "HHS emPOWER, public REST service" };
}

/**
 * Per-capita rates, used to push county emPOWER counts down to tract level.
 * emPOWER has no tract geography, so the honest move is to apply a county rate to tract
 * population and label the result an estimate — which is what `derived` is for.
 */
export function rates(emp, countyPop) {
  const out = {};
  for (const [fips, v] of Object.entries(emp.byFips)) {
    const pop = countyPop[fips] || 0;
    out[fips] = { pop };
    for (const l of LINES) out[fips][l.k] = pop ? v[l.k] / pop : 0;
    out[fips].derived = true;
  }
  return out;
}
