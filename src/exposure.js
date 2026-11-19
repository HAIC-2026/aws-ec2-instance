/* AllReady — who lives inside each hazard zone. MIT licensed.

   DHS goal 1 asks for hazard-specific maps: not "who lives in the county" but "who lives where
   this hazard reaches". scripts/build-exposure.mjs tests every populated 2020 Census block
   against the zones the Hawaiʻi Statewide GIS Program publishes and stores, per census tract,
   how many residents live inside each zone. This file turns that share into an area summary
   the needs model can use, applied to each tract's current CDC/ATSDR SVI counts.

   Hurricane has no zone: the whole island is affected, so every resident counts. */

export const ZONES = {
  hurricane: { k: null, basis: "Whole island: hurricane wind reaches every resident" },
  tsunami: { k: "tsunami", basis: "Tsunami Evacuation Zone (Hawaiʻi Statewide GIS)" },
  wildfire: { k: "wildfire", basis: "Community areas rated High fire risk (Hawaiʻi Statewide GIS)" },
  flood: { k: "flood", basis: "FEMA Special Flood Hazard Area (State DFIRM, Hawaiʻi Statewide GIS)" },
};

export const COUNTY_LIST = [
  { fips: "15003", n: "Honolulu", long: "City and County of Honolulu", island: "Oʻahu" },
  { fips: "15001", n: "Hawaiʻi", long: "Hawaiʻi County", island: "Hawaiʻi Island" },
  { fips: "15009", n: "Maui", long: "Maui County", island: "Maui, Molokaʻi, Lānaʻi" },
  { fips: "15007", n: "Kauaʻi", long: "Kauaʻi County", island: "Kauaʻi, Niʻihau" },
];

let P = null;
export function loadExposure() {
  return (P ||= fetch(import.meta.env.BASE_URL + "data/exposure.json").then((r) => {
    if (!r.ok) throw new Error("exposure.json " + r.status);
    return r.json();
  }));
}

/** Share (0..1) of a tract's residents inside the zone for `hazard`. */
export function share(exp, fips, hazard) {
  const z = ZONES[hazard]?.k;
  if (!z) return 1;
  const t = exp?.tracts?.[fips];
  if (!t || !t.pop20) return 0;
  return Math.min(1, t[z] / t.pop20);
}

/**
 * Area summary for the model: tracts in `countyFips` (or all), each weighted by its in-zone
 * share. countyFrac is the share of each county's residents inside the zone, which scales the
 * county-level emPOWER counts the same way.
 */
export function zoneArea(tracts, exp, hazard, countyFips = null) {
  const a = { pop: 0, dis: 0, lep: 0, nov: 0, a65: 0, a17: 0, hh: 0, tracts: 0, fips: [], countyFrac: {}, list: [] };
  const whole = {}, inside = {};
  for (const t of tracts) {
    if (countyFips && t.countyFips !== countyFips) continue;
    const w = share(exp, t.fips, hazard);
    whole[t.countyFips] = (whole[t.countyFips] || 0) + (t.pop || 0);
    if (w <= 0) continue;
    a.tracts++;
    a.pop += (t.pop || 0) * w; a.dis += (t.disability || 0) * w; a.lep += (t.limited_english || 0) * w;
    a.nov += (t.no_vehicle || 0) * w; a.a65 += (t.age_65_plus || 0) * w; a.a17 += (t.under_18 || 0) * w;
    a.hh += (t.households || 0) * w;
    inside[t.countyFips] = (inside[t.countyFips] || 0) + (t.pop || 0) * w;
    a.list.push({ t, w });
  }
  a.fips = Object.keys(inside);
  for (const k of a.fips) a.countyFrac[k] = whole[k] ? inside[k] / whole[k] : 0;
  a.countyPop = Object.values(whole).reduce((s, v) => s + v, 0);
  a.basis = ZONES[hazard]?.basis || "";
  return a;
}
