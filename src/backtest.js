/* AllReady — checked against past events. MIT licensed.

   DHS goal 2 asks for needs estimates "validated as reasonable … within an agreed margin
   against past events". This runs the SAME shelter formula the live tool uses — same factors,
   untuned — over the area each past event affected, and puts the result beside the number of
   people who were actually counted in shelters.

   Rules for this file:
   - Every published count was opened and read at its source (link and quote below).
     Events whose count could not be traced to a source are left out, not estimated.
   - The model side is computed live from the census tracts loaded in the browser.
   - Nothing was adjusted after seeing the results. Where the model is far off, it says so. */

import { FACTORS, SHELTER_RANGE } from "./model.js";

const LANE = "https://mauinow.com/2018/08/24/hurricane-lane-1526-people-across-36-shelters-statewide/";
const LANE_Q = "“As of Thursday night, there were a total of 1,526 people across 36 shelters statewide” (county breakdown listed in the article), Maui Now, 24 Aug 2018";

/** area: { fips } = whole county, or { boxes: [[w,s,e,n]…] } = a drawn footprint (stated as ours). */
export const EVENTS = [
  { id: "lane-hon", name: "Hurricane Lane", date: "2018-08-23", hazard: "hurricane", place: "City and County of Honolulu", published: 1114, area: { fips: "15003" }, areaNote: "whole county (hurricane warning area)", url: LANE, quote: LANE_Q, context: "near miss" },
  { id: "lane-maui", name: "Hurricane Lane", date: "2018-08-23", hazard: "hurricane", place: "Maui County", published: 381, area: { fips: "15009" }, areaNote: "whole county (hurricane warning area)", url: LANE, quote: LANE_Q, context: "near miss" },
  { id: "lane-kauai", name: "Hurricane Lane", date: "2018-08-23", hazard: "hurricane", place: "Kauaʻi County", published: 17, area: { fips: "15007" }, areaNote: "whole county (hurricane watch area)", url: LANE, quote: LANE_Q, context: "near miss" },
  { id: "lane-hawaii", name: "Hurricane Lane", date: "2018-08-23", hazard: "hurricane", place: "Hawaiʻi County", published: 14, area: { fips: "15001" }, areaNote: "whole county (hurricane warning area)", url: LANE, quote: LANE_Q, context: "near miss" },
  { id: "maui-2023", name: "Maui wildfires", date: "2023-08-11", hazard: "wildfire", place: "West Maui and Upcountry Maui",
    published: 1418, area: { boxes: [[-156.72, 20.76, -156.58, 21.04], [-156.38, 20.70, -156.26, 20.88]] },
    areaNote: "census tracts centred in West Maui and Kula–Pukalani–Olinda (footprint drawn by this project)",
    url: "https://mauinow.com/2023/08/12/shelters-provide-needed-supplies-and-safety-for-over-1000-people-impacted-by-the-lahaina-wildfire/",
    quote: "“On Friday, Maui County reported that 1,418 people, both local residents and visitors, were utilizing the emergency shelters”, Maui Now, 12 Aug 2023", context: "congregate shelters only; thousands more were later housed in hotels" },
];

const inArea = (a) => (t) => (a.fips ? t.countyFips === a.fips : !!t._centroid && a.boxes.some((b) => t._centroid[0] >= b[0] && t._centroid[0] <= b[2] && t._centroid[1] >= b[1] && t._centroid[1] <= b[3]));

/** Run the live model over each event's area. `tracts` are svi.js records with centroids. */
export function backtest(tracts) {
  return EVENTS.map((e) => {
    const T = tracts.filter(inArea(e.area));
    const pop = T.reduce((a, t) => a + (t.pop || 0), 0);
    const likely = Math.round(pop * FACTORS.evac[e.hazard].v * FACTORS.publicShelter[e.hazard].v);
    const low = Math.round(likely * SHELTER_RANGE.low), high = Math.round(likely * SHELTER_RANGE.high);
    let verdict;
    if (!pop) verdict = "no tract data for this area";
    else if (e.published >= low && e.published <= high) verdict = "inside the range";
    else if (e.published < low) verdict = `model ${(likely / e.published).toFixed(likely / e.published >= 10 ? 0 : 1)}× higher`;
    else verdict = `published ${(e.published / likely).toFixed(1)}× higher`;
    // Two rates a planner can compare directly: what the model assumes, and what the event showed.
    const assumed = FACTORS.evac[e.hazard].v * FACTORS.publicShelter[e.hazard].v, observed = pop ? e.published / pop : null;
    return { ...e, tracts: T.length, pop, likely, low, high, verdict, assumed, observed, inside: verdict === "inside the range", over: likely > e.published };
  });
}

const pc = (x) => (x == null ? "–" : x < 0.001 ? (x * 100).toFixed(3) + "%" : x < 0.01 ? (x * 100).toFixed(2) + "%" : (x * 100).toFixed(1) + "%");
export const rate = pc;

/** One paragraph, generated from the results, so it can never drift from the table. */
export function reading(rows) {
  const live = rows.filter((r) => r.pop);
  const ok = live.filter((r) => r.inside).length, over = live.filter((r) => !r.inside && r.over).length, under = live.filter((r) => !r.inside && !r.over).length;
  const parts = [`${ok} of ${live.length} published counts fall inside the model's range; the model is higher in ${over} and lower in ${under}.`];
  if (over && !under) parts.push("Every miss is on the safe side for planning: the model never asked for fewer shelter spaces than were used.");
  const hur = live.filter((r) => r.hazard === "hurricane" && !r.inside && r.over);
  if (hur.length) parts.push(`The hurricane rows are far above what happened in Hurricane Lane because the model's rate (${pc(hur[0].assumed)} of residents to a public shelter) describes a direct hit; Lane weakened and passed offshore and the observed turnout was ${pc(Math.min(...hur.map((r) => r.observed)))}–${pc(Math.max(...hur.map((r) => r.observed)))}. Use the hurricane figure to size a direct hit, not to staff a near miss.`);
  const wf = live.find((r) => r.hazard === "wildfire");
  if (wf && !wf.inside) parts.push(`For the 2023 Maui wildfires the model is ${wf.over ? "above" : "below"} the congregate-shelter count (${pc(wf.observed)} observed against ${pc(wf.assumed)} assumed); the published figure leaves out people housed in hotels, and the footprint is drawn by this project.`);
  parts.push("The factors were not changed after seeing these results. Proposed margin, for DHS and the counties to agree: for an event that made direct impact, the published count falls inside the model's range; near misses are reported but not scored.");
  return parts.join(" ");
}
