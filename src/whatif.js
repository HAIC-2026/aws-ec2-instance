/* AllReady — one what-if, shared by the Event planner and the Live map. MIT licensed.

   A planner who rehearses "Maui · Wildfire" in the Event planner and then opens the Live map
   must find the same scenario there, and the reverse. Both pages read and write the same
   record, and a change in one browser tab reaches the other through the storage event. Only
   the scenario choice is shared (county, hazard); each page keeps its own view settings. */

const KEY = "allready.scenario.v1";
const COUNTIES = new Set(["15001", "15003", "15007", "15009", "state"]);
const HAZARDS = new Set(["hurricane", "tsunami", "wildfire", "flood"]);

export function readWhatIf() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY)) || {};
    return { county: COUNTIES.has(s.county) ? s.county : null, hazard: HAZARDS.has(s.hazard) ? s.hazard : null };
  } catch { return { county: null, hazard: null }; }
}

/** Merge a change into the shared record. Returns true if anything changed. */
export function writeWhatIf(patch) {
  try {
    const s = JSON.parse(localStorage.getItem(KEY)) || {};
    let changed = false;
    if (patch.county && COUNTIES.has(patch.county) && s.county !== patch.county) { s.county = patch.county; changed = true; }
    if (patch.hazard && HAZARDS.has(patch.hazard) && s.hazard !== patch.hazard) {
      s.hazard = patch.hazard; changed = true;
      if (s.intensity === "custom") { s.intensity = "standard"; s.over = {}; } // custom sliders belong to the old hazard
    }
    if (changed) localStorage.setItem(KEY, JSON.stringify(s));
    return changed;
  } catch { return false; }
}

/** Call `fn({county, hazard})` when another tab changes the shared what-if. */
export function onWhatIf(fn) {
  addEventListener("storage", (e) => { if (e.key === KEY) fn(readWhatIf()); });
}
