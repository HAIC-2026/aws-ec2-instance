/* AllReady — county shelter normalizer. MIT licensed.

   DHS stated the problem plainly: "each County maintains its own definitions of sheltering
   options" and "there is no single, current view". That is literally true in the data:

     Honolulu       calls them "Hurricane Refuge Areas", publishes live open/closed status,
                    and publishes no capacity, ADA, pet or power fields at all.
     Hawaiʻi County calls them "Pre-Impact" and "Post-Impact" shelters (in eight spellings),
                    and has the richest AFN schema in the state: Capacity, Occupancy,
                    Available_Room, Animals, Hardened, Power, ADA, hurricane_shelter.
     Kauaʻi         calls them by hazard eligibility (EVAC_F / EVAC_H / EVAC_T), stores
                    capacity as a string with a trailing newline, and leaves ADA mostly blank.
     Maui           publishes no machine-readable shelter layer at all.

   This file reads all three live county services, maps them onto one record shape, and —
   just as importantly — keeps track of what each county never told us. A field we were not
   given stays null, never false and never zero, so the readiness scorecard can report
   "ADA status unknown for 54 of 77" instead of silently implying "not accessible".

   All three feeds are public, read-only, no key, and carry no personal information:
   they describe facilities, not people. */

import { rows, yn, num, str } from "./arcq.js";

const HON = "https://services.arcgis.com/tNJpAOha4mODLkXz/arcgis/rest/services/Potential_Emergency_Shelter_Edit_EOC/FeatureServer/0";
const HAW = "https://services1.arcgis.com/C2LPusZs5OXNGFDn/arcgis/rest/services/Emergency_Shelters_(HCCDA)_Public/FeatureServer/0";
const KAU = "https://services1.arcgis.com/0DaVqrPt2eyXUS9g/arcgis/rest/services/Shelters_Testing_Copy/FeatureServer/0";

/** Normalised roles. Counties use different words for the same two ideas, plus pet-only sites. */
export const ROLE = {
  pre: "Pre-impact (occupied before the hazard arrives)",
  post: "Post-impact (opens after the hazard passes)",
  refuge: "Refuge area (last-resort shelter from wind)",
  pets: "Companion-animal shelter",
  unknown: "Role not stated by the county",
};

/** Hawaiʻi County writes the same two roles eight different ways. */
function hawRole(type) {
  const s = str(type).toLowerCase();
  if (!s) return "unknown";
  if (s.includes("post")) return "post";
  if (s.includes("pre")) return "pre";
  if (s.includes("evacuation") || s.includes("emergency shelter")) return "pre";
  return "unknown";
}

export const COUNTIES = [
  {
    fips: "15003", name: "City and County of Honolulu", short: "Honolulu", island: "Oʻahu",
    agency: "Honolulu Dept. of Emergency Management (HOLIS GIS)", url: HON,
    term: "Potential Hurricane Refuge Area", published: true,
    async load() {
      return (await rows(HON)).map((a) => ({
        name: str(a.Name), address: str(a.Address), city: str(a.Place), zip: "", phone: "", district: "",
        // Status is a flag on the EOC's own editing layer: non-zero means the EOC has opened it.
        status: a.Status == null ? "unknown" : +a.Status > 0 ? "open" : "closed",
        opened: a.Open_ || null, closed: a.Close_ || null,
        capacity: null, occupancy: null, available: null,
        role: "refuge", facility: "",
        // Honolulu publishes none of the AFN attributes. Left null on purpose — see the scorecard.
        ada: null, pets: null, power: null, hardened: null,
        hazards: { hurricane: true, flood: null, tsunami: null, wildfire: null },
        link: str(a.GoogleMapsLink), lon: a._lon, lat: a._lat,
      }));
    },
  },
  {
    fips: "15001", name: "Hawaiʻi County", short: "Hawaiʻi", island: "Hawaiʻi Island",
    agency: "Hawaiʻi County Civil Defense Agency (HCCDA)", url: HAW,
    term: "Pre-impact / Post-impact shelter", published: true,
    async load() {
      return (await rows(HAW)).map((a) => {
        const hs = str(a.hurricane_shelter);
        return {
          name: str(a.Name), address: str(a.Address), city: str(a.City), zip: str(a.Zip_Code),
          phone: str(a.Phone), district: str(a.District),
          status: /open/i.test(str(a.Status)) ? "open" : /clos/i.test(str(a.Status)) ? "closed" : "unknown",
          opened: null, closed: null,
          capacity: num(a.Capacity), occupancy: num(a.Occupancy), available: num(a.Available_Room),
          role: hawRole(a.Type), facility: str(a.Facility),
          ada: yn(a.ADA), pets: yn(a.Animals), power: yn(a.Power), hardened: yn(a.Hardened),
          hazards: {
            // "2022 - Primary" / "2022 - Secondary" are designations; "No" means not hurricane-rated.
            hurricane: hs ? !/^no$/i.test(hs) : null,
            flood: null, tsunami: null, wildfire: null,
          },
          designation: /primary|secondary/i.test(hs) ? hs : "",
          notes: str(a.Notes), building: str(a.Building),
          link: "", lon: a._lon ?? num(a.Longitude), lat: a._lat ?? num(a.Latitude),
        };
      });
    },
  },
  {
    fips: "15007", name: "Kauaʻi County", short: "Kauaʻi", island: "Kauaʻi",
    agency: "Kauaʻi County Emergency Management Agency", url: KAU,
    term: "Shelter by evacuation type (F/H/T)", published: true,
    async load() {
      return (await rows(KAU)).map((a) => {
        const t = str(a.EVAC_TYPE).toUpperCase();
        const petsOnly = t.includes("PETS ONLY");
        return {
          name: str(a.NAME), address: str(a.FULL_ADD), city: str(a.MCOMM), zip: str(a.ZIPCODE),
          phone: str(a.PHONE), district: str(a.MCOMM),
          status: yn(a.OPENN) === true ? "open" : yn(a.OPENN) === false ? "closed" : "unknown",
          opened: null, closed: null,
          capacity: num(a.CAPACITY), occupancy: null, available: null,
          role: petsOnly ? "pets" : "unknown", facility: "",
          ada: yn(a.ADA), pets: petsOnly ? true : yn(a.PET), power: null, hardened: null,
          hazards: {
            // EVAC_F/H/T are per-hazard eligibility flags; EVAC_TYPE is the human-readable summary.
            flood: yn(a.EVAC_F) ?? (t.includes("F") ? true : null),
            hurricane: yn(a.EVAC_H) ?? (t.includes("H") ? true : null),
            tsunami: yn(a.EVAC_T) ?? (t.includes("TSUNAMI") ? true : null),
            wildfire: null,
          },
          inTsunamiZone: yn(a.TSUZONE),
          link: "", lon: a._lon ?? num(a.POINT_X), lat: a._lat ?? num(a.POINT_Y),
        };
      });
    },
  },
  {
    fips: "15009", name: "Maui County", short: "Maui", island: "Maui, Molokaʻi, Lānaʻi",
    agency: "Maui Emergency Management Agency", url: "", term: "—", published: false,
    // Searched MEMA's 705-service ArcGIS org and ArcGIS Online on 2026-10-29: no public
    // machine-readable shelter layer. Reported as a gap rather than filled with a guess.
    gap: "No public machine-readable shelter layer found. Shelter lists are published as web pages and PDFs only, so they cannot be checked against hazard zones automatically.",
    async load() { return []; },
  },
];

/** Which AFN attributes a planner actually needs before an event, and what each one decides. */
export const ATTRS = [
  { k: "capacity", n: "Capacity", why: "Needed to compute any shelter-space gap at all." },
  { k: "ada", n: "ADA accessible", why: "CMIST I — decides who can be sent here." },
  { k: "pets", n: "Accepts animals", why: "Pets are a documented reason households refuse to evacuate." },
  { k: "power", n: "Backup power", why: "CMIST M — electricity-dependent medical equipment." },
  { k: "hardened", n: "Wind-hardened", why: "DOE schools are not hardened; decides hurricane use." },
  { k: "role", n: "Pre/post-impact role", why: "Decides when in the timeline it can open." },
];

const known = (s, k) => (k === "role" ? s.role !== "unknown" : k === "capacity" ? s.capacity != null : s[k] != null);

/**
 * Readiness scorecard: per county, how much of what a planner needs is actually published.
 * This is the "highlight potential gaps" deliverable — the gaps are in the data, not just the map.
 */
export function readiness(shelters) {
  return COUNTIES.map((c) => {
    const mine = shelters.filter((s) => s.fips === c.fips);
    const attrs = ATTRS.map((a) => {
      const have = mine.filter((s) => known(s, a.k)).length;
      return { ...a, have, of: mine.length, pct: mine.length ? Math.round((have / mine.length) * 100) : 0 };
    });
    const pct = mine.length ? Math.round(attrs.reduce((t, a) => t + a.pct, 0) / attrs.length) : 0;
    return {
      fips: c.fips, county: c.short, name: c.name, agency: c.agency, term: c.term,
      published: c.published, gap: c.gap || "", url: c.url,
      count: mine.length,
      capacity: mine.reduce((t, s) => t + (s.capacity || 0), 0),
      capacityKnownFor: mine.filter((s) => s.capacity != null).length,
      open: mine.filter((s) => s.status === "open").length,
      attrs, pct,
      grade: !c.published ? "none" : pct >= 75 ? "good" : pct >= 40 ? "partial" : "thin",
    };
  });
}

/** Load every county in parallel. One county failing never takes the others down. */
export async function loadShelters() {
  const settled = await Promise.allSettled(COUNTIES.map((c) => c.load()));
  const all = [];
  const errors = [];
  settled.forEach((r, i) => {
    const c = COUNTIES[i];
    if (r.status === "rejected") { errors.push({ county: c.short, msg: String(r.reason?.message || r.reason) }); return; }
    r.value.forEach((s, j) => {
      if (!Number.isFinite(s.lon) || !Number.isFinite(s.lat)) return; // unmappable row, skip
      all.push({
        id: `${c.fips}-${j}`, fips: c.fips, county: c.short, countyName: c.name,
        island: c.island, source: c.agency, sourceUrl: c.url, countyTerm: c.term,
        designation: "", notes: "", building: "", inTsunamiZone: null, ...s,
      });
    });
  });
  return { shelters: all, errors };
}

/** GeoJSON for the map. Colour and radius are decided in planner.js. */
export function toGeoJSON(shelters) {
  return {
    type: "FeatureCollection",
    features: shelters.map((s) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [s.lon, s.lat] },
      properties: {
        ...s, hazards: undefined,
        hzHurricane: s.hazards.hurricane, hzFlood: s.hazards.flood,
        hzTsunami: s.hazards.tsunami, hzWildfire: s.hazards.wildfire,
        // MapLibre filters cannot read null cleanly, so expose a string for styling.
        adaS: s.ada === true ? "yes" : s.ada === false ? "no" : "unknown",
        petsS: s.pets === true ? "yes" : s.pets === false ? "no" : "unknown",
      },
    })),
  };
}

/** Shelters usable for one hazard. Unknown eligibility is kept but flagged, never silently dropped. */
export function usableFor(shelters, hazard) {
  return shelters.filter((s) => {
    if (s.role === "pets") return false; // counted separately, against pet demand
    const h = s.hazards[hazard];
    if (h === false) return false;
    if (hazard === "tsunami" && s.inTsunamiZone === true) return false; // inside the zone it evacuates
    return true;
  });
}
