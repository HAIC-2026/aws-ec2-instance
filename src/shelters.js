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
     Maui           publishes no machine-readable shelter layer at all, so Maui sites come
                    from FEMA's National Shelter System and are labelled as registered sites.

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
const NSS = "https://gis.fema.gov/arcgis/rest/services/NSS/FEMA_NSS/MapServer/5";

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
    agency: "FEMA National Shelter System (Maui EMA publishes no list of its own)", url: NSS,
    term: "Registered shelter site (FEMA NSS)", published: true, secondary: true,
    // Maui County publishes no machine-readable shelter list (searched MEMA's ArcGIS org and
    // ArcGIS Online, 2026-10-29). FEMA's National Shelter System, kept in step with the Red
    // Cross shelter database, registers Maui sites with capacity, accessibility, generator and
    // pet fields. A registration is not a county designation, so these are labelled as such.
    gap: "Maui County publishes no shelter list of its own. These are sites registered in FEMA's National Shelter System: a registration is not a county designation, and records carry no date.",
    async load() {
      // Only facility fields are requested. The service also carries point-of-contact names,
      // phones and emails; AllReady never asks for them.
      const fields = "shelter_name,address_1,city,zip,evacuation_capacity,post_impact_capacity,wheelchair_accessible,ada_compliant,pet_accommodations_code,generator_onsite,self_sufficient_electricity,in_100_yr_floodplain,in_surge_slosh_area,shelter_status_code,facility_usage_code,latitude,longitude";
      const extra = "&geometry=" + encodeURIComponent("-157.35,20.45,-155.95,21.25") + "&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects";
      const seen = new Set();
      return (await rows(NSS, { where: "state='HI'", fields, extra })).map((a) => {
        const u = str(a.facility_usage_code).toUpperCase(), cap = num(a.evacuation_capacity) || num(a.post_impact_capacity);
        const pet = str(a.pet_accommodations_code).toUpperCase();
        const surge = yn(a.in_surge_slosh_area), flood = yn(a.in_100_yr_floodplain);
        return {
          name: str(a.shelter_name), address: str(a.address_1), city: str(a.city), zip: str(a.zip), phone: "", district: str(a.city),
          status: /open/i.test(str(a.shelter_status_code)) ? "open" : /clos/i.test(str(a.shelter_status_code)) ? "closed" : "unknown",
          opened: null, closed: null,
          capacity: cap > 0 ? cap : null, occupancy: null, available: null,
          role: u === "POST" ? "post" : u === "EVAC" || u === "BOTH" ? "pre" : "unknown", facility: "",
          ada: yn(a.wheelchair_accessible) ?? yn(a.ada_compliant), pets: pet ? (pet === "NONE" ? false : true) : null,
          power: yn(a.generator_onsite) ?? yn(a.self_sufficient_electricity), hardened: null,
          hazards: { hurricane: surge === true ? false : null, flood: flood === true ? false : null, tsunami: surge === true ? false : null, wildfire: null },
          link: "", lon: a._lon ?? num(a.longitude), lat: a._lat ?? num(a.latitude),
        };
      }).filter((s) => {
        // The registry repeats some sites; keep the first record per name and place.
        const k = s.name.toUpperCase() + "|" + (Number.isFinite(s.lat) ? s.lat.toFixed(3) + "," + s.lon.toFixed(3) : s.address.toUpperCase());
        if (!s.name || seen.has(k)) return false;
        seen.add(k); return true;
      });
    },
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
export function readiness(shelters, errors = []) {
  return COUNTIES.map((c) => {
    const mine = shelters.filter((s) => s.fips === c.fips);
    const err = errors.find((x) => x.county === c.short);
    const down = !!err && !err.stale; // no answer and no saved copy: missing, not zero
    const attrs = ATTRS.map((a) => {
      const have = mine.filter((s) => known(s, a.k)).length;
      return { ...a, have, of: mine.length, pct: mine.length ? Math.round((have / mine.length) * 100) : 0 };
    });
    const pct = mine.length ? Math.round(attrs.reduce((t, a) => t + a.pct, 0) / attrs.length) : 0;
    return {
      fips: c.fips, county: c.short, name: c.name, agency: c.agency, term: c.term,
      published: c.published, secondary: !!c.secondary, gap: c.gap || "", url: c.url,
      count: mine.length,
      capacity: mine.reduce((t, s) => t + (s.capacity || 0), 0),
      capacityKnownFor: mine.filter((s) => s.capacity != null).length,
      open: mine.filter((s) => s.status === "open").length,
      attrs, pct,
      grade: !c.published || down ? "none" : pct >= 75 ? "good" : pct >= 40 ? "partial" : "thin",
      feedDown: down, feedNote: down ? `Feed did not answer this time (${err.msg}). This county's shelters are missing from every figure, not zero.` : err?.msg || "",
    };
  });
}

/** Load every county in parallel. One county failing never takes the others down.

   Three layers, each dated, so a planner never sees an empty county without being told why:
   1. the live feed, reused for 5 minutes so moving between pages does not re-ask (and FEMA's
      service throttles clients that ask too often);
   2. this browser's last good copy, shown if the feed is slow (6 s) or down;
   3. the snapshot shipped with the app (scripts/snapshot-shelters.mjs), for a first visit on a
      bad connection. Every list is a public facility record. */
const LAST = (fips) => "allready.shelters.last." + fips;
const FRESH_MS = 5 * 60 * 1000;
let snapP = null;
const snapshot = () => (snapP ||= fetch(((import.meta.env && import.meta.env.BASE_URL) || "./") + "data/shelters-snapshot.json").then((r) => (r.ok ? r.json() : null)).catch(() => null));
async function loadCounty(c, force) {
  let saved = null; try { saved = JSON.parse(localStorage.getItem(LAST(c.fips))); } catch {}
  if (!force && saved?.rows?.length && Date.now() - saved.at < FRESH_MS) return { rows: saved.rows, readAt: saved.at };
  try {
    const rows = await (saved?.rows?.length ? Promise.race([c.load(), new Promise((_, no) => setTimeout(() => no(new Error("no answer within 6 s")), 6000))]) : c.load());
    try { localStorage.setItem(LAST(c.fips), JSON.stringify({ at: Date.now(), rows })); } catch { /* storage full or blocked */ }
    return { rows, readAt: Date.now() };
  } catch (e) {
    if (saved?.rows?.length) return { rows: saved.rows, staleAt: saved.at, err: e };
    const snap = await snapshot();
    if (snap?.counties?.[c.fips]?.length) return { rows: snap.counties[c.fips], staleAt: Date.parse(snap.generated), snapshot: true, err: e };
    throw e;
  }
}
const when = (t) => new Date(t).toLocaleString("en-US", { timeZone: "Pacific/Honolulu", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " HST";

export async function loadShelters({ force = false } = {}) {
  const settled = await Promise.allSettled(COUNTIES.map((c) => loadCounty(c, force)));
  const all = [];
  const errors = [];
  settled.forEach((r, i) => {
    const c = COUNTIES[i];
    if (r.status === "rejected") { errors.push({ county: c.short, msg: String(r.reason?.message || r.reason) }); return; }
    if (r.value.staleAt) errors.push({ county: c.short, stale: true, msg: r.value.snapshot
      ? `Live feed is not answering right now; showing the copy shipped with AllReady, read ${when(r.value.staleAt)}. It retries every 5 minutes.`
      : `Live feed is slow to answer; showing the list read ${when(r.value.staleAt)}. It retries every 5 minutes.` });
    r.value = r.value.rows;
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
