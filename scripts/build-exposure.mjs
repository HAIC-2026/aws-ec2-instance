#!/usr/bin/env node
/* AllReady — who lives inside each hazard zone, by census tract. MIT licensed. Node 20+, no dependencies.

   Run:  node scripts/build-exposure.mjs        → writes public/data/exposure.json

   Method (the same one Census-based planners use when they do not have address data):
   1. Read every populated 2020 Census block in Hawaiʻi (TIGERweb): its population and an
      internal point guaranteed to fall inside the block.
   2. Read the published hazard zones from the Hawaiʻi Statewide GIS Program:
        tsunami   = Tsunami Evacuation Zone           (Hazards/MapServer/11)
        tsunamiX  = Tsunami or Extreme Tsunami zone   (Hazards/MapServer/11)
        wildfire  = community areas rated High fire risk (Hazards/MapServer/7)
        flood     = FEMA Special Flood Hazard Area, State DFIRM (Hazards/MapServer/6, SFHA_TF = 'T')
      Hurricane is not a zone: the whole island is affected, so every resident counts.
   3. A block is "in the zone" when its internal point falls inside a zone polygon. Each tract's
      share = people in zone blocks ÷ people in all its blocks. The app applies that share to the
      tract's current CDC/ATSDR SVI counts (disability, limited English, no vehicle, age).

   Limits: block internal points, not block areas, so a block half inside a zone counts wholly in
   or wholly out; residents with access and functional needs are assumed to be spread like
   everyone else in the tract. Hazard zones change rarely; re-run this when the State republishes. */

import { writeFile, mkdir } from "node:fs/promises";

const TIGER = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Tracts_Blocks/MapServer/2";
const HAZ = "https://geodata.hawaii.gov/arcgis/rest/services/Hazards/MapServer";
const OUT = new URL("../public/data/exposure.json", import.meta.url);

async function getJSON(url, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(120000) });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const j = await r.json();
      if (j.error) throw new Error(JSON.stringify(j.error));
      return j;
    } catch (e) {
      if (i >= tries) throw e;
      await new Promise((ok) => setTimeout(ok, 1500 * i));
    }
  }
}

/** Page through an ArcGIS layer. */
async function all(base, params, page = 2000) {
  const out = [];
  for (let offset = 0; ; offset += page) {
    const q = new URLSearchParams({ f: "json", outSR: "4326", resultOffset: offset, resultRecordCount: page, orderByFields: "objectid", ...params });
    const j = await getJSON(`${base}/query?${q}`);
    out.push(...(j.features || []));
    process.stdout.write(`\r  ${base.split("/").slice(-2).join("/")} ${out.length}`);
    if (!j.exceededTransferLimit && (j.features || []).length < page) break;
  }
  process.stdout.write("\n");
  return out;
}

// ---------- point in polygon with a coarse grid index ----------
const CELL = 0.05;
function index(features) {
  const polys = [], grid = new Map();
  for (const f of features) {
    const rings = f.geometry?.rings; if (!rings?.length) continue;
    let w = 180, s = 90, e = -180, n = -90;
    for (const r of rings) for (const [x, y] of r) { if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y; }
    const p = { rings, w, s, e, n }; polys.push(p);
    for (let gx = Math.floor(w / CELL); gx <= Math.floor(e / CELL); gx++)
      for (let gy = Math.floor(s / CELL); gy <= Math.floor(n / CELL); gy++) {
        const k = gx + ":" + gy; (grid.get(k) || grid.set(k, []).get(k)).push(p);
      }
  }
  return { polys, grid };
}
function inRings(rings, x, y) { // even-odd over all rings handles holes
  let inside = false;
  for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function hit(ix, x, y) {
  const cand = ix.grid.get(Math.floor(x / CELL) + ":" + Math.floor(y / CELL)); if (!cand) return false;
  for (const p of cand) if (x >= p.w && x <= p.e && y >= p.s && y <= p.n && inRings(p.rings, x, y)) return true;
  return false;
}

// ---------- run ----------
console.log("Reading 2020 Census blocks (TIGERweb)…");
const blocks = await all(TIGER, { where: "STATE='15' AND POP100>0", outFields: "GEOID,POP100,INTPTLAT,INTPTLON", returnGeometry: "false", orderByFields: "GEOID" }, 5000);

console.log("Reading hazard zones (Hawaiʻi Statewide GIS)…");
const geo = { returnGeometry: "true", maxAllowableOffset: "0.00005", geometryPrecision: "6" };
const tsuAll = await all(`${HAZ}/11`, { where: "zone_type IN ('Tsunami Evacuation Zone','Extreme Tsunami Evacuation Zone')", outFields: "zone_type", ...geo });
const fire = await all(`${HAZ}/7`, { where: "risk_rating = 'High'", outFields: "commu_name,risk_rating", ...geo });
const flood = await all(`${HAZ}/6`, { where: "sfha_tf = 'T'", outFields: "fld_zone", ...geo });

const IX = {
  tsunami: index(tsuAll.filter((f) => f.attributes.zone_type === "Tsunami Evacuation Zone")),
  tsunamiX: index(tsuAll),
  wildfire: index(fire),
  flood: index(flood),
};

const tracts = {};
for (const b of blocks) {
  const a = b.attributes, fips = a.GEOID.slice(0, 11), x = +a.INTPTLON, y = +a.INTPTLAT, pop = a.POP100;
  const t = (tracts[fips] ||= { pop20: 0, tsunami: 0, tsunamiX: 0, wildfire: 0, flood: 0 });
  t.pop20 += pop;
  for (const k of Object.keys(IX)) if (hit(IX[k], x, y)) t[k] += pop;
}

const sum = (k) => Object.values(tracts).reduce((s, t) => s + t[k], 0);
const out = {
  generated: new Date().toISOString(),
  method: "2020 Census block internal points tested against published hazard-zone polygons; tract share = block population in zone ÷ tract block population. Hurricane = whole island.",
  sources: [
    { key: "blocks", n: "U.S. Census Bureau, TIGERweb — 2020 Census Blocks (POP100)", url: TIGER, count: blocks.length },
    { key: "tsunami", n: "Hawaiʻi Statewide GIS Program — Tsunami Evacuation Zones (all zones)", url: `${HAZ}/11`, count: tsuAll.length },
    { key: "wildfire", n: "Hawaiʻi Statewide GIS Program — Fire Risk Areas rated High", url: `${HAZ}/7`, count: fire.length },
    { key: "flood", n: "Hawaiʻi Statewide GIS Program — State DFIRM, FEMA Special Flood Hazard Areas", url: `${HAZ}/6`, count: flood.length },
  ],
  totals: { pop20: sum("pop20"), tsunami: sum("tsunami"), tsunamiX: sum("tsunamiX"), wildfire: sum("wildfire"), flood: sum("flood") },
  tracts,
};
await mkdir(new URL("../public/data/", import.meta.url), { recursive: true });
await writeFile(OUT, JSON.stringify(out));
console.log(`Wrote ${Object.keys(tracts).length} tracts →`, OUT.pathname);
console.log(out.totals);
