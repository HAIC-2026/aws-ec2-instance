/* AllReady — CDC/ATSDR Social Vulnerability Index 2022, shared by the map and Insights pages.
   MIT licensed.

   The AFN index is defined HERE and nowhere else. Two pages quoting two slightly different
   definitions of the same headline number is how a planning tool loses its credibility, so
   both import this.

   Index = the mean of a tract's Hawaiʻi-relative percentile rank on four CMIST proxies:
     disability (I) · limited English (C) · no vehicle (T) · age 65+ (cross-cutting).
   Ranks are relative to Hawaiʻi tracts, not the nation, because a planner allocating Hawaiʻi
   resources cares where a tract sits among the tracts they are choosing between.

   Public, de-identified, tract-level. Nothing here can describe a household. */

const BASE = "https://onemap.cdc.gov/onemapservices/rest/services/SVI/CDC_ATSDR_Social_Vulnerability_Index_2022_USA/FeatureServer/";
const CORE = "FIPS,LOCATION,E_TOTPOP,E_DISABL,E_LIMENG,E_NOVEH,E_AGE65,EP_DISABL,EP_LIMENG,EP_NOVEH,EP_AGE65";
const EXTRA = ",E_AGE17,E_SNGPNT,E_HH";

export const MEASURES = [
  ["idx", "Composite AFN index"],
  ["dis", "Disability"],
  ["lep", "Limited English"],
  ["nov", "No vehicle"],
  ["a65", "Age 65+"],
];

export const COUNTY_NAMES = {
  15001: "Hawaiʻi County", 15003: "City and County of Honolulu",
  15005: "Kalawao County", 15007: "Kauaʻi County", 15009: "Maui County",
};

/**
 * Fetch Hawaiʻi tracts. `geometry:false` is dramatically faster and is what the Insights
 * page wants — it only tabulates, it never draws polygons.
 * Layer ids and field sets are tried in order because the service has been republished
 * under different layer numbers more than once.
 */
export async function fetchSVI({ geometry = true } = {}) {
  const where = encodeURIComponent("ST_ABBR='HI'");
  const geo = geometry ? "&outSR=4326&f=geojson&maxAllowableOffset=0.0004&geometryPrecision=5" : "&returnCentroid=true&outSR=4326&f=json";
  for (const id of [2, 0, 3]) {
    for (const fields of [CORE + EXTRA, CORE]) {
      try {
        const r = await fetch(`${BASE}${id}/query?where=${where}&outFields=${fields}&returnGeometry=${geometry}${geo}&resultRecordCount=2000`);
        if (!r.ok) continue;
        const j = await r.json();
        const fs = j.features || [];
        if (fs.length > 50) {
          // Esri JSON and GeoJSON disagree about where the attributes live.
          return fs.map((f) => ({ properties: f.properties || f.attributes, geometry: f.geometry || null, centroid: f.centroid ? [f.centroid.x, f.centroid.y] : null }));
        }
      } catch { /* try the next layer id */ }
    }
  }
  throw new Error("The CDC/ATSDR SVI service did not return Hawaiʻi tracts.");
}

const rank = (sorted, x) => {
  if (x == null || x < 0) return 0;
  let lo = 0, hi = sorted.length;
  while (lo < hi) { const m = (lo + hi) >> 1; sorted[m] < x ? (lo = m + 1) : (hi = m); }
  return (lo / sorted.length) * 100;
};

/**
 * Normalise raw features into tract records carrying both the raw counts and the ranks.
 * Tracts with no resident population are dropped: they cannot be scored and their presence
 * would quietly drag every percentile down.
 */
export function rankTracts(features) {
  const F = features.filter((f) => f.properties && f.properties.E_TOTPOP > 0);
  const K = { dis: "EP_DISABL", lep: "EP_LIMENG", nov: "EP_NOVEH", a65: "EP_AGE65" };
  const sorted = {};
  for (const [k, field] of Object.entries(K)) {
    sorted[k] = F.map((f) => f.properties[field]).filter((n) => n >= 0).sort((a, b) => a - b);
  }
  const r1 = (n) => (n >= 0 ? Math.round(n * 10) / 10 : null);

  return F.map((f) => {
    const p = f.properties;
    const r = {};
    for (const k in K) r[k] = rank(sorted[k], p[K[k]]);
    const idx = (r.dis + r.lep + r.nov + r.a65) / 4;
    const fips = String(p.FIPS || "");
    const county = fips.slice(0, 5);
    return {
      fips, county: COUNTY_NAMES[county] || "Hawaiʻi",
      countyFips: county,
      tract: String(p.LOCATION || "").split(";")[0].trim(),
      location: p.LOCATION,
      pop: p.E_TOTPOP,
      disability: p.E_DISABL, limited_english: p.E_LIMENG, no_vehicle: p.E_NOVEH, age_65_plus: p.E_AGE65,
      under_18: p.E_AGE17 >= 0 ? p.E_AGE17 : null,
      single_parent: p.E_SNGPNT >= 0 ? p.E_SNGPNT : null,
      households: p.E_HH >= 0 ? p.E_HH : null,
      pct_disability: r1(p.EP_DISABL), pct_limited_english: r1(p.EP_LIMENG),
      pct_no_vehicle: r1(p.EP_NOVEH), pct_age_65_plus: r1(p.EP_AGE65),
      afn_index: Math.round(idx * 10) / 10,
      rank_disability: Math.round(r.dis), rank_limited_english: Math.round(r.lep),
      rank_no_vehicle: Math.round(r.nov), rank_age_65_plus: Math.round(r.a65),
      _geometry: f.geometry, _centroid: f.centroid || null,
      _ranks: r, _idx: idx,
    };
  });
}

/** Totals for a set of tract records — the shape the resource model wants. */
export function areaOf(tracts) {
  const a = { pop: 0, dis: 0, lep: 0, nov: 0, a65: 0, a17: 0, hh: 0, tracts: tracts.length };
  for (const t of tracts) {
    a.pop += t.pop || 0; a.dis += t.disability || 0; a.lep += t.limited_english || 0;
    a.nov += t.no_vehicle || 0; a.a65 += t.age_65_plus || 0;
    a.a17 += t.under_18 || 0; a.hh += t.households || 0;
  }
  const inside = {}, whole = {};
  for (const t of tracts) inside[t.countyFips] = (inside[t.countyFips] || 0) + (t.pop || 0);
  for (const t of tracts) whole[t.countyFips] = (whole[t.countyFips] || 0) + (t.pop || 0);
  a.fips = Object.keys(inside);
  a.countyFrac = Object.fromEntries(a.fips.map((k) => [k, 1]));
  return a;
}
