/* AllReady planning map. MIT licensed.
   Vector map (MapLibre GL) so labels, roads and coastlines stay sharp at every zoom.
   Layer UX is grouped switches, one weather layer at a time, opacity and details tucked into each row.
   Panel and layer patterns are inspired by the open-source Orodruin project; no code is copied from it.
   v6: dockable workspace (src/dock.js), zoomable year timeline (src/timeline.js),
   ArcGIS REST bridge (src/arcgis.js), and the Needs panel computed from real SVI tract data. */
import * as maplibregl from "maplibre-gl";
// MapLibre 6 runs its tile worker as a separate ES module. Bundlers do not find it on their
// own, so hand it the bundled URL explicitly (same-origin, which the CSP requires).
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
maplibregl.setWorkerUrl(mapWorkerUrl);
import "maplibre-gl/dist/maplibre-gl.css";
import "./planner.css";
import "./dock.css";
import "./theme.css"; // loaded last: re-points the shared tokens to the console palette
import { t, applyI18n } from "./i18n.js";
import { mountThemeToggle, onTheme, resolved } from "./theme.js";
import { mountLanguage } from "./lang.js";
import { createDock } from "./dock.js";
import { createTimeline } from "./timeline.js";
import * as Arc from "./arcgis.js";
import { loadShelters, readiness, toGeoJSON, COUNTIES } from "./shelters.js";
import { loadEmpower, LINES } from "./empower.js";
import { plan as buildPlan, dataActions, HAZARDS, FACTORS } from "./model.js";
import { createScenarioClock, SCENARIOS, OWNERS, fmtOffset } from "./scenario.js";
import { createMetrics, createTimer, buildBrief, downloadBrief } from "./metrics.js";
import { createRail } from "./rail.js";
import { loadAlertHistory, alertsAt, alertsGeoJSON, weatherDay, warmZones } from "./history.js";
import { createAnnotations, ICONS as MARK_ICONS } from "./annotations.js";
import { createAssistant } from "./assistant.js";
import { liveEvent, insideEvent, manualSupply, setManualSupply, stamp } from "./live.js";
import { renderShelters, renderResources, renderFactors, renderSources } from "./panels.js";
import { SOURCES } from "./sources.js";
import { navLinks } from "./nav.js";

const $ = (i) => document.getElementById(i);
const BASE = import.meta.env.BASE_URL;
const DPR = Math.min(window.devicePixelRatio || 1, 3);
const OFM = "https://tiles.openfreemap.org";
const FALLBACK_FONT = ["Noto Sans Regular"];
const HI = { c: [-157.4, 20.7], z: 6.5 };
const RECT = { w: -160.6, e: -154.6, s: 18.8, n: 22.4 };
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const store = { get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };

mountThemeToggle($("theme-host"));
mountLanguage($("lang-host"));
$("pgnav")?.append(...navLinks("map", "lnk"));
setInterval(() => ($("clk").textContent = new Date().toLocaleTimeString("en-US", { timeZone: "Pacific/Honolulu", hour12: false }) + " HST"), 1000);

// ---------- colour ramps for data layers ----------
const R = {
  temp: { u: "°C", min: -10, max: 40, s: [[0, 40, 10, 90, 1], [.22, 92, 45, 170, 1], [.42, 35, 95, 230, 1], [.62, 205, 35, 70, 1], [.8, 245, 120, 30, 1], [1, 255, 232, 90, 1]] },
  wind: { u: "km/h", min: 0, max: 60, s: [[0, 40, 10, 90, .35], [.25, 35, 95, 230, .8], [.55, 205, 35, 70, .9], [.8, 245, 120, 30, .95], [1, 255, 232, 90, 1]] },
  rain: { u: "mm/h", min: 0, max: 8, s: [[0, 40, 10, 90, 0], [.08, 40, 170, 230, .55], [.35, 35, 95, 230, .85], [.7, 150, 45, 190, .9], [1, 255, 60, 140, 1]] },
  cloud: { u: "%", min: 0, max: 100, s: [[0, 255, 255, 255, 0], [1, 245, 248, 255, .85]] },
  afn: { u: "percentile", min: 0, max: 100, s: [[0, 40, 10, 90, 0], [.12, 92, 45, 170, .55], [.4, 35, 95, 230, .75], [.65, 205, 35, 70, .85], [.85, 245, 120, 30, .92], [1, 255, 232, 90, .95]] },
};
function col(k, v) {
  const s = R[k].s, x = Math.max(0, Math.min(1, v));
  for (let i = 1; i < s.length; i++) if (x <= s[i][0]) { const a = s[i - 1], b = s[i], f = (x - a[0]) / (b[0] - a[0] || 1); return [1, 2, 3, 4].map((j) => a[j] + (b[j] - a[j]) * f); }
  return s[s.length - 1].slice(1);
}
const rgba = (a, o = 1) => `rgba(${a[0] | 0},${a[1] | 0},${a[2] | 0},${+(a[3] * o).toFixed(3)})`;
const cssRamp = (k) => "linear-gradient(90deg," + R[k].s.map((a) => `rgba(${a[1]},${a[2]},${a[3]},${Math.max(a[4], .4)}) ${a[0] * 100}%`).join(",") + ")";

// ---------- URL parameters from the home page (?hazard=flood&island=kauai) ----------
const ISL = {
  niihau: ["Niʻihau", -160.15, 21.9, 10.0, 14], kauai: ["Kauaʻi", -159.55, 22.05, 9.3, 28], oahu: ["Oʻahu", -157.97, 21.45, 9.4, 30],
  molokai: ["Molokaʻi", -157.0, 21.14, 9.5, 28], lanai: ["Lānaʻi", -156.93, 20.83, 10.2, 16], kahoolawe: ["Kahoʻolawe", -156.6, 20.55, 10.6, 11],
  maui: ["Maui", -156.35, 20.8, 9.2, 32], hawaii: ["Hawaiʻi Island", -155.5, 19.6, 8.2, 60],
};
const HZC = { flood: "#38bdf8", tsunami: "#22d3ee", hurricane: "#a78bfa", wildfire: "#fb923c", earthquake: "#f2c14e", volcano: "#ef4444", drought: "#d4a35a" };
const qs = new URLSearchParams(location.search);
const hz = (qs.get("hazard") || "").toLowerCase().replace(/[^a-z]/g, "") || null;
const isl = ISL[(qs.get("island") || "").toLowerCase()] || null;
const hasScn = !!(hz || isl);

// ---------- persisted state ----------
const S = Object.assign({ base: "dark", baseAuto: true, on: { terrain: true, roads: true, labels: true, hill: false, nws: true, quake: false, shel: true, afn: true }, op: {}, open: { base: 1, haz: 1, wx: 1, needs: 1, res: 1, arc: 1 }, exag: 1.4, afnMode: "idx", arc: [], scope: "state", mode: "live" }, store.get("allready.v6", {}));
if (S.mode !== "whatif") S.mode = "live"; // live is the default; a what-if has to be chosen
// A link from the Scenarios page opens that scenario here: ?whatif=1&hazard=wildfire&county=15009
if (qs.get("whatif") === "1" && SCENARIOS[hz]) S.mode = "whatif";
if (/^150(01|03|05|07|09)$/.test(qs.get("county") || "")) S.scope = qs.get("county");
const READ = { nws: 0, shel: 0, emp: 0, svi: 0 }; // when each live feed was last read
S.on = Object.assign({ terrain: true, roads: true, labels: true, hill: false, nws: true, shel: true, afn: true }, S.on);
// Seed the basemap from the theme BEFORE the map is constructed, so a light-theme session
// never flashes the dark basemap and then reloads the whole style to correct itself.
if (S.baseAuto !== false) S.base = resolved() === "light" ? "light" : "dark";
let dock = null, timeline = null, annotations = null; // created at start-up, after the map
const save = () => store.set("allready.v6", { base: S.base, baseAuto: S.baseAuto, on: S.on, op: S.op, open: S.open, exag: S.exag, afnMode: S.afnMode, arc: S.arc, scope: S.scope, mode: S.mode });

// ---------- basemaps (all vector or public-domain imagery, no keys) ----------
/* Satellite imagery. The USGS National Map tile server was too slow for a live demo: with 3D
   terrain on, every tile still waiting for imagery showed the AFN layer over a bare background
   as purple and orange squares. Esri World Imagery is served from a global CDN, needs no key,
   and has sharper Hawaiʻi coverage; roads and place names still come from OpenStreetMap. */
const SAT_IMG = "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const DEM = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
const nameExpr = ["coalesce", ["get", "name:latin"], ["get", "name"]];
function satStyle() {
  const halo = { "text-color": "#fff", "text-halo-color": "rgba(0,0,0,.85)", "text-halo-width": 1.6 };
  return {
    version: 8, glyphs: `${OFM}/fonts/{fontstack}/{range}.pbf`,
    sources: {
      img: { type: "raster", tiles: [SAT_IMG], tileSize: 256, maxzoom: 19, attribution: "Imagery: Esri, Maxar, Earthstar Geographics, USDA, USGS" },
      osm: { type: "vector", url: `${OFM}/planet`, attribution: "© OpenStreetMap contributors · OpenFreeMap" },
    },
    layers: [
      { id: "sat-bg", type: "background", paint: { "background-color": "#0e2a3a" } }, // ocean-toned while tiles load
      { id: "sat-img", type: "raster", source: "img", paint: { "raster-fade-duration": 0 } },
      { id: "sat-road-major", type: "line", source: "osm", "source-layer": "transportation", minzoom: 6, filter: ["in", ["get", "class"], ["literal", ["motorway", "trunk", "primary", "secondary", "tertiary"]]], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#fff", "line-opacity": .85, "line-width": ["interpolate", ["linear"], ["zoom"], 6, .6, 12, 2, 16, 7] } },
      { id: "sat-road-minor", type: "line", source: "osm", "source-layer": "transportation", minzoom: 12, filter: ["in", ["get", "class"], ["literal", ["minor", "service"]]], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#fff", "line-opacity": .6, "line-width": ["interpolate", ["linear"], ["zoom"], 12, .5, 16, 3.5] } },
      { id: "sat-road-names", type: "symbol", source: "osm", "source-layer": "transportation_name", minzoom: 11, layout: { "symbol-placement": "line", "text-field": nameExpr, "text-font": FALLBACK_FONT, "text-size": 11 }, paint: halo },
      { id: "sat-water-names", type: "symbol", source: "osm", "source-layer": "water_name", layout: { "text-field": nameExpr, "text-font": FALLBACK_FONT, "text-size": 12, "text-letter-spacing": .15 }, paint: { ...halo, "text-color": "#9fd3ff" } },
      { id: "sat-places", type: "symbol", source: "osm", "source-layer": "place", filter: ["in", ["get", "class"], ["literal", ["island", "city", "town", "village", "suburb", "hamlet"]]], layout: { "text-field": nameExpr, "text-font": FALLBACK_FONT, "text-size": ["match", ["get", "class"], "island", 15, "city", 15, "town", 13, 11.5] }, paint: halo },
    ],
  };
}
/* Esri basemaps, served as plain XYZ raster tiles with no key and no SDK.
   This is the answer to "how do I get the ArcGIS map in here": ArcGIS Map Viewer is flat
   because it is a 2D MapView, not because Esri's tiles are flat. Served into MapLibre they
   drape onto the globe projection like any other raster source, and every AllReady layer
   (AFN tracts, shelters, weather, hazards) keeps drawing on top of them unchanged. */
const ESRI = "https://services.arcgisonline.com/ArcGIS/rest/services";
const esriStyle = (base, ref, attribution) => () => ({
  version: 8,
  glyphs: `${OFM}/fonts/{fontstack}/{range}.pbf`,
  sources: {
    esri: { type: "raster", tiles: [`${ESRI}/${base}/MapServer/tile/{z}/{y}/{x}`], tileSize: 256, maxzoom: 19, attribution },
    ...(ref ? { esriRef: { type: "raster", tiles: [`${ESRI}/${ref}/MapServer/tile/{z}/{y}/{x}`], tileSize: 256, maxzoom: 19 } } : {}),
  },
  layers: [
    { id: "esri-bg", type: "background", paint: { "background-color": "#6b7280" } }, // neutral while tiles load, in either theme
    { id: "esri", type: "raster", source: "esri", paint: { "raster-fade-duration": 0 } },
    ...(ref ? [{ id: "esri-ref", type: "raster", source: "esriRef" }] : []),
  ],
});
const ESRI_CRED = "Esri, TomTom, Garmin, FAO, NOAA, USGS, Hawaiʻi Statewide GIS";

const BASES = {
  dark: { n: "Dark", style: () => "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json" },
  light: { n: "Light", style: () => "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json" },
  streets: { n: "Streets", style: () => `${OFM}/styles/liberty` },
  topo: { n: "Esri topo", style: esriStyle("World_Topo_Map", null, ESRI_CRED) },
  esriDark: { n: "Esri dark", style: esriStyle("Canvas/World_Dark_Gray_Base", "Canvas/World_Dark_Gray_Reference", ESRI_CRED) },
  esriLight: { n: "Esri light", style: esriStyle("Canvas/World_Light_Gray_Base", "Canvas/World_Light_Gray_Reference", ESRI_CRED) },
  esriSat: { n: "Esri imagery", style: esriStyle("World_Imagery", "Reference/World_Boundaries_and_Places", ESRI_CRED) },
  sat: { n: "Satellite + labels", style: satStyle },
};

// ---------- time: driven by the timeline panel (live, or any moment in the past year) ----------
const DAY = 864e5, HST = -10 * 36e5;
const hstDay = (ms) => new Date(ms + HST).toISOString().slice(0, 10);
const TIME = { live: true, t: Date.now(), from: Date.now() - 30 * DAY, to: Date.now(), day: hstDay(Date.now()), tm: null };
const gibs = (layer, set, ext) => `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer}/default/${TIME.day}/${set}/{z}/{y}/{x}.${ext}`;
// Live: the last 30 days. Replay: the trail window behind the playhead (set on the timeline).
const quakeFilter = () => (TIME.live ? [">=", ["get", "time"], Date.now() - 30 * DAY] : ["all", ["<=", ["get", "time"], TIME.to], [">=", ["get", "time"], TIME.from]]);
const rgbOf = (t) => { const c = col("afn", t); return `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`; };

// ---------- data held between style changes ----------
const EMPTY = { type: "FeatureCollection", features: [] };
const DATA = { nws: EMPTY, quake: EMPTY, shel: EMPTY, afn: EMPTY, tsu: EMPTY };
const WXIMG = {}; // id -> { g: dataURL, h: dataURL }
const wxState = {}; // id -> "loading" | "error"

// ---------- layer catalog ----------
const GROUPS = [["base", "gBase"], ["haz", "gHaz"], ["wx", "gWx"], ["needs", "gNeeds"], ["res", "gRes"], ["arc", "gArc"]];
const mkWx = (id, n, w, r, u) => ({ id, g: "wx", n, s: "Open-Meteo · " + u, d: "Current conditions over Hawaiʻi, smoothed. Planning context only; use NWS products for warnings.", ramp: r, w, sw: cssRamp(r), exclusive: true });
// DEFS order is also draw order, bottom to top: relief, weather, needs, hazards, resources (all under map labels)
const DEFS = [
  { id: "terrain", g: "base", n: "3D terrain", s: "AWS Terrain Tiles", d: "Lifts the map into real relief. Tilt with right-drag or the 3D tilt button.", sw: "linear-gradient(135deg,#2c3e2f,#9b8a63)", sys: "terrain", slider: "exag" },
  { id: "hill", g: "base", n: "Hillshade", s: "AWS Terrain Tiles", d: "Shaded relief to read ridges, valleys and slopes.", sw: "linear-gradient(90deg,#222,#ddd)" },
  { id: "roads", g: "base", n: "Roads", s: "OpenStreetMap", d: "Highways, streets and road names. Single-road corridors matter for evacuation.", sw: "#c9b37a", sys: "chrome" },
  { id: "labels", g: "base", n: "Place and water names", s: "OpenStreetMap", d: "Towns, islands and water labels.", sw: "#9aa3b5", sys: "chrome" },
  { id: "viirs", g: "wx", n: "VIIRS true color (daily)", s: "NASA GIBS · replays with timeline", d: "Daily satellite imagery from NASA VIIRS. Follows the timeline bar, so you can replay smoke, storms and cloud over the last 14 days.", sw: "linear-gradient(135deg,#1f3b2c,#4f6a45,#16324f)" },
  mkWx("temp", "Temperature", "temperature_2m", "temp", "2 m air"),
  mkWx("wind", "Wind", "wind_speed_10m", "wind", "10 m speed"),
  mkWx("rain", "Precipitation", "precipitation", "rain", "current"),
  mkWx("cloud", "Cloud cover", "cloud_cover", "cloud", "percent"),
  { id: "afn", g: "needs", n: "AFN need (census tracts)", s: "CDC/ATSDR SVI 2022 · ACS 2018-2022", d: "Every Hawaiʻi census tract, colored by its rank among Hawaiʻi tracts. Composite = average rank of disability, limited English, no vehicle and age 65+ (CMIST proxies). Public, de-identified, tract-level. Click a tract for counts.", ramp: "afn", sw: cssRamp("afn") },
  { id: "nfhl", g: "haz", n: "Flood hazard zones", s: "FEMA NFHL", d: "FEMA National Flood Hazard Layer. Draws when zoomed in to island or neighborhood scale.", sw: "#5aa9e6" },
  { id: "tsu", g: "haz", n: "Tsunami evacuation zones", s: "Hawaiʻi Statewide GIS", d: "Tsunami and extreme tsunami evacuation zones from the Hawaiʻi Statewide GIS Program (county data, updated 2025). A guideline, not a warning.", sw: "#22d3ee", leg: "tsu" },
  { id: "fires", g: "haz", n: "Active fire detections", s: "NASA FIRMS / VIIRS · replays", d: "VIIRS 375 m thermal anomalies from NASA FIRMS, served by NASA GIBS. Follows the timeline bar. A detection is heat, not a confirmed wildfire.", sw: "#fb923c" },
  { id: "nws", g: "haz", n: "NWS alerts", s: "api.weather.gov · live", d: "Active watches and warnings for Hawaiʻi, drawn on their forecast zones. Open the Alerts tab for the list.", sw: "#f2c14e", leg: "sev" },
  { id: "quake", g: "haz", n: "Earthquakes (M2.5+)", s: "USGS · replays a full year", d: "Magnitude 2.5 and above near the islands. Live view shows the last 30 days; in replay the map shows the timeline's trail window. Circle size is magnitude.", sw: "#e4572e", leg: "quake" },
  { id: "shel", g: "res", n: "Shelters (county plans)", s: "Honolulu DEM · HCCDA · Kauaʻi EMA · live", d: "Every shelter each county publishes as a live feature service, normalised onto one record shape. Ring colour is activation status; fill is whether the county has published an accessibility record. Maui publishes no machine-readable layer — see the Shelters panel.", sw: "#4d9fff", leg: "shel" },
];
const BYID = Object.fromEntries(DEFS.map((d) => [d.id, d]));

// How each layer type scales with the opacity slider
const OPP = { raster: [["raster-opacity", 1]], fill: [["fill-opacity", .28]], line: [["line-opacity", .95]], circle: [["circle-opacity", .85], ["circle-stroke-opacity", 1]], heatmap: [["heatmap-opacity", .95]], hillshade: [["hillshade-exaggeration", .6]], symbol: [["text-opacity", 1]] };
const BASEOP = {}; // layer id -> base opacity override

function labelFont() {
  try { const id = map.getStyle().layers.find((l) => l.type === "symbol" && l.layout?.["text-font"])?.id; if (id) return map.getLayoutProperty(id, "text-font"); } catch {}
  return FALLBACK_FONT;
}

function specOf(d) {
  if (d.arc) return arcSpec(d);
  switch (d.id) {
    case "hill": return { layers: [{ id: "hill", type: "hillshade", source: "demHill", paint: { "hillshade-shadow-color": "#050a14", "hillshade-highlight-color": "#ffffff", "hillshade-accent-color": "#26324a", "hillshade-illumination-direction": 315 } }] };
    case "nws": return { sources: { nws: { type: "geojson", data: DATA.nws } }, layers: [
      { id: "nws-fill", type: "fill", source: "nws", paint: { "fill-color": sevExpr() } },
      { id: "nws-line", type: "line", source: "nws", paint: { "line-color": sevExpr(), "line-width": 1.6 } }] };
    case "quake": return { sources: { quake: { type: "geojson", data: DATA.quake } }, layers: [
      { id: "quake", type: "circle", source: "quake", filter: quakeFilter(), paint: { "circle-color": "#e4572e", "circle-radius": ["interpolate", ["linear"], ["get", "mag"], 2, 3, 4, 8, 6, 20, 8, 34], "circle-stroke-color": "#fff", "circle-stroke-width": 1 } }] };
    case "scen": return { sources: { scen: { type: "geojson", data: scenGeo() } }, layers: [
      { id: "scen-fill", type: "fill", source: "scen", paint: { "fill-color": HZC[hz] || "#e4572e" } },
      { id: "scen-line", type: "line", source: "scen", paint: { "line-color": HZC[hz] || "#e4572e", "line-width": 2, "line-dasharray": [2, 2] } },
      { id: "scen-label", type: "symbol", source: "scen", layout: { "text-field": ["get", "label"], "text-font": labelFont(), "text-size": 12, "text-max-width": 16 }, paint: { "text-color": "#fff", "text-halo-color": "rgba(0,0,0,.85)", "text-halo-width": 1.6 } }] };
    case "afn": return { sources: { afn: { type: "geojson", data: DATA.afn } }, layers: [
      { id: "afn", type: "fill", source: "afn", paint: { "fill-color": ["interpolate", ["linear"], ["get", "v"], 0, rgbOf(0), 20, rgbOf(.2), 40, rgbOf(.4), 60, rgbOf(.6), 80, rgbOf(.8), 100, rgbOf(1)] }, _b: 1.6 },
      { id: "afn-line", type: "line", source: "afn", paint: { "line-color": "rgba(128,128,140,.35)", "line-width": .4 } }] };
    case "tsu": return { sources: { tsu: { type: "geojson", data: DATA.tsu } }, layers: [
      { id: "tsu-fill", type: "fill", source: "tsu", paint: { "fill-color": ["match", ["get", "zone_type"], "Extreme Tsunami Evacuation Zone", "#a78bfa", "Tsunami Evacuation Zone", "#22d3ee", "#94a3b8"] } },
      { id: "tsu-line", type: "line", source: "tsu", paint: { "line-color": "#e0f7ff", "line-width": .6 } }] };
    case "fires": return { sources: { fires: { type: "raster", tiles: [gibs("VIIRS_SNPP_Thermal_Anomalies_375m_All", "GoogleMapsCompatible_Level9", "png")], tileSize: 256, maxzoom: 9, attribution: "NASA FIRMS / GIBS" } }, layers: [{ id: "fires", type: "raster", source: "fires", paint: { "raster-fade-duration": 0 } }] };
    case "viirs": return { sources: { viirs: { type: "raster", tiles: [gibs("VIIRS_SNPP_CorrectedReflectance_TrueColor", "GoogleMapsCompatible_Level9", "jpg")], tileSize: 256, maxzoom: 9, attribution: "NASA GIBS / VIIRS" } }, layers: [{ id: "viirs", type: "raster", source: "viirs", paint: { "raster-fade-duration": 0 } }] };
    case "nfhl": return { sources: { nfhl: { type: "raster", tiles: ["https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/export?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&format=png32&transparent=true&layers=show:28&f=image"], tileSize: 256, minzoom: 8, attribution: "FEMA NFHL" } }, layers: [{ id: "nfhl", type: "raster", source: "nfhl", paint: { "raster-opacity": .8 } }] };
    // Fill says what the county published about accessibility; ring says activation status.
    // Grey is "never told us", which is a different fact from "not accessible".
    case "shel": return { sources: { shel: { type: "geojson", data: DATA.shel } }, layers: [
      { id: "shel-pt", type: "circle", source: "shel", paint: {
        "circle-color": ["match", ["get", "adaS"], "yes", "#4fd18b", "no", "#ff5f52", "#7a8699"],
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 3.5, 11, 6, 15, 11],
        "circle-stroke-color": ["match", ["get", "status"], "open", "#e8b84b", "#0a0d12"],
        "circle-stroke-width": ["match", ["get", "status"], "open", 2.5, 1.2] } },
      { id: "shel-lb", type: "symbol", source: "shel", minzoom: 11, layout: { "text-field": ["get", "name"], "text-font": labelFont(), "text-size": 11, "text-offset": [0, 1.1], "text-anchor": "top", "text-max-width": 11 }, paint: { "text-color": "#e9edf3", "text-halo-color": "rgba(0,0,0,.9)", "text-halo-width": 1.5 } }] };
  }
  if (d.w) { // weather: only once the image has been painted
    const im = WXIMG[d.id]; if (!im) return { layers: [] };
    const b = (r) => [[r.w, r.n], [r.e, r.n], [r.e, r.s], [r.w, r.s]];
    return { sources: { [d.id + "-h"]: { type: "image", url: im.h, coordinates: b(RECT) } }, layers: [
      { id: d.id + "-h", type: "raster", source: d.id + "-h", paint: { "raster-resampling": "linear", "raster-fade-duration": 0 }, _b: 1 }] };
  }
  return { layers: [] };
}
// ArcGIS layers added by URL or from the presets (see src/arcgis.js)
const hostOf = (u) => { try { return new URL(u).hostname; } catch { return "ArcGIS"; } };
function arcSpec(d) {
  const a = d.arc, c = d.sw, attribution = (a.attribution || hostOf(a.url)).slice(0, 120);
  if (a.kind !== "feature") return { sources: { [d.id]: { type: "raster", tiles: [Arc.rasterTiles(a)], tileSize: 256, maxzoom: a.maxLod ?? 22, attribution } }, layers: [{ id: d.id, type: "raster", source: d.id, paint: { "raster-fade-duration": 0 } }] };
  const sources = { [d.id]: { type: "geojson", data: DATA[d.id] || EMPTY, attribution } };
  if (a.geom === "point") return { sources, layers: [{ id: d.id + "-pt", type: "circle", source: d.id, paint: { "circle-color": c, "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 3.5, 13, 7], "circle-stroke-color": "#fff", "circle-stroke-width": 1.2 } }] };
  if (a.geom === "line") return { sources, layers: [{ id: d.id + "-ln", type: "line", source: d.id, paint: { "line-color": c, "line-width": 1.6 } }] };
  return { sources, layers: [{ id: d.id + "-fill", type: "fill", source: d.id, paint: { "fill-color": c } }, { id: d.id + "-ln", type: "line", source: d.id, paint: { "line-color": c, "line-width": 0.8 } }] };
}
const sevExpr = () => ["match", ["get", "severity"], "Extreme", "#ff4d4d", "Severe", "#ff8a1f", "Moderate", "#f2c14e", "Minor", "#5aa9e6", "#9aa3b5"];
const layerIds = (d) => specOf(d).layers.map((l) => l.id);
const ARC_COL = ["#c084fc", "#f472b6", "#34d399", "#facc15", "#60a5fa", "#fb7185", "#a3e635", "#2dd4bf"];
const arcState = {};
const arcDef = (a) => ({ id: a.id, g: "arc", n: a.name, s: "ArcGIS · " + hostOf(a.url), d: (a.kind === "feature" ? "Features from a public ArcGIS layer, drawn in the browser. Click one for its attributes." : "Map image drawn by a public ArcGIS service.") + (a.attribution ? " Credit: " + a.attribution : ""), sw: a.color, arc: a, leg: "arc" });
(S.arc || []).forEach((a) => { const d = arcDef(a); DEFS.push(d); BYID[d.id] = d; });

// A circle polygon (km) for the illustrative scenario zone
function scenGeo() {
  const c = isl || ISL.oahu, r = (isl ? isl[4] : 30) * 1000, pts = [];
  for (let i = 0; i <= 64; i++) { const a = (i / 64) * 2 * Math.PI, dLat = (r * Math.cos(a)) / 111320, dLon = (r * Math.sin(a)) / (111320 * Math.cos((c[2] * Math.PI) / 180)); pts.push([c[1] + dLon, c[2] + dLat]); }
  const name = hz ? hz[0].toUpperCase() + hz.slice(1) : "Scenario";
  return { type: "Feature", properties: { label: `Illustrative ${name.toLowerCase()} scenario zone${isl ? " · " + isl[0] : ""}` }, geometry: { type: "Polygon", coordinates: [pts] } };
}

// ---------- map ----------
let map;
try {
  map = new maplibregl.Map({
    container: "map", style: BASES[S.base].style(), center: HI.c, zoom: HI.z, minZoom: 2, maxZoom: 19, maxPitch: 75,
    attributionControl: { compact: true }, canvasContextAttributes: { antialias: true }, pixelRatio: Math.max(DPR, 1), fadeDuration: 100, maxTileCacheSize: 500, refreshExpiredTiles: false,
  });
} catch (e) { $("nogl").hidden = false; throw e; }
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");
map.on("error", (e) => { if (e?.error && !/Failed to fetch|NetworkError|AJAXError|404|403/i.test(String(e.error.message || e.error))) console.warn("map:", e.error); });

const firstSymbol = () => map.getStyle().layers.find((l) => l.type === "symbol" && !OURS().has(l.id))?.id;
const OURS = () => new Set(DEFS.flatMap(layerIds));
function beforeFor(d) { // keep catalog order: layers later in DEFS draw above earlier ones, all under map labels
  for (let i = DEFS.indexOf(d) + 1; i < DEFS.length; i++) for (const id of layerIds(DEFS[i])) if (map.getLayer(id)) return id;
  return firstSymbol();
}
function addDef(d) {
  const sp = specOf(d); if (!sp.layers.length) return;
  for (const [id, s] of Object.entries(sp.sources || {})) if (!map.getSource(id)) map.addSource(id, s);
  const before = beforeFor(d);
  for (const l of sp.layers) { if (map.getLayer(l.id)) continue; const { _b, ...ly } = l; if (_b != null) BASEOP[l.id] = _b; map.addLayer(ly, before); }
}
function setVis(d) {
  for (const id of layerIds(d)) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", S.on[d.id] ? "visible" : "none");
}
function setOp(d) {
  const o = S.op[d.id] ?? 1;
  for (const l of specOf(d).layers) {
    if (!map.getLayer(l.id)) continue;
    const k = BASEOP[l.id] ?? 1;
    for (const [p, b] of OPP[l.type] || []) map.setPaintProperty(l.id, p, Math.min(1, b * o * k));
  }
}
function applyChrome() { // roads and labels switches act on whatever the current basemap draws
  const ours = OURS();
  for (const l of map.getStyle().layers) {
    if (ours.has(l.id) || l.type === "background" || l.type === "raster" || l.type === "hillshade") continue;
    const sl = l["source-layer"] || "", isRoad = sl === "transportation" || sl === "transportation_name";
    let on = true;
    if (l.type === "symbol") on = S.on.labels && !(isRoad && !S.on.roads);
    else if (sl === "transportation") on = S.on.roads;
    else continue;
    map.setLayoutProperty(l.id, "visibility", on ? "visible" : "none");
  }
}
function applyTerrain() {
  if (!map.getSource("dem")) return;
  // Terrain is only meaningful zoomed in. Far out (or on the globe) the elevation tiles tear
  // into blocks and hold up the basemap, so it is suspended there and resumes on the way back in.
  const want = S.on.terrain && map.getZoom() >= 7.5 && !globeOn;
  try { if (!!map.getTerrain() !== want) map.setTerrain(want ? { source: "dem", exaggeration: S.exag } : null); } catch {}
}
map.on("zoomend", applyTerrain);
function rebuild() {
  // Terrain and hillshade need separate sources: sharing one makes MapLibre reuse the
  // same tile cache for two different samplers and the relief comes out muddy.
  if (!map.getSource("dem")) map.addSource("dem", { type: "raster-dem", tiles: [DEM], encoding: "terrarium", tileSize: 256, maxzoom: 15, attribution: "Terrain: AWS Terrain Tiles (USGS, NASA, others)" });
  if (!map.getSource("demHill")) map.addSource("demHill", { type: "raster-dem", tiles: [DEM], encoding: "terrarium", tileSize: 256, maxzoom: 15 });
  DEFS.forEach(addDef);
  DEFS.forEach((d) => { setVis(d); setOp(d); });
  applyChrome(); applyTerrain();
  // Markup draws above everything else, and has to be re-attached after every setStyle.
  annotations?.attach();
  try { map.setProjection({ type: globeOn ? "globe" : "mercator" }); } catch {}
  DEFS.filter((d) => d.w && S.on[d.id]).forEach((d) => ensureWx(d));
}
map.on("style.load", rebuild);

// ---------- weather grids (Open-Meteo, no key) ----------
const mkGrid = (a0, a1, o0, o1, d) => { const la = [], lo = []; for (let a = a0; a <= a1 + 1e-6; a += d) la.push(+a.toFixed(3)); for (let o = o0; o <= o1 + 1e-6; o += d) lo.push(+o.toFixed(3)); return { la, lo }; };
/* 0.5° is already finer than the forecast model's own grid, and it keeps one read to about
   a hundred points. Open-Meteo's free tier counts every point as a call, so a dense grid
   re-read on every page load runs a planner out of quota within the hour. */
const GRID = { h: mkGrid(RECT.s, RECT.n, RECT.w, RECT.e, .5) }, grid = {};
const WX_KEY = "allready.wx.v1", WX_TTL = 30 * 60 * 1000;
let wxWhy = "", wxRead = 0;
const WV = ["temperature_2m", "wind_speed_10m", "precipitation", "cloud_cover"];
const gridP = {}; // one read at a time, however many weather layers ask
function loadGrid(k) { return (gridP[k] ||= readGrid(k).finally(() => { delete gridP[k]; })); }
async function readGrid(k) {
  if (grid[k] && Date.now() - grid[k].t < WX_TTL) return;
  const g = GRID[k], n = g.la.length * g.lo.length;
  const kept = store.get(WX_KEY, null), usable = kept && kept.n === n && Array.isArray(kept.d);
  if (usable && Date.now() - kept.t < WX_TTL) { grid[k] = { g, d: kept.d, t: kept.t }; wxRead = kept.t; return; }
  const pts = []; g.la.forEach((a) => g.lo.forEach((o) => pts.push([a, o])));
  const u = "https://api.open-meteo.com/v1/forecast?current=" + WV + "&wind_speed_unit=kmh&latitude=" + pts.map((p) => p[0]) + "&longitude=" + pts.map((p) => p[1]);
  try {
    const r = await fetch(u, { signal: AbortSignal.timeout(usable ? 8000 : 15000) });
    if (!r.ok) throw new Error(r.status === 429 ? "Open-Meteo is rate-limiting this network; try again in a few minutes" : "Open-Meteo answered " + r.status);
    const j = await r.json(), d = (Array.isArray(j) ? j : [j]).map((x) => x.current);
    if (d.length !== n || !d[0]) throw new Error("Open-Meteo sent an incomplete grid");
    grid[k] = { g, d, t: Date.now() }; wxRead = grid[k].t; wxWhy = "";
    store.set(WX_KEY, { t: grid[k].t, n, d });
  } catch (e) {
    // An older reading is still a real reading: show it, dated, rather than nothing.
    if (!usable) throw /Open-Meteo/.test(e?.message || "") ? e : new Error("Open-Meteo did not answer (the service or this network)");
    grid[k] = { g, d: kept.d, t: kept.t }; wxRead = kept.t; wxWhy = "showing the last reading";
  }
}
function samp(k, v, lat, lon) {
  const gr = grid[k]; if (!gr) return null;
  const { la, lo } = gr.g, n = lo.length;
  const fy = Math.max(0, Math.min(la.length - 1.001, (lat - la[0]) / (la[1] - la[0]))), fx = Math.max(0, Math.min(n - 1.001, (lon - lo[0]) / (lo[1] - lo[0])));
  const y = fy | 0, x = fx | 0, a = fy - y, b = fx - x, q = (i, j) => gr.d[i * n + j]?.[v] ?? 0;
  return q(y, x) * (1 - a) * (1 - b) + q(y, x + 1) * (1 - a) * b + q(y + 1, x) * a * (1 - b) + q(y + 1, x + 1) * a * b;
}
const mercY = (la) => Math.log(Math.tan(Math.PI / 4 + (la * Math.PI) / 360));
const invMerc = (y) => ((2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180) / Math.PI;
function blur(v, w, h, r) { // box blur x2: Open-Meteo values snap to its model grid, which looks like blocks until smoothed
  if (!r) return v;
  for (let pass = 0; pass < 2; pass++) for (const horiz of [1, 0]) {
    const o = new Float32Array(v.length), n = horiz ? w : h, m = horiz ? h : w;
    for (let j = 0; j < m; j++) { let acc = 0, cnt = 0; const at = (i) => (horiz ? v[j * w + i] : v[i * w + j]);
      for (let i = -r; i <= r; i++) if (i >= 0 && i < n) { acc += at(i); cnt++; }
      for (let i = 0; i < n; i++) { (horiz ? o : o)[horiz ? j * w + i : i * w + j] = acc / cnt; const add = i + r + 1, del = i - r; if (add < n) { acc += at(add); cnt++; } if (del >= 0) { acc -= at(del); cnt--; } } }
    v = o;
  }
  return v;
}
function paint(k, w, h, r, fn, feather, blurPx) { // rows follow Web Mercator so the image lines up with the map
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const x = c.getContext("2d"), im = x.createImageData(w, h), m = R[k], y0 = mercY(r.n), y1 = mercY(r.s);
  let v = new Float32Array(w * h);
  for (let j = 0; j < h; j++) { const lat = invMerc(y0 + ((y1 - y0) * (j + .5)) / h); for (let i = 0; i < w; i++) v[j * w + i] = fn(lat, r.w + ((r.e - r.w) * (i + .5)) / w); }
  v = blur(v, w, h, blurPx || 0);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const c4 = col(k, (v[j * w + i] - m.min) / (m.max - m.min)), o = (j * w + i) * 4, f = feather ? Math.min(1, Math.min(i, j, w - 1 - i, h - 1 - j) / feather) : 1;
    im.data[o] = c4[0]; im.data[o + 1] = c4[1]; im.data[o + 2] = c4[2]; im.data[o + 3] = c4[3] * 255 * f;
  }
  x.putImageData(im, 0, 0); return c.toDataURL();
}
async function ensureWx(d) {
  const fresh = grid.h && Date.now() - grid.h.t < WX_TTL;
  if (WXIMG[d.id] && fresh && WXIMG[d.id].t === grid.h.t) { addDef(d); setVis(d); setOp(d); return; }
  if (wxState[d.id] === "loading") return;
  wxState[d.id] = "loading"; renderGroups();
  try {
    await loadGrid("h");
    const url = paint(d.ramp, 900, 540, RECT, (a, o) => samp("h", d.w, a, o), 30, 14);
    WXIMG[d.id] = { h: url, t: grid.h.t };
    delete wxState[d.id];
    const srcId = d.id + "-h";
    if (map.getSource(srcId)) { if (TIME.live) map.getSource(srcId).updateImage({ url, coordinates: [[RECT.w, RECT.n], [RECT.e, RECT.n], [RECT.e, RECT.s], [RECT.w, RECT.s]] }); }
    else addDef(d);
    setVis(d); setOp(d);
  } catch (e) { wxState[d.id] = "error"; wxWhy = String(e?.message || "Open-Meteo could not be reached"); console.warn("weather:", e); }
  renderGroups(); renderLegend();
}
// Weather is re-read on the same half-hour cycle as the other feeds.
function reloadWx() { DEFS.filter((d) => d.w && S.on[d.id]).forEach((d) => ensureWx(d)); }

// ---------- live data: NWS alerts and USGS earthquakes ----------
let alerts = [];
const SEV = { Extreme: 4, Severe: 3, Moderate: 2, Minor: 1 };
const zoneCache = {};
async function zoneGeom(u) {
  if (zoneCache[u] !== undefined) return zoneCache[u];
  try { const r = await fetch(u, { headers: { Accept: "application/geo+json" } }); zoneCache[u] = r.ok ? (await r.json()).geometry : null; } catch { zoneCache[u] = null; }
  return zoneCache[u];
}
async function loadAlerts() {
  $("alertSrc").textContent = "Checking National Weather Service…";
  try {
    const r = await fetch("https://api.weather.gov/alerts/active?area=HI", { headers: { Accept: "application/geo+json" } });
    if (!r.ok) throw new Error(r.status);
    const fs = (await r.json()).features || [];
    const zones = [...new Set(fs.filter((f) => !f.geometry).flatMap((f) => f.properties.affectedZones || []))].slice(0, 30);
    await Promise.all(zones.map(zoneGeom));
    READ.nws = Date.now();
    alerts = fs.map((f) => ({ p: f.properties, g: f.geometry || zonesUnion(f.properties.affectedZones) })).sort((a, b) => (SEV[b.p.severity] || 0) - (SEV[a.p.severity] || 0));
    DATA.nws = { type: "FeatureCollection", features: alerts.filter((a) => a.g).map((a) => ({ type: "Feature", geometry: a.g, properties: { severity: a.p.severity, event: a.p.event, headline: a.p.headline, area: a.p.areaDesc, ends: a.p.ends || a.p.expires || "", desc: a.p.instruction || a.p.description || "" } })) };
    if (TIME.live) map.getSource("nws")?.setData(DATA.nws); renderMarks(); refreshPanels();
    $("alertSrc").textContent = "NWS · updated " + new Date().toLocaleTimeString("en-US", { timeZone: "Pacific/Honolulu", hour: "2-digit", minute: "2-digit" }) + " HST";
  } catch { $("alertSrc").textContent = "NWS alerts unavailable right now."; }
  renderAlerts();
}
function zonesUnion(urls = []) {
  const polys = urls.map((u) => zoneCache[u]).filter(Boolean).flatMap((g) => (g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : []));
  return polys.length ? { type: "MultiPolygon", coordinates: polys } : null;
}
let quakeLoading = null;
function loadQuakes() { // one request covers the whole timeline: M2.5+ for the past year
  if (quakeLoading) return quakeLoading;
  const from = new Date(Date.now() - 366 * DAY).toISOString().slice(0, 10);
  quakeLoading = (async () => {
    try {
      const r = await fetch(`https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${from}&minlatitude=18&maxlatitude=23&minlongitude=-161&maxlongitude=-154&minmagnitude=2.5&orderby=time&limit=20000`);
      if (!r.ok) throw new Error(r.status);
      DATA.quake = await r.json(); map.getSource("quake")?.setData(DATA.quake); renderMarks(); renderGroups();
    } catch { quakeLoading = null; }
  })();
  return quakeLoading;
}
// ---------- county shelter feeds (the supply side of every gap figure) ----------
const SHEL = { list: [], score: [], actions: [], state: null, errors: [] };
let EMP = null, empState = null;

async function loadShelterFeeds() {
  if (SHEL.state === "loading" || SHEL.list.length) return;
  SHEL.state = "loading"; renderGroups(); refreshPanels();
  try {
    const { shelters, errors } = await loadShelters();
    SHEL.list = shelters; SHEL.errors = errors;
    SHEL.score = readiness(shelters);
    SHEL.actions = dataActions(SHEL.score);
    DATA.shel = toGeoJSON(shelters);
    map.getSource("shel")?.setData(DATA.shel);
    SHEL.state = shelters.length ? null : "error"; READ.shel = Date.now();
  } catch (e) { SHEL.state = "error"; console.warn("shelters:", e); }
  renderGroups(); renderLegend(); refreshPanels();
}

async function loadEmp() {
  if (empState === "loading" || EMP) return;
  empState = "loading"; refreshPanels();
  try { EMP = await loadEmpower(); empState = null; READ.emp = Date.now(); }
  catch (e) { empState = "error"; console.warn("empower:", e); }
  refreshPanels();
}

// ---------- UI helpers ----------
function h(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k === "class") n.className = v; else if (k === "style") n.style.cssText = v; else if (k.startsWith("on")) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? "" : v); }
  for (const k of kids.flat()) if (k != null) n.append(k.nodeType ? k : document.createTextNode(k));
  return n;
}
const activeData = () => DEFS.filter((d) => d.g !== "base" && S.on[d.id]);

// ---------- layer panel ----------
const openRows = new Set();
let filter = "";
function renderGroups() {
  const root = $("groups"), keep = root.scrollTop; root.textContent = "";
  let shown = 0;
  for (const [gid, key] of GROUPS) {
    const defs = DEFS.filter((d) => d.g === gid && (!filter || (d.n + " " + d.s).toLowerCase().includes(filter)));
    if (!defs.length && (filter || gid !== "base")) continue;
    shown += defs.length;
    const nOn = defs.filter((d) => S.on[d.id] && gid !== "base").length;
    const det = h("details", { class: "grp", ...(S.open[gid] || filter ? { open: true } : {}), "data-g": gid },
      h("summary", {}, h("span", {}, t(key)), nOn ? h("b", { class: "cnt" }, String(nOn)) : null));
    det.addEventListener("toggle", () => { if (!filter) { S.open[gid] = det.open ? 1 : 0; save(); } });
    if (gid === "base" && !filter) det.append(h("div", { class: "seg", role: "radiogroup", "aria-label": "Basemap" }, Object.entries(BASES).map(([k, v]) => h("button", { type: "button", role: "radio", "aria-checked": S.base === k, "data-base": k }, v.n))));
    const ul = h("ul", { class: "lyrs" });
    defs.forEach((d) => ul.append(row(d)));
    det.append(ul); root.append(det);
  }
  if (!shown) root.append(h("p", { class: "src pad" }, t("noMatch")));
  root.scrollTop = keep;
  dock?.badge("layers", activeData().length || "");
}
function status(d) {
  if (d.id === "afn") return afnState === "loading" ? "loading…" : afnState === "error" ? "feed unavailable" : S.on.afn && DATA.afn.features.length ? DATA.afn.features.length + " tracts" : null;
  if (d.id === "tsu") return tsuState === "loading" ? "loading…" : tsuState === "error" ? "feed unavailable" : null;
  if (d.w) return wxState[d.id] === "loading" ? "loading…" : wxState[d.id] === "error" ? (wxWhy || "feed unavailable") + " · switch off and on to retry" : S.on[d.id] && wxRead ? `read ${stamp(wxRead)}${wxWhy ? " · " + wxWhy : ""}` : null;
  if (d.id === "shel") return SHEL.state === "loading" ? "loading county feeds…" : SHEL.state === "error" ? "county feeds unavailable" : SHEL.list.length ? `${SHEL.list.length} from ${SHEL.score.filter((c) => c.published).length} of 4 counties` : null;
  if (d.id === "nws") return S.on.nws && alerts.length ? alerts.length + " active" : null;
  if (d.id === "quake") return S.on.quake && DATA.quake.features?.length ? DATA.quake.features.length.toLocaleString() + " events in the past year" : null;
  if (d.arc) return arcState[d.id] === "loading" ? "loading…" : arcState[d.id] === "error" ? "service unavailable" : DATA[d.id]?.features?.length ? DATA[d.id].features.length.toLocaleString() + " features · " + hostOf(d.arc.url) : null;
  return null;
}
function row(d) {
  const id = "sw-" + d.id, open = openRows.has(d.id), st = status(d);
  const more = h("div", { class: "more", id: "mo-" + d.id, ...(open ? {} : { hidden: true }) },
    d.ramp ? h("div", { class: "ramp", style: "background:" + cssRamp(d.ramp) }) : null,
    d.ramp ? h("div", { class: "lab" }, h("span", {}, R[d.ramp].min + " " + R[d.ramp].u), h("span", {}, R[d.ramp].max + " " + R[d.ramp].u)) : null,
    d.slider === "exag"
      ? h("label", {}, "Relief exaggeration ", h("b", {}, S.exag.toFixed(1) + "×"), h("input", { type: "range", min: "1", max: "3", step: "0.1", value: S.exag, "data-exag": "1" }))
      : (!d.sys ? h("label", {}, t("op") + " ", h("b", {}, Math.round((S.op[d.id] ?? 1) * 100) + "%"), h("input", { type: "range", min: "5", max: "100", value: Math.round((S.op[d.id] ?? 1) * 100), "data-op": d.id })) : null),
    d.id === "afn" ? (() => { const sel = h("select", { class: "sel", "data-afnmode": "1", "aria-label": "AFN measure" }, ...AFNM.map(([k, n]) => h("option", { value: k }, n))); sel.value = S.afnMode; return h("label", {}, "Show ", sel); })() : null,
    d.id === "scen" || d.id === "afn" ? h("button", { type: "button", class: "link", "data-zoom": d.id }, t("zoomTo")) : null,
    d.arc ? h("p", { class: "src" }, d.arc.url) : null,
    d.arc ? h("button", { type: "button", class: "link", "data-arcdel": d.id }, "Remove this layer") : null);
  return h("li", { class: "lyr" + (S.on[d.id] ? " on" : ""), "data-id": d.id },
    h("div", { class: "lr" },
      h("input", { type: "checkbox", role: "switch", id, class: "swi", checked: !!S.on[d.id], "data-sw": d.id, "aria-label": d.n }),
      h("label", { for: id, class: "sw" }, h("i", {})),
      h("span", { class: "chipc", style: "background:" + d.sw }),
      h("label", { for: id, class: "nm" }, h("b", {}, d.n), h("em", {}, st || d.s)),
      h("button", { type: "button", class: "ex", "data-ex": d.id, "aria-expanded": open, "aria-controls": "mo-" + d.id, "aria-label": t("details") + ": " + d.n },
        h("svg", { width: 12, height: 12, viewBox: "0 0 10 10", "aria-hidden": "true" }, (() => { const p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("d", "M1 3l4 4 4-4"); p.setAttribute("fill", "none"); p.setAttribute("stroke", "currentColor"); p.setAttribute("stroke-width", "1.4"); return p; })()))),
    more);
}
function toggle(id, on) {
  const d = BYID[id]; if (!d) return;
  S.on[id] = on;
  if (on && d.exclusive) DEFS.filter((x) => x.exclusive && x.id !== id).forEach((x) => { S.on[x.id] = false; setVis(x); });
  if (d.sys === "terrain") applyTerrain();
  else if (d.sys === "chrome") applyChrome();
  else if (on && d.w) ensureWx(d);
  else { if (on) addDef(d); setVis(d); setOp(d); }
  if (on && id === "quake" && !DATA.quake.features.length) loadQuakes().then(() => renderLegend());
  if (on && id === "shel") loadShelterFeeds();
  if (on && id === "afn") loadAfn();
  if (on && id === "tsu") loadTsu();
  if (on && d.arc?.kind === "feature" && !DATA[id]) loadArc(d);
  save(); renderGroups(); renderLegend();
}
$("groups").addEventListener("change", (e) => { if (e.target.dataset.afnmode) { S.afnMode = e.target.value; applyAfn(); save(); return; } const s = e.target.closest("[data-sw]"); if (s) toggle(s.dataset.sw, s.checked); });
$("groups").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.base) { setBase(b.dataset.base); return; }
  if (b.dataset.ex) { const id = b.dataset.ex; openRows.has(id) ? openRows.delete(id) : openRows.add(id); const m = $("mo-" + id); m.hidden = !openRows.has(id); b.setAttribute("aria-expanded", openRows.has(id)); return; }
  if (b.dataset.zoom) { const id = b.dataset.zoom; if (id === "scen" && isl) fly(isl); else flyHi(); }
  if (b.dataset.arcdel) removeArc(b.dataset.arcdel);
});
$("groups").addEventListener("input", (e) => {
  const r = e.target;
  if (r.dataset.exag) { S.exag = +r.value; r.previousElementSibling.textContent = S.exag.toFixed(1) + "×"; applyTerrain(); save(); }
  else if (r.dataset.op) { S.op[r.dataset.op] = r.value / 100; r.previousElementSibling.textContent = r.value + "%"; setOp(BYID[r.dataset.op]); save(); }
});
$("clearAll").onclick = () => { activeData().forEach((d) => { S.on[d.id] = false; setVis(d); }); save(); renderGroups(); renderLegend(); };
$("q").addEventListener("input", (e) => { filter = e.target.value.trim().toLowerCase(); renderGroups(); });
/* The basemap follows the theme until the planner picks one deliberately. A dark console
   over a white basemap (or the reverse) is the single ugliest thing this app can do, and
   nobody should have to fix it by hand every time they flip the switch. */
const THEME_BASE = { dark: "dark", light: "light" };
function setBase(k, { auto = false } = {}) {
  if (!auto) S.baseAuto = false;
  if (k === S.base) { save(); return; }
  S.base = k; save();
  map.setStyle(BASES[k].style(), { diff: false }); renderGroups();
}
if (S.baseAuto !== false) setBase(THEME_BASE[resolved()], { auto: true });
onTheme((r) => { if (S.baseAuto !== false) setBase(THEME_BASE[r], { auto: true }); });


// ---------- alerts tab ----------
function renderAlerts() {
  const ul = $("alertList"); ul.textContent = "";
  dock?.badge("alerts", alerts.length || "");
  rail?.badge("alerts", alerts.length || "", alerts.some((a) => a.p.severity === "Extreme" || a.p.severity === "Severe"));
  if (!TIME.live) { // replay: the list is the archive at the playhead, not today's feed
    $("alertSrc").textContent = "In force at the playhead · NWS archive (IEM)";
    if (!histAlerts.length) ul.append(h("li", { class: "src pad" }, "No alerts were in force for Hawaiʻi at this moment."));
    const f = (ms) => new Date(ms).toLocaleString("en-US", { timeZone: "Pacific/Honolulu", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    histAlerts.forEach((a) => ul.append(h("li", {}, h("div", { class: "alert sev-" + a.severity },
      h("span", { class: "ev" }, a.severity), h("b", {}, a.event), h("em", {}, a.zones.join(", ")), h("em", {}, f(a.t0) + " → " + f(a.t1) + " HST")))));
    return;
  }
  if (!alerts.length) ul.append(h("li", { class: "src pad" }, t("noAlerts")));
  alerts.forEach((a, i) => ul.append(h("li", {}, h("button", { type: "button", class: "alert sev-" + (a.p.severity || "x"), "data-a": i },
    h("span", { class: "ev" }, a.p.event || "Alert"), h("b", {}, a.p.headline || a.p.event), h("em", {}, a.p.areaDesc || "")))));
  renderGroups();
}
$("alertList").addEventListener("click", (e) => {
  const b = e.target.closest("[data-a]"); if (!b) return; const a = alerts[+b.dataset.a];
  showInspector({ tag: "NWS alert", title: a.p.event, rows: [["Severity", a.p.severity], ["Area", a.p.areaDesc], ["Until", a.p.ends || a.p.expires ? new Date(a.p.ends || a.p.expires).toLocaleString("en-US", { timeZone: "Pacific/Honolulu" }) + " HST" : "–"]], note: a.p.headline });
  if (a.g) { const bb = bbox(a.g); map.fitBounds(bb, { padding: 80, duration: REDUCED ? 0 : 1200, maxZoom: 10 }); } else flyHi();
});
$("alertRefresh").onclick = loadAlerts;
function bbox(g) { let w = 180, s = 90, e = -180, n = -90; (function walk(c) { if (typeof c[0] === "number") { w = Math.min(w, c[0]); e = Math.max(e, c[0]); s = Math.min(s, c[1]); n = Math.max(n, c[1]); } else c.forEach(walk); })(g.coordinates); return [[w, s], [e, n]]; }

// ---------- legend ----------
function renderLegend() {
  const box = $("legend"); box.textContent = "";
  for (const d of activeData()) {
    if (d.ramp) box.append(h("div", { class: "lg" }, h("div", { class: "lgn" }, d.n), h("div", { class: "ramp", style: "background:" + cssRamp(d.ramp) }), h("div", { class: "lab" }, h("span", {}, R[d.ramp].min + " " + R[d.ramp].u), h("span", {}, R[d.ramp].max + " " + R[d.ramp].u))));
    else if (d.leg === "sev") box.append(h("div", { class: "lg" }, h("div", { class: "lgn" }, d.n), h("div", { class: "sevs" }, [["Extreme", "#ff4d4d"], ["Severe", "#ff8a1f"], ["Moderate", "#f2c14e"], ["Minor", "#5aa9e6"]].map(([n, c]) => h("span", {}, h("i", { style: "background:" + c }), n)))));
    else if (d.leg === "quake") box.append(h("div", { class: "lg" }, h("div", { class: "lgn" }, d.n), h("div", { class: "src" }, "Circle size = magnitude")));
    else if (d.leg === "tsu") box.append(h("div", { class: "lg" }, h("div", { class: "lgn" }, d.n), h("div", { class: "sevs" }, [["Evacuation", "#22d3ee"], ["Extreme", "#a78bfa"]].map(([n, c]) => h("span", {}, h("i", { style: "background:" + c }), n)))));
    else if (d.leg === "shel") box.append(h("div", { class: "lg" }, h("div", { class: "lgn" }, d.n),
      h("div", { class: "sevs" }, [["ADA accessible", "#4fd18b"], ["Not accessible", "#ff5f52"], ["Not published", "#7a8699"]].map(([n, c]) => h("span", {}, h("i", { style: "background:" + c }), n))),
      h("div", { class: "src" }, "Gold ring = the county has it open now. Grey is a missing record, not a “no”.")));
    else if (d.id === "scen") box.append(h("div", { class: "lg" }, h("div", { class: "lgn" }, d.n), h("div", { class: "src" }, "Illustrative area, not a hazard map")));
    else if (d.arc) box.append(h("div", { class: "lg" }, h("div", { class: "sevs" }, h("span", {}, h("i", { style: "background:" + d.sw }), d.n)), h("div", { class: "src" }, d.arc.attribution ? d.arc.attribution.slice(0, 60) : hostOf(d.arc.url))));
  }
  box.hidden = !box.children.length; $("legendEmpty").hidden = !box.hidden;
}

// ---------- inspector ----------
let pin = null;
function showInspector({ tag, title, rows, note }) {
  $("sTag").textContent = tag; $("sTitle").textContent = title;
  const r = $("sRows"); r.textContent = "";
  rows.forEach(([k, v], i) => r.append(h("div", { class: "row", "data-r": i }, h("span", {}, k), h("span", {}, v ?? "–"))));
  if (note) r.append(h("p", { class: "nws" }, note));
  $("inspBody").hidden = false; $("inspEmpty").hidden = true;
  dock?.open("inspector");
}
$("rClose").onclick = () => { $("inspBody").hidden = true; $("inspEmpty").hidden = false; pin?.remove(); pin = null; };
const interactive = () => ["nws-fill", "quake", "shel-pt", "scen-fill", ...DEFS.filter((d) => d.arc?.kind === "feature").flatMap(layerIds)].filter((i) => map.getLayer(i));
map.on("click", async (e) => {
  if (annotations?.consume(e)) return;
  const lat = e.lngLat.lat, lon = e.lngLat.lng;
  pin?.remove(); pin = new maplibregl.Marker({ element: h("div", { class: "pin" }), anchor: "center" }).setLngLat(e.lngLat).addTo(map);
  const hit = map.queryRenderedFeatures(e.point, { layers: interactive() })[0];
  const p = hit?.properties || {};
  let tag = "Point inspector", title = "Selected location", note = "";
  if (hit?.layer.id === "nws-fill") { tag = "NWS alert"; title = p.event; note = p.headline; }
  else if (hit?.layer.id === "quake") { tag = "USGS earthquake"; title = "M " + (+p.mag).toFixed(1); note = p.place + " · " + new Date(+p.time).toLocaleString("en-US", { timeZone: "Pacific/Honolulu" }) + " HST"; }
  else if (hit?.layer.id === "shel-pt") { tag = p.countyName || "County shelter"; title = p.name || "Shelter"; note = [p.address, p.city].filter(Boolean).join(", "); }
  else if (hit?.layer.id === "scen-fill") { tag = "Scenario (illustrative)"; title = p.label; }
  const arcHit = hit && DEFS.find((d) => d.arc && layerIds(d).includes(hit.layer.id));
  if (arcHit) { tag = "ArcGIS · " + arcHit.n; title = String(p[arcHit.arc.display] || arcHit.n).slice(0, 80); note = "Source: " + (arcHit.arc.attribution || hostOf(arcHit.arc.url)); }
  const rows = [["Latitude", lat.toFixed(5)], ["Longitude", lon.toFixed(5)], ["Elevation", "…"]];
  if (arcHit) rows.push(...Arc.attrRows(p, arcHit.arc.fields, 8));
  // A shelter shows what its county published AND what it never published — the blanks
  // are the point, so they read "not published" rather than quietly disappearing.
  if (hit?.layer.id === "shel-pt") {
    const tri = (v) => (v === true || v === "true" ? "Yes" : v === false || v === "false" ? "No" : "not published");
    rows.push(["County term", p.countyTerm || "–"], ["Role", (p.role || "unknown") === "unknown" ? "not stated" : p.role],
      ["Status", p.status === "unknown" ? "not published" : p.status], ["Capacity", p.capacity == null || p.capacity === "" ? "not published" : (+p.capacity).toLocaleString("en-US")],
      ["ADA accessible", tri(p.ada)], ["Accepts animals", tri(p.pets)], ["Backup power", tri(p.power)], ["Wind-hardened", tri(p.hardened)]);
    if (p.designation) rows.push(["Hurricane designation", p.designation]);
    if (p.phone) rows.push(["Phone", p.phone]);
  }
  const live = activeData().filter((d) => d.w);
  live.forEach((d) => {
    const inH = lat > RECT.s && lat < RECT.n && lon > RECT.w && lon < RECT.e;
    if (inH) rows.push([d.n, (samp("h", d.w, lat, lon) ?? 0).toFixed(1) + " " + R[d.ramp].u]);
  });
  const ah = S.on.afn && map.getLayer("afn") ? map.queryRenderedFeatures(e.point, { layers: ["afn"] })[0] : null;
  if (ah) { const a = ah.properties, f = (n) => (+n).toLocaleString("en-US"); if (!hit) { tag = "Census tract · SVI 2022"; title = (a.loc || "").split(";")[0]; note = "CDC/ATSDR SVI 2022 (ACS 2018-2022). Estimates carry margins of error; tract ranks are relative to Hawaiʻi."; }
    rows.push(["AFN index (rank 0-100)", Math.round(a.idx)], ["Population", f(a.pop)], ["With a disability", f(a.dis) + " (" + a.pdis + "%)"], ["Limited English", f(a.lep) + " (" + a.plep + "%)"], ["No vehicle (households)", f(a.nov) + " (" + a.pnov + "%)"], ["Age 65+", f(a.a65) + " (" + a.p65 + "%)"]); }
  rows.push(["NWS forecast", "…"]); const fi = rows.length - 1;
  nwsForecast(lat, lon, fi);
  showInspector({ tag, title, rows, note });
  const el = map.queryTerrainElevation(e.lngLat);
  if (el != null) { setRow(2, Math.round(el / (S.on.terrain ? S.exag : 1)) + " m"); return; }
  try { const j = await (await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`)).json(); setRow(2, Math.round(j.elevation[0]) + " m"); } catch { setRow(2, "unavailable"); }
});
const setRow = (i, v) => { const r = document.querySelector(`#sRows [data-r="${i}"] span:last-child`); if (r) r.textContent = v; };
async function nwsForecast(lat, lon, i) {
  try {
    const H = { headers: { Accept: "application/geo+json" } };
    const pt = await (await fetch(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`, H)).json();
    const fc = await (await fetch(pt.properties.forecast, H)).json(), p = fc.properties.periods[0];
    setRow(i, `${p.name}: ${p.shortForecast}, ${p.temperature}°${p.temperatureUnit}`);
  } catch { setRow(i, "unavailable"); }
}
map.on("mousemove", (e) => { const l = interactive(); map.getCanvas().style.cursor = l.length && map.queryRenderedFeatures(e.point, { layers: l }).length ? "pointer" : ""; });

// ---------- view controls ----------
let globeOn = false;
const dur = (d) => (REDUCED ? 0 : d);
function fly(v) { map.flyTo({ center: [v[1], v[2]], zoom: v[3], pitch: S.on.terrain ? 45 : 0, bearing: 0, duration: dur(2200), essential: false }); }
function flyHi() { map.flyTo({ center: HI.c, zoom: HI.z, pitch: 0, bearing: 0, duration: dur(1800) }); }
$("vHi").onclick = flyHi;
$("isl").innerHTML = ""; const optI = () => { const s = $("isl"); s.textContent = ""; s.append(h("option", { value: "" }, t("island")), ...Object.entries(ISL).map(([k, v]) => h("option", { value: k }, v[0]))); }; optI();
$("isl").onchange = (e) => { if (e.target.value) fly(ISL[e.target.value]); e.target.value = ""; };
$("vTilt").onclick = () => map.easeTo({ pitch: map.getPitch() > 10 ? 0 : 55, duration: dur(700) });
map.on("pitchend", () => $("vTilt").setAttribute("aria-pressed", map.getPitch() > 10));
$("vGlobe").onclick = () => { globeOn = !globeOn; $("vGlobe").setAttribute("aria-pressed", globeOn); try { map.setProjection({ type: globeOn ? "globe" : "mercator" }); } catch {} if (globeOn) map.easeTo({ zoom: Math.min(map.getZoom(), 3), duration: dur(1200) }); };
$("lpToggle").onclick = () => $("lpToggle").setAttribute("aria-pressed", dock.toggleZone("left"));
new ResizeObserver(() => map.resize()).observe($("map")); // the map follows every dock and splitter change

document.querySelectorAll("[data-ip]").forEach((n) => (n.placeholder = t(n.dataset.ip)));
applyI18n();

// ---------- public-data loaders: CDC/ATSDR SVI tracts, Hawaiʻi Statewide GIS tsunami zones ----------
const AFNM = [["idx", "Composite AFN index"], ["dis", "Disability"], ["lep", "Limited English"], ["nov", "No vehicle"], ["a65", "Age 65+"]];
const AFN_URL = "https://onemap.cdc.gov/onemapservices/rest/services/SVI/CDC_ATSDR_Social_Vulnerability_Index_2022_USA/FeatureServer/";
const TSU_URL = "https://geodata.hawaii.gov/arcgis/rest/services/Hazards/MapServer/11/query";
let afnState = null, afnRaw = null, tsuState = null;
async function loadAfn() {
  if (afnRaw || afnState === "loading") return; afnState = "loading"; renderGroups();
  const base = "FIPS,LOCATION,E_TOTPOP,E_DISABL,E_LIMENG,E_NOVEH,E_AGE65,EP_DISABL,EP_LIMENG,EP_NOVEH,EP_AGE65";
  const q = (f) => "where=" + encodeURIComponent("ST_ABBR='HI'") + "&outFields=" + f + "&outSR=4326&f=geojson&maxAllowableOffset=0.0004&geometryPrecision=5&resultRecordCount=2000";
  try {
    outer: for (const id of [2, 0, 3]) for (const f of [base + ",E_AGE17,E_SNGPNT,E_HH", base]) { const r = await fetch(AFN_URL + id + "/query?" + q(f)); if (!r.ok) continue; const j = await r.json(); if ((j.features || []).length > 50) { afnRaw = j; break outer; } }
    if (!afnRaw) throw new Error("no tract layer");
    afnState = null; READ.svi = Date.now(); applyAfn();
  } catch { afnState = "error"; }
  renderGroups(); renderLegend(); refreshPanels();
}
function applyAfn() {
  if (!afnRaw) return;
  const F = afnRaw.features.filter((f) => f.geometry && f.properties.E_TOTPOP > 0), K = { dis: "EP_DISABL", lep: "EP_LIMENG", nov: "EP_NOVEH", a65: "EP_AGE65" }, sorted = {};
  for (const [k, f] of Object.entries(K)) sorted[k] = F.map((x) => x.properties[f]).filter((n) => n >= 0).sort((a, b) => a - b);
  const rank = (arr, x) => { if (x < 0) return 0; let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; arr[m] < x ? (lo = m + 1) : (hi = m); } return (lo / arr.length) * 100; };
  DATA.afn = { type: "FeatureCollection", features: F.map((f) => {
    const p = f.properties, r = {}; for (const k in K) r[k] = rank(sorted[k], p[K[k]]);
    const idx = (r.dis + r.lep + r.nov + r.a65) / 4, r1 = (n) => (n >= 0 ? Math.round(n * 10) / 10 : "n/a");
    return { type: "Feature", geometry: f.geometry, properties: { fips: String(p.FIPS || ""), a17: p.E_AGE17 ?? -1, sng: p.E_SNGPNT ?? -1, hh: p.E_HH ?? -1, loc: p.LOCATION, pop: p.E_TOTPOP, dis: p.E_DISABL, lep: p.E_LIMENG, nov: p.E_NOVEH, a65: p.E_AGE65, pdis: r1(p.EP_DISABL), plep: r1(p.EP_LIMENG), pnov: r1(p.EP_NOVEH), p65: r1(p.EP_AGE65), idx, v: S.afnMode === "idx" ? idx : r[S.afnMode] } };
  }) };
  map.getSource("afn")?.setData(DATA.afn); renderGroups(); refreshPanels();
}
async function loadTsu() {
  if (DATA.tsu.features.length || tsuState === "loading") return; tsuState = "loading"; renderGroups();
  try {
    const out = [];
    for (let off = 0; off < 6000; off += 1000) { const r = await fetch(TSU_URL + `?where=1%3D1&outFields=*&outSR=4326&f=geojson&maxAllowableOffset=0.0003&geometryPrecision=5&resultOffset=${off}&resultRecordCount=1000`); if (!r.ok) throw new Error(r.status); const j = await r.json(); out.push(...(j.features || [])); if ((j.features || []).length < 1000) break; }
    DATA.tsu = { type: "FeatureCollection", features: out }; tsuState = null; map.getSource("tsu")?.setData(DATA.tsu);
  } catch { tsuState = "error"; }
  renderGroups(); renderLegend();
}

// ---------- timeline panel: live, or any moment in the past year ----------
function onTime(e) {
  const dayChanged = e.day !== TIME.day, wasLive = TIME.live;
  Object.assign(TIME, { live: e.live, t: e.t, from: e.from, to: e.to, day: e.day });
  if (map.getLayer("quake")) map.setFilter("quake", quakeFilter());
  if (dayChanged) { clearTimeout(TIME.tm); TIME.tm = setTimeout(refreshTime, 350); }
  // Alerts and weather now follow the playhead too. Debounced: scrubbing fires this on
  // every pixel, and each step may need zone polygons or an hourly grid.
  clearTimeout(TIME.tm2); TIME.tm2 = setTimeout(() => syncHistory(wasLive !== e.live), e.live ? 0 : 220);
  annotations?.setTime(e.live ? null : e.t);
  const chip = $("replay");
  chip.hidden = e.live;
  if (!e.live) chip.innerHTML = `<b>Replay</b> ${new Date(e.t).toLocaleString("en-US", { timeZone: "Pacific/Honolulu", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })} HST`;
}

/* Replay state for alerts and weather. `seq` guards against a slow fetch for an old
   playhead position landing after a newer one and painting stale data. */
let histSeq = 0, histAlerts = [], zonesWarm = false;
async function syncHistory(modeChanged) {
  const seq = ++histSeq;
  if (TIME.live) {
    histAlerts = [];
    map.getSource("nws")?.setData(DATA.nws);
    if (modeChanged) { for (const d of DEFS.filter((x) => x.w && S.on[x.id])) restoreWx(d); renderAlerts(); }
    return;
  }
  await loadAlertHistory().catch(() => {});
  if (seq !== histSeq) return;
  if (!zonesWarm) { zonesWarm = true; warmZones().then(() => { if (!TIME.live) syncHistory(false); }).catch(() => { zonesWarm = false; }); }
  histAlerts = alertsAt(TIME.t);
  renderAlerts();
  const gj = await alertsGeoJSON(TIME.t).catch(() => null);
  if (seq !== histSeq || TIME.live) return;
  if (gj) map.getSource("nws")?.setData(gj);
  for (const d of DEFS.filter((x) => x.w && S.on[x.id])) replayWx(d, seq);
}
async function replayWx(d, seq) {
  try {
    const pts = []; GRID.h.la.forEach((a) => GRID.h.lo.forEach((o) => pts.push([a, o])));
    const day = new Date(TIME.t).toISOString().slice(0, 10), hr = new Date(TIME.t).getUTCHours();
    const rows = await weatherDay(pts, WV, day);
    if (seq !== histSeq || TIME.live) return;
    grid.r = { g: GRID.h, d: rows.map((h) => Object.fromEntries(WV.map((v) => [v, h?.[v]?.[hr] ?? 0]))) };
    const url = paint(d.ramp, 900, 540, RECT, (a, o) => samp("r", d.w, a, o), 30, 14);
    const b = [[RECT.w, RECT.n], [RECT.e, RECT.n], [RECT.e, RECT.s], [RECT.w, RECT.s]];
    map.getSource(d.id + "-h")?.updateImage({ url, coordinates: b });
  } catch (e) { console.warn("weather replay:", e); }
}
function restoreWx(d) {
  const im = WXIMG[d.id]; if (!im) return;
  const b = [[RECT.w, RECT.n], [RECT.e, RECT.n], [RECT.e, RECT.s], [RECT.w, RECT.s]];
  map.getSource(d.id + "-h")?.updateImage({ url: im.h, coordinates: b });
  setVis(d);
}
function refreshTime() { for (const id of ["fires", "viirs"]) { const d = BYID[id]; if (!map.getLayer(id)) continue; map.removeLayer(id); map.removeSource(id); addDef(d); setVis(d); setOp(d); } }
let HIST = [];
loadAlertHistory().then((ev) => { HIST = ev; renderMarks(); }).catch(() => {});
const SEVC = { Extreme: "#ff4d4d", Severe: "#ff8a1f", Moderate: "#f2c14e", Minor: "#5aa9e6" };
function renderMarks() { // feeds the timeline lanes
  if (!timeline) return;
  const qf = DATA.quake.features || [];
  const mk = annotations?.spans() || [];
  timeline.setLanes([
    ...(mk.length ? [{ id: "markup", label: "Your markup", note: mk.length + " timed", color: "#ffffff", spans: mk }] : []),
    { id: "quake", label: "Earthquakes M2.5+", note: qf.length ? qf.length.toLocaleString() + " in the past year · dots M4+" : "loading", color: "#e4572e", markMin: 4,
      events: qf.map((f) => ({ t: f.properties.time, v: f.properties.mag, label: "M" + (+f.properties.mag).toFixed(1) + " " + (f.properties.place || "") })) },
    { id: "nws", label: "NWS alerts", note: HIST.length ? HIST.length.toLocaleString() + " issued in the past year · " + alerts.length + " active now" : alerts.length ? alerts.length + " active" : "loading history", color: "#f2c14e",
      spans: [
        ...HIST.map((e) => ({ t0: e.t0, t1: e.t1, label: e.event + " · " + e.zones.slice(0, 3).join(", "), color: SEVC[e.severity] })),
        ...alerts.map((a) => ({ t0: Date.parse(a.p.onset || a.p.effective || a.p.sent), t1: Date.parse(a.p.ends || a.p.expires) || Date.now(), label: a.p.event + " (NWS)", color: SEVC[a.p.severity] })).filter((s) => s.t0),
      ] },
  ]);
}

// ---------- Needs panel: CMIST totals from the SVI tract data (public, de-identified, tract level) ----------
const COUNTY = { "15001": "Hawaiʻi County", "15003": "City and County of Honolulu", "15005": "Kalawao County", "15007": "Kauaʻi County", "15009": "Maui County" };
const SCOPES = [["state", "All of Hawaiʻi"], ...Object.entries(COUNTY), ["view", "What the map shows"]];
$("needScope").append(...SCOPES.map(([k, n]) => h("option", { value: k }, n)));
$("needScope").value = SCOPES.some(([k]) => k === S.scope) ? S.scope : "state";
$("needScope").onchange = (e) => { S.scope = e.target.value; save(); refreshPanels(); };
const fmtN = (n) => (n >= 0 ? Math.round(n).toLocaleString("en-US") : "–");
function tractBox(g) { return bbox(g); }
function inScope(f) {
  if (S.scope === "state") return true;
  if (S.scope === "view") { const b = map.getBounds(), [[w, s], [e, n]] = f._bb || (f._bb = tractBox(f.geometry)); return e >= b.getWest() && w <= b.getEast() && n >= b.getSouth() && s <= b.getNorth(); }
  return f.properties.fips.startsWith(S.scope);
}
/**
 * One summary of the selected area, shared by the Needs panel, the resource model and the
 * metrics panel so all three can never disagree about who is in scope.
 * `countyFrac` is what lets county-level emPOWER counts be scaled down to a sub-county area.
 */
function areaSummary(filter = null) {
  const F = DATA.afn.features.filter(filter || inScope);
  const add = (o, p) => {
    o.pop += Math.max(0, p.pop || 0); o.dis += Math.max(0, p.dis || 0); o.lep += Math.max(0, p.lep || 0);
    o.nov += Math.max(0, p.nov || 0); o.a65 += Math.max(0, p.a65 || 0);
    o.a17 += Math.max(0, p.a17 || 0); o.hh += Math.max(0, p.hh || 0);
    return o;
  };
  const zero = () => ({ pop: 0, dis: 0, lep: 0, nov: 0, a65: 0, a17: 0, hh: 0 });
  const area = F.reduce((o, f) => add(o, f.properties), zero());
  area.tracts = F.length;

  // County population inside the area vs. that county's full population, for emPOWER scaling.
  const inside = {}, whole = {};
  for (const f of DATA.afn.features) {
    const fips = (f.properties.fips || "").slice(0, 5);
    whole[fips] = (whole[fips] || 0) + Math.max(0, f.properties.pop || 0);
  }
  for (const f of F) {
    const fips = (f.properties.fips || "").slice(0, 5);
    inside[fips] = (inside[fips] || 0) + Math.max(0, f.properties.pop || 0);
  }
  area.fips = Object.keys(inside);
  area.countyFrac = {};
  for (const k of area.fips) area.countyFrac[k] = whole[k] ? Math.min(1, inside[k] / whole[k]) : 0;
  area.features = F;
  return area;
}

/** emPOWER counts scaled to the current area. Returns null until the feed has loaded. */
function empInArea(area) {
  if (!EMP) return null;
  const o = {};
  for (const l of LINES) o[l.k] = 0;
  for (const fips of area.fips) {
    const c = EMP.byFips[fips];
    if (!c) continue;
    const fr = area.countyFrac[fips] ?? 1;
    for (const l of LINES) o[l.k] += (c[l.k] || 0) * fr;
  }
  return o;
}

function renderNeeds() {
  const body = $("needsBody"); if (!body || !dock?.isOpen("needs")) return;
  body.textContent = "";
  if (!afnRaw) { body.append(h("p", { class: "empty" }, afnState === "error" ? "Census tract data (CDC/ATSDR SVI) is unavailable right now. Check the connection and reopen this panel." : "Loading census tracts from CDC/ATSDR SVI…")); return; }
  const F = DATA.afn.features.filter(inScope);
  const sum = (k) => F.reduce((a, f) => a + (f.properties[k] > 0 ? f.properties[k] : 0), 0), has = (k) => F.some((f) => f.properties[k] >= 0);
  const pop = sum("pop"), pct = (n) => (pop ? " · " + ((n / pop) * 100).toFixed(1) + "%" : "");
  const scopeName = SCOPES.find(([k]) => k === S.scope)[1];
  body.append(h("p", { class: "src" }, `Read from CDC/ATSDR at ${stamp(READ.svi)} · emPOWER at ${stamp(READ.emp)} · re-read automatically every 30 min`));
  body.append(h("p", { class: "needs-sum" }, h("b", {}, fmtN(pop)), ` residents in ${F.length} census tracts · ${scopeName}`));
  const row = (letter, name, val, what, extra) => h("div", { class: "cm" }, h("i", { class: "cml", "aria-hidden": "true" }, letter), h("b", {}, name), h("span", {}, val), h("p", {}, what), extra || null);

  // CMIST "M" now comes from HHS emPOWER rather than a placeholder.
  const e = empInArea(areaSummary());
  const mVal = e ? fmtN(e.dme) : empState === "loading" ? "loading…" : empState === "error" ? "feed unavailable" : "–";
  const mWhat = e
    ? `Medicare beneficiaries using electricity-dependent medical equipment · ${fmtN(e.dialysis)} dialysis · ${fmtN(e.oxygen)} oxygen · ${fmtN(e.homeHealth)} home health · ${fmtN(e.hospice)} at-home hospice`
    : "Electricity-dependent residents, from HHS emPOWER (de-identified county and ZIP counts).";

  body.append(
    row("C", "Communication", fmtN(sum("lep")) + pct(sum("lep")), "Speak English less than well (age 5+)"),
    row("M", "Medical", mVal, mWhat, e ? h("p", { class: "src" }, "Medicare only, so this is a floor: residents on Medicaid, private cover or none are not counted.") : h("a", { href: "https://empowermap.hhs.gov/", target: "_blank", rel: "noopener noreferrer" }, "Open emPOWER ↗")),
    row("I", "Independence", fmtN(sum("dis")) + pct(sum("dis")), "Living with a disability (civilian, non-institutional)"),
    row("S", "Safety and support", has("a17") ? fmtN(sum("a17")) + pct(sum("a17")) : "–", "Children under 18" + (has("sng") ? " · " + fmtN(sum("sng")) + " single-parent households" : "")),
    row("T", "Transportation", fmtN(sum("nov")), "Households with no vehicle"),
    row("+", "Age 65 and older", fmtN(sum("a65")) + pct(sum("a65")), "Cuts across all five areas"));
  const top = [...F].sort((a, b) => b.properties.idx - a.properties.idx).slice(0, 8);
  if (top.length) {
    body.append(h("h4", {}, "Highest AFN index here"));
    const ol = h("ol", { class: "toptr" });
    top.forEach((f) => ol.append(h("li", {}, h("button", { type: "button", "data-tract": f.properties.fips }, h("span", {}, (f.properties.loc || "Census tract").split(";").slice(0, 2).map((x) => x.trim()).join(" · ")), h("em", {}, Math.round(f.properties.idx) + " · " + fmtN(f.properties.pop) + " people")))));
    body.append(ol);
  }
  body.append(h("p", { class: "src" }, "Sources: CDC/ATSDR Social Vulnerability Index 2022 (ACS 2018–2022 five-year estimates) for C, I, S and T; HHS emPOWER for M. Sums of tract estimates; margins of error are not combined. One person can count in several rows, so rows do not add up. AFN index = average Hawaiʻi rank of disability, limited English, no vehicle and age 65+."));
}
$("needsBody").addEventListener("click", (e) => {
  const b = e.target.closest("[data-tract]"); if (!b) return;
  const f = DATA.afn.features.find((x) => x.properties.fips === b.dataset.tract); if (!f) return;
  if (!S.on.afn) toggle("afn", true);
  map.fitBounds(tractBox(f.geometry), { padding: 60, duration: REDUCED ? 0 : 1200, maxZoom: 13 });
});
let needsTm; map.on("moveend", () => { if (S.scope === "view") { clearTimeout(needsTm); needsTm = setTimeout(refreshPanels, 250); } });

// ---------- ArcGIS layers: presets and paste-a-URL ----------
const hash = (s) => { let x = 5381; for (const c of s) x = ((x << 5) + x + c.charCodeAt(0)) | 0; return (x >>> 0).toString(36); };
const arcMsg = (m) => ($("arcMsg").textContent = m);
{ const sel = $("arcPreset"), byG = {}; Arc.PRESETS.forEach((p) => (byG[p.g] ||= []).push(p));
  for (const [g, ps] of Object.entries(byG)) sel.append(h("optgroup", { label: g }, ...ps.map((p) => h("option", { value: p.u }, p.n)))); }
$("arcPreset").onchange = (e) => { const u = e.target.value; e.target.value = ""; if (u) addArc(u); };
$("arcForm").onsubmit = (e) => { e.preventDefault(); const u = $("arcUrl").value.trim(); if (u) addArc(u); };
async function addArc(raw) {
  arcMsg("Checking the service…");
  let info; try { info = await Arc.describe(raw); } catch (e) { arcMsg(e.message || "Could not read that service."); return; }
  const ex = DEFS.find((d) => d.arc && d.arc.url === info.url && (d.arc.sub ?? null) === (info.sub ?? null));
  if (ex) { if (!S.on[ex.id]) toggle(ex.id, true); arcMsg("That layer is already in the list. It is on now."); return; }
  if (info.pii?.length && !confirm(`This layer has fields that may describe people: ${info.pii.join(", ")}.\n\nAllReady is for public, de-identified and facility data only, and it will hide those fields in the inspector.\n\nAdd the layer anyway?`)) { arcMsg("Not added."); return; }
  const id = "arc-" + hash(info.url + "|" + (info.sub ?? ""));
  const a = { id, color: ARC_COL[(S.arc || []).length % ARC_COL.length], url: info.url, service: info.service, type: info.type, layer: info.layer, kind: info.kind, sub: info.sub ?? null, name: info.name, geom: info.geom, fields: (info.fields || []).slice(0, 80), display: info.display, maxRecords: info.maxRecords, geojson: info.geojson, paging: info.paging, attribution: info.attribution, maxLod: info.maxLod };
  S.arc = [...(S.arc || []), a]; const d = arcDef(a); DEFS.push(d); BYID[id] = d; S.open.arc = 1;
  toggle(id, true); arcMsg(`Added “${info.name}”. It is in the ArcGIS layers group above.`); $("arcUrl").value = "";
}
async function loadArc(d) {
  if (arcState[d.id] === "loading") return; arcState[d.id] = "loading"; renderGroups();
  try { DATA[d.id] = await Arc.queryAll(d.arc); map.getSource(d.id)?.setData(DATA[d.id]); delete arcState[d.id]; }
  catch (e) { arcState[d.id] = "error"; console.warn("arcgis:", e); }
  renderGroups(); renderLegend();
}
function removeArc(id) {
  const d = BYID[id]; if (!d) return;
  for (const l of layerIds(d)) if (map.getLayer(l)) map.removeLayer(l);
  if (map.getSource(id)) map.removeSource(id);
  DEFS.splice(DEFS.indexOf(d), 1); delete BYID[id]; delete DATA[id]; delete S.on[id]; delete S.op[id];
  S.arc = S.arc.filter((a) => a.id !== id); save(); renderGroups(); renderLegend();
}

// ---------- the live plan: scenario + area + supply -> needs, resources, gaps ----------
const timer = createTimer();
// Goal 3 measures forecast → plan, so the clock starts when the planner opens the tool,
// not when the data happens to finish arriving. Fetching the feeds is part of the work.
timer.start();
let clock = null, rail = null, metrics = null, PLAN = null, assistant = null;
// Seeded from the scenario itself rather than left null: the data feeds call refreshPanels()
// as they land, which can beat the clock's first onChange.
const SCN0 = (k) => {
  const sc = SCENARIOS[k], ph = sc.phases.find((p) => p.roles.length) || sc.phases[0];
  return { hazard: k, phase: ph, ramp: ph.ramp, roles: ph.roles.length ? ph.roles : null, scenario: sc };
};
let SCN = SCN0({ tsunami: "tsunami", wildfire: "wildfire", flood: "flood", hurricane: "hurricane" }[hz] || "hurricane");

/** Recompute the whole plan. Cheap enough to run on every clock tick. */
let LIVE = null; // the real event in force, or null
function recompute() {
  LIVE = null;
  if (!afnRaw || !DATA.afn.features.length) { PLAN = null; return; }
  let area, fips = S.scope !== "state" && S.scope !== "view" ? [S.scope] : null;
  if (S.mode === "live") {
    // Nothing hypothetical: the event is whatever NWS has in force, and the people at risk
    // are the tracts inside that alert's own polygons. No relevant alert → no demand.
    LIVE = liveEvent(alerts);
    if (!LIVE) { PLAN = null; return; }
    SCN = { hazard: LIVE.hazard, phase: LIVE.phase, ramp: LIVE.ramp, roles: LIVE.roles, scenario: LIVE.scenario };
    const { hasGeometry, test } = insideEvent(LIVE);
    area = areaSummary(hasGeometry ? (f) => test(centroidOf(f)) : null);
    area.basis = hasGeometry ? "census tracts inside the alert's polygons" : "the alert carries no polygon, so the selected area is used";
    fips = area.fips.length ? area.fips : fips;
  } else area = areaSummary();
  if (!area.pop) { PLAN = null; return; }
  timer.start();
  PLAN = buildPlan({ hazard: SCN.hazard, area, emp: EMP, shelters: SHEL.list, ramp: SCN.ramp, roles: SCN.roles, fipsFilter: fips, manual: manualSupply() });
  PLAN.area = area;
  // The clock stops once a complete plan exists: population + needs + supply + gaps.
  if (SHEL.list.length && EMP && area.tracts) timer.planReady();
}

/** The header chip and the event-clock panel say plainly whether this is live or a what-if. */
function renderMode() {
  const chip = $("scn"), live = S.mode === "live";
  chip.hidden = false; chip.dataset.mode = S.mode;
  chip.textContent = live ? (LIVE ? `Live · ${LIVE.label}` : "Live · no active event") : `What-if · ${SCN.scenario.n} · ${SCN.phase?.n || ""}`;
  chip.title = live ? "Driven by National Weather Service alerts in force right now" : "A hypothetical scenario you chose on the event clock — not a real event";
  const rl = $("readLine"); if (rl) rl.textContent = `Data read ${stamp(Math.max(READ.nws, READ.shel, READ.svi, READ.emp))}`;
  const bar = $("scMode"); if (!bar) return;
  bar.textContent = "";
  for (const [k, n] of [["live", "Live"], ["whatif", "What-if scenario"]]) {
    const b = h("button", { type: "button", class: "sc-tab", "aria-pressed": String(S.mode === k) }, n);
    b.onclick = () => { S.mode = k; save(); if (k === "whatif") clock?.redraw(); refreshPanels(); };
    bar.append(b);
  }
  bar.append(h("span", { class: "src" }, live ? `NWS read ${stamp(READ.nws)} · refreshes every 5 min` : "Hypothetical. Figures below are for the scenario you set, not a real event."));
  $("scHost").hidden = live;
  const box = $("scLive"); box.hidden = !live; box.textContent = "";
  if (!live) return;
  if (!LIVE) {
    box.append(h("b", {}, "No active event"),
      h("p", {}, `No hurricane, tropical storm, tsunami, flood or fire-weather alert is in force for Hawaiʻi.${alerts.length ? ` ${alerts.length} other alert${alerts.length === 1 ? " is" : "s are"} in force (${[...new Set(alerts.map((a) => a.p.event))].slice(0, 3).join(", ")}) — see Alerts.` : ""}`),
      h("p", { class: "src" }, "Needs and gaps are only calculated for a real event. To plan ahead, rehearse one:"),
      h("div", { class: "sc-rehearse" }, ...Object.entries(SCENARIOS).map(([k, sc]) => {
        const b = h("button", { type: "button", class: "chipbtn", style: "--hz:" + sc.c }, sc.n);
        b.onclick = () => { S.mode = "whatif"; save(); clock?.setHazard(k); refreshPanels(); };
        return b;
      }), h("a", { class: "chipbtn", href: "scenarios.html" }, "All counties and hazards →")));
    return;
  }
  const until = LIVE.alert.until ? new Date(LIVE.alert.until).toLocaleString("en-US", { timeZone: "Pacific/Honolulu", weekday: "short", hour: "numeric", minute: "2-digit" }) + " HST" : "not stated";
  box.append(h("b", {}, LIVE.label),
    h("p", {}, `${LIVE.alert.area.slice(0, 220)} · until ${until}`),
    h("p", {}, PLAN ? `${PLAN.area.tracts} census tracts and ${PLAN.area.pop.toLocaleString("en-US")} residents fall inside the alert area. Mapped to the ${LIVE.scenario.n.toLowerCase()} phase “${LIVE.phase.n}”.` : "Census tracts are still loading."));
  const ul = h("ul", { class: "sc-points" });
  LIVE.scenario.points.filter((p) => p.t <= LIVE.phase.t).slice(-3).forEach((p) => ul.append(h("li", { class: "sc-pt", style: "--oc:" + OWNERS[p.owner].c }, h("span", { class: "sc-pt-t" }, OWNERS[p.owner].n), h("div", {}, h("p", { class: "sc-act" }, p.action)))));
  box.append(ul);
}

/** Each feed with its public URL and when this session last read it — so anyone can check a number. */
const sourceList = () => SOURCES.map((x) => ({ ...x, read: x.key && READ[x.key] ? stamp(READ[x.key]) : x.key ? "not read yet" : "on demand" }));

/** Every panel that reads derived state, refreshed together so they cannot disagree. */
function refreshPanels() {
  recompute();
  renderMode();
  if (dock?.isOpen("shelters")) renderShelters($("shelBody"), {
    shelters: SHEL.list, score: SHEL.score, actions: SHEL.actions,
    loading: SHEL.state === "loading",
    error: SHEL.state === "error" ? "County shelter services could not be reached. They are public ArcGIS endpoints — check the connection and reopen this panel." : null,
    onZoomCounty: (fips) => {
      const pts = SHEL.list.filter((s) => s.fips === fips);
      if (!pts.length) return;
      if (!S.on.shel) toggle("shel", true);
      const lons = pts.map((p) => p.lon), lats = pts.map((p) => p.lat);
      map.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], { padding: 70, duration: dur(1200) });
    },
  });
  if (dock?.isOpen("resources")) renderResources($("resBody"), {
    plan: PLAN, scenario: SCN.scenario, phase: SCN.phase, area: PLAN?.area,
    mode: S.mode, live: LIVE, shelters: SHEL.list, score: SHEL.score,
    read: `Shelter feeds read ${stamp(READ.shel)} · NWS ${stamp(READ.nws)} · emPOWER ${stamp(READ.emp)}`,
    onManual: (k, v) => { setManualSupply(k, v); refreshPanels(); },
    onWhatIf: () => { S.mode = "whatif"; save(); dock.open("scenario"); clock?.redraw(); refreshPanels(); },
    loading: !PLAN && (afnState === "loading" || SHEL.state === "loading" || empState === "loading" || !afnRaw),
    onExport: exportPlan,
    onFactors: () => { dock.open("factors"); renderFactors($("facBody")); },
  });
  if (dock?.isOpen("needs")) renderNeeds();
  if (dock?.isOpen("sources")) renderSources($("srcBody"), sourceList());
  metrics?.render();
  rail?.badge("alerts", alerts.length || "", alerts.some((a) => a.p.severity === "Extreme" || a.p.severity === "Severe"));
  rail?.badge("shelters", SHEL.list.length ? SHEL.score.filter((c) => !c.published).length || "" : "", true);
  const short = PLAN?.resources.filter((r) => r.state === "short").length || 0;
  rail?.badge("resources", short || "", short > 0);
}

function exportPlan() {
  if (!PLAN) return;
  timer.exported();
  const md = buildBrief({
    scenario: SCN.scenario, phase: SCN.phase, hazard: SCN.hazard, plan: PLAN, area: PLAN.area,
    readinessScore: SHEL.score, actions: SHEL.actions, counties: SHEL.score, owners: OWNERS, fmtOffset,
  });
  downloadBrief(md, `allready-${SCN.hazard}-plan.md`);
  metrics?.render();
}

function metricState() {
  const total = afnRaw ? afnRaw.features.length : 0;
  const withPop = afnRaw ? afnRaw.features.filter((f) => f.properties.E_TOTPOP > 0).length : 0;
  const e = EMP ? "HHS emPOWER (public REST service)" : null;
  const svi = afnRaw ? "CDC/ATSDR SVI 2022 (ACS 2018–2022)" : null;
  return {
    tracts: { total, withPop, scored: DATA.afn.features.length },
    counties: SHEL.score.length ? SHEL.score : COUNTIES.map((c) => ({ ...c, count: 0, attrs: [], pct: 0 })),
    cmist: {
      C: { n: "Communication", source: svi && "Limited English proficiency — " + svi },
      M: { n: "Medical", source: e && "Electricity-dependent equipment, dialysis, oxygen — " + e },
      I: { n: "Independence", source: svi && "Disability — " + svi },
      S: { n: "Safety & support", source: svi && "Children and age 65+ — " + svi },
      T: { n: "Transportation", source: svi && "Households with no vehicle — " + svi },
    },
    hazards: new Set(HAZARDS.map((x) => x.k)),
    shelters: SHEL.list.length, empower: !!EMP, timer,
  };
}


// ---------- what the AI assistant is allowed to read: a snapshot of the map ----------
const KMD = 111.32;
const kmBetween = (a, b) => Math.hypot((a[0] - b[0]) * KMD * Math.cos((a[1] * Math.PI) / 180), (a[1] - b[1]) * KMD);
const centroidOf = (f) => f._c || (f._c = (([[w, s2], [e, n]]) => [(w + e) / 2, (s2 + n) / 2])(f._bb || (f._bb = tractBox(f.geometry))));
function inPoly(p, ring) { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const a = ring[i], b = ring[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
function nearLine(p, line, km) { for (let i = 1; i < line.length; i++) { const a = line[i - 1], b = line[i], dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1e-12, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)); if (kmBetween(p, [a[0] + t * dx, a[1] + t * dy]) <= km) return true; } return false; }

/** Which tracts and shelters a piece of markup covers. Tracts count by centroid. */
function footprint(it, all) {
  const shape = it.kind === "icon" ? all.find((x) => x.id === it.parent) : it;
  let test, basis;
  if (shape?.kind === "circle") { test = (p) => kmBetween(p, shape.center) <= shape.radiusKm; basis = `inside the ${shape.radiusKm} km radius`; }
  else if (shape?.kind === "area") { test = (p) => inPoly(p, shape.coords); basis = "inside the drawn area"; }
  else if (shape?.coords) { test = (p) => nearLine(p, shape.coords, 1.5); basis = "within 1.5 km of the drawn line"; }
  else { test = (p) => kmBetween(p, it.at) <= 2; basis = "within 2 km of the icon"; }
  const T = DATA.afn.features.filter((f) => test(centroidOf(f)));
  const sum = (k) => T.reduce((a, f) => a + Math.max(0, f.properties[k] || 0), 0);
  const sh = SHEL.list.filter((x) => test([x.lon, x.lat]));
  return {
    basis, tracts: T.length, residents: sum("pop"), withDisability: sum("dis"), limitedEnglish: sum("lep"),
    householdsNoVehicle: sum("nov"), age65plus: sum("a65"), under18: sum("a17"),
    highestAfnTracts: [...T].sort((a, b) => b.properties.idx - a.properties.idx).slice(0, 3).map((f) => ({ tract: (f.properties.loc || "").split(";")[0], afnIndex: Math.round(f.properties.idx), residents: f.properties.pop })),
    shelters: sh.length, shelterSpacesOnRecord: sh.reduce((a, x) => a + (x.capacity || 0), 0),
    sheltersWithNoCapacityPublished: sh.filter((x) => x.capacity == null).length,
    sheltersOpenNow: sh.filter((x) => x.status === "open").length,
    shelterNames: sh.slice(0, 8).map((x) => `${x.name} (${x.county}${x.ada === true ? ", ADA" : ""}${x.pets === true ? ", pets" : ""}${x.power === true ? ", backup power" : ""})`),
  };
}

function mapContext() {
  const b = map.getBounds(), c = map.getCenter();
  const inView = SHEL.list.filter((x) => x.lon >= b.getWest() && x.lon <= b.getEast() && x.lat >= b.getSouth() && x.lat <= b.getNorth());
  const marks = annotations?.snapshot() || [];
  const hst = (ms) => new Date(ms).toLocaleString("en-US", { timeZone: "Pacific/Honolulu", dateStyle: "medium", timeStyle: "short" }) + " HST";
  const alertList = TIME.live
    ? alerts.slice(0, 12).map((a) => ({ event: a.p.event, severity: a.p.severity, area: (a.p.areaDesc || "").slice(0, 160), until: a.p.ends || a.p.expires || null }))
    : histAlerts.slice(0, 12).map((a) => ({ event: a.event, severity: a.severity, area: a.zones.join(", ").slice(0, 160), from: hst(a.t0), until: hst(a.t1) }));
  const wk = Date.now() - 7 * DAY, qk = (DATA.quake.features || []).filter((f) => f.properties.time >= wk);
  const snap = {
    app: "AllReady", generatedAt: hst(Date.now()),
    time: TIME.live ? { mode: "live" } : { mode: "history replay", playhead: hst(TIME.t) },
    view: { center: [+c.lng.toFixed(3), +c.lat.toFixed(3)], zoom: +map.getZoom().toFixed(1), basemap: BASES[S.base]?.n, layersOn: activeData().map((d) => d.n) },
    mode: S.mode === "live" ? (LIVE ? `LIVE — real event from NWS alert in force: ${LIVE.label}` : "LIVE — no hurricane, tsunami, flood or fire-weather alert in force, so no needs or gaps are calculated") : "WHAT-IF — a hypothetical scenario chosen by the planner, not a real event",
    feedsRead: { nws: stamp(READ.nws), shelters: stamp(READ.shel), emPOWER: stamp(READ.emp) },
    eventClock: S.mode === "live" && !LIVE ? null : { hazard: SCN.scenario.n, phase: SCN.phase?.n, evacuationProgressPct: Math.round((SCN.ramp || 0) * 100), shelterRolesOpen: SCN.roles || [], affectedAreaBasis: PLAN?.area?.basis },
    area: PLAN?.area ? { scope: SCOPES.find(([k]) => k === S.scope)?.[1], censusTracts: PLAN.area.tracts, residents: PLAN.area.pop, withDisability: PLAN.area.dis, limitedEnglish: PLAN.area.lep, householdsNoVehicle: PLAN.area.nov, age65plus: PLAN.area.a65, under18: PLAN.area.a17 } : null,
    needs: PLAN ? { atRisk: PLAN.demand.atRisk, evacuating: PLAN.demand.evacuating, inPublicShelter: PLAN.demand.shelterPop, inPublicShelterRange: [PLAN.demand.shelterLow, PLAN.demand.shelterHigh], cmist: Object.fromEntries(Object.entries(PLAN.demand.cmist).map(([k, v]) => [k, { name: v.n, people: v.v, meaning: v.what }])) } : null,
    resources: PLAN ? PLAN.resources.map((r) => ({ resource: r.n, needed: r.need, unit: r.unit, confirmedSupply: r.have, gap: r.gap, state: r.state, whyUnknown: r.blocked || undefined })) : [],
    shelterReadinessByCounty: SHEL.score.map((x) => ({ county: x.county, publishesShelterData: x.published, sites: x.count, spacesOnRecord: x.capacity, openNow: x.open, attributeCompletenessPct: x.pct, note: x.gap || undefined })),
    sheltersStatewide: { sitesOnRecord: SHEL.list.length, spacesOnRecord: SHEL.list.reduce((a, x) => a + (x.capacity || 0), 0), openNow: SHEL.list.filter((x) => x.status === "open").length, countiesPublishing: `${SHEL.score.filter((x) => x.published).length} of 4`, note: "On record is not open. Sites are listed by the counties; only openNow sites are open." },
    sheltersInMapView: { sitesOnRecord: inView.length, spacesOnRecord: inView.reduce((a, x) => a + (x.capacity || 0), 0), openNow: inView.filter((x) => x.status === "open").length },
    powerDependentMedicare: EMP ? Object.values(EMP.byFips).filter((x) => x.benes > 0).map((x) => ({ county: x.county, powerDependent: x.dme, dialysis: x.dialysis, oxygen: x.oxygen })) : null,
    alerts: { source: TIME.live ? "NWS live" : "NWS archive at the playhead", count: TIME.live ? alerts.length : histAlerts.length, list: alertList },
    earthquakesPast7Days: { count: qk.length, largest: qk.length ? Math.max(...qk.map((f) => f.properties.mag)) : null },
    markup: marks.filter((m) => m.visible).slice(0, 25).map((m) => ({
      id: m.id, selected: m.id === annotations.selected || undefined,
      type: m.kind === "icon" ? `icon: ${MARK_ICONS[m.icon]?.n || m.icon}` : m.kind === "circle" ? "radius" : m.kind,
      title: m.title || null, notes: (m.notes || "").slice(0, 400) || null,
      location: (m.at || m.center || m.coords?.[0] || []).map((n) => +n.toFixed(4)),
      radiusKm: m.radiusKm, attachedTo: m.parent ? marks.find((x) => x.id === m.parent)?.title || "a shape" : undefined,
      shownFrom: m.from || undefined, shownUntil: m.to || undefined,
      footprint: DATA.afn.features.length ? footprint(m, marks) : "census tracts not loaded yet",
    })),
    markupNote: marks.length ? "Markup is drawn by the planner for planning. It is not a real or live event." : undefined,
    dataNotes: ["All figures are area-level public data (CDC/ATSDR SVI 2022, HHS emPOWER, county shelter feeds, NWS, USGS).", "Maui County publishes no machine-readable shelter layer.", "emPOWER counts Medicare beneficiaries only, so it is a floor."],
  };
  /* Slow-changing facts first, per-question detail last. A local model keeps the part of the
     prompt it has already read, so a follow-up question only pays for what changed. */
  const order = ["app", "dataNotes", "shelterReadinessByCounty", "sheltersStatewide", "powerDependentMedicare", "mode", "eventClock", "area", "needs", "resources", "alerts"];
  return Object.fromEntries([...order.filter((k) => k in snap).map((k) => [k, snap[k]]), ...Object.entries(snap).filter(([k]) => !order.includes(k))]);
}

// ---------- workspace: dockable panels ----------
const src = (id) => document.querySelector(`#panelsrc [data-src="${id}"]`);
const PANELS = [
  { id: "layers", title: "Layers", zone: "left" },
  { id: "shelters", title: "Shelters", zone: "left", onShow: () => { loadShelterFeeds(); refreshPanels(); } },
  { id: "needs", title: "Needs (CMIST)", zone: "left", onShow: () => { loadAfn(); loadEmp(); renderNeeds(); } },
  { id: "resources", title: "Resources & gaps", zone: "right", onShow: () => { loadAfn(); loadEmp(); loadShelterFeeds(); refreshPanels(); } },
  { id: "metrics", title: "Goals & metrics", zone: "right", onShow: () => metrics?.render() },
  { id: "assistant", title: "Assistant", zone: "right", onShow: () => assistant?.refreshStatus() },
  { id: "markup", title: "Markup", zone: "left", onShow: () => annotations?.render() },
  { id: "alerts", title: "Alerts", zone: "left" },
  { id: "inspector", title: "Inspector", zone: "right" },
  { id: "legend", title: "Legend", zone: "right" },
  { id: "scenario", title: "Event clock", zone: "bottom", onShow: () => clock?.redraw() },
  { id: "timeline", title: "History", zone: "bottom", onShow: () => timeline?.redraw() },
  { id: "sources", title: "Data sources", zone: "right", onShow: () => renderSources($("srcBody"), sourceList()) },
  { id: "factors", title: "Planning factors", zone: "right", float: { w: 420, h: 520 }, onShow: () => renderFactors($("facBody")) },
].map((p) => ({ ...p, mount: (n) => { const s = src(p.id); n.append(...s.childNodes); } }));

const PRESETS = {
  // Deliberately lighter than it used to be: the reading — readiness detail, assumptions,
  // decision tables, ad-hoc queries — lives on the Insights page now. This view is the map,
  // the clock and the gap that matters. Everything else is one click away on the rail.
  default: { title: "Planning", hint: "Layers, alerts and markup; history and the event clock; the assistant", left: [["layers", "alerts", "markup"]], right: [{ tabs: ["assistant"], size: 1.9 }, ["inspector", "legend"]], bottom: [["timeline", "scenario"]], sizes: { left: 330, right: 355, bottom: 250 } },
  gaps: { title: "Gaps & readiness", hint: "Where the plan and the data fall short", left: [["shelters", "layers"]], right: [{ tabs: ["resources"], size: 1.8 }, ["metrics"]], bottom: [["scenario"]], sizes: { left: 360, right: 400, bottom: 280 } },
  ops: { title: "Live operations", hint: "Alerts, assistant and history up front", left: [["alerts", "layers"]], right: [{ tabs: ["assistant"], size: 1.3 }, ["inspector", "legend"]], bottom: [["timeline"]], sizes: { left: 320, right: 440, bottom: 200 } },
  brief: { title: "Briefing", hint: "Large map, goals and needs only", right: [{ tabs: ["metrics"], size: 1.4 }, ["needs"]], bottom: [["scenario"]], sizes: { right: 360, bottom: 270 } },
};

$("center").append(h("div", { id: "replay", class: "replay", hidden: true, role: "status" }));
/* In overlay mode the map fills the workspace and the panels float on top, so anything
   floating over the MAP (the view toolbar, MapLibre's own controls) has to be told how much
   of the map is actually visible. The dock publishes its zone sizes as CSS variables on
   every layout pass and the chrome positions itself inside that band. */
function publishInsets() {
  const px = (sel, prop) => {
    const n = $("ws")?.querySelector(sel);
    return n && !n.hidden ? Math.round(n.getBoundingClientRect()[prop]) : 0;
  };
  const r = document.documentElement.style;
  r.setProperty("--dkL", px(".dk-left", "width") + "px");
  r.setProperty("--dkR", px(".dk-right", "width") + "px");
  r.setProperty("--dkB", px(".dk-bottom", "height") + "px");
}
dock = createDock({
  root: $("ws"), center: $("center"), panels: PANELS, presets: PRESETS,
  initial: "default", storeKey: "allready.ws.v8", overlay: true,
  onLayout: publishInsets,
});
dock.mountMenu($("wsMenu"));
timeline = createTimeline($("tlHost"), { historyDays: 365, span: 14 * DAY, trail: 7 * DAY, onChange: onTime });
metrics = createMetrics($("mxHost"), metricState);

// The scenario clock drives the model, the shelter filter and the map chip.
clock = createScenarioClock($("scHost"), {
  hazard: { tsunami: "tsunami", wildfire: "wildfire", flood: "flood", hurricane: "hurricane" }[hz] || "hurricane",
  onChange: (e) => {
    if (S.mode !== "whatif") return; // live mode is driven by NWS alerts, never by this clock
    SCN = { hazard: e.hazard, phase: e.phase, ramp: e.ramp, roles: e.roles, scenario: e.scenario };
    refreshPanels();
  },
});

// Left icon rail: one strip, one active pane, instead of accordions stacking down the edge.
rail = createRail($("rail"), {
  dock,
  items: [
    { id: "layers", title: "Layers", icon: "layers" },
    { id: "scenario", title: "Event clock", icon: "clock" },
    { id: "needs", title: "Needs (CMIST)", icon: "people" },
    { id: "resources", title: "Resources & gaps", icon: "box" },
    { id: "shelters", title: "Shelters & readiness", icon: "shelter" },
    { id: "markup", title: "Markup: shapes and icons", icon: "pen" },
    { id: "alerts", title: "Alerts", icon: "alert" },
    { id: "metrics", title: "Goals & metrics", icon: "target" },
    { id: "assistant", title: "AI assistant", icon: "spark" },
    null,
    { id: "inspector", title: "Inspector", icon: "pin" },
    { id: "legend", title: "Legend", icon: "list" },
    { id: "timeline", title: "History", icon: "clock" },
    { id: "sources", title: "Data sources: verify every feed", icon: "link" },
  ],
});

// Created up front, not on style load: the tools and the saved list should be there even if
// the basemap is slow or blocked. Its map layers attach whenever a style is ready.
annotations = createAnnotations({ map, host: $("mkBody"), font: labelFont, onChange: () => { renderMarks(); rail?.badge("markup", annotations?.count || ""); } });
assistant = createAssistant($("aiBody"), {
  getContext: mapContext,
  intro: "Ask about anything on the map. Each question is sent with a live snapshot of the event clock, the area, alerts, shelters, gaps and your markup.",
  prompts: [
    { label: "Summarise the map", q: "Give me a short situation overview of what is on the map right now: the event and phase, who is affected, the biggest shelter and resource gaps, and what to look at first." },
    { label: "Brief my markup", q: "Brief me on the markup I placed on the map. For each item say what it marks, who and what falls inside its footprint (residents, AFN indicators, shelters), and what a planner should check. If one is selected, start with it." },
    { label: "Biggest gaps", q: "What are the three most serious gaps right now, which are real shortages versus missing county data, and who would act on each?" },
    { label: "Alerts", q: "What alerts are in force and which parts of the selected area do they touch?" },
  ],
});
dock.render(); // let panels created after the dock receive their first onShow

// ---------- start ----------
// A link from the home page (?island=…) only moves the camera. It no longer draws an
// invented "scenario zone" circle or switches hazard layers on.
if (isl) map.once("load", () => setTimeout(() => fly(isl), 500));
// Arriving from the Scenarios page: show the event clock for that scenario.
if (S.mode === "whatif" && qs.get("whatif") === "1") setTimeout(() => { try { dock.activate("scenario"); } catch {} }, 300);
renderGroups(); renderLegend();

// The planning feeds do NOT wait for the map. A blocked tile host or a slow basemap used to
// leave the whole tool empty, because every loader hung off map "load" — but none of this
// data needs a map to exist. Sources are filled on arrival if they exist and seeded from
// DATA when the style builds them, so either order works.
loadAfn(); loadEmp(); loadShelterFeeds(); loadAlerts();

map.once("load", () => {
  loadQuakes();
  if (S.on.tsu) loadTsu();
  DEFS.filter((d) => d.arc?.kind === "feature" && S.on[d.id]).forEach(loadArc);
});
/* Re-read every source from scratch. Shelter status and alerts already refresh every five
   minutes; this also re-queries the census tracts and emPOWER, so when CDC or HHS publish a
   new release the page picks it up by itself — no rebuild, no redeploy. */
function reloadAll() {
  afnRaw = null; afnState = null; EMP = null; empState = null; SHEL.list = []; SHEL.state = null;
  const b = $("refresh"); if (b) { b.disabled = true; b.dataset.busy = "1"; }
  reloadWx();
  return Promise.allSettled([loadAfn(), loadEmp(), loadShelterFeeds(), loadAlerts()]).then(() => { if (b) { b.disabled = false; delete b.dataset.busy; } refreshPanels(); });
}
setInterval(reloadAll, 30 * 60 * 1000);
$("refresh")?.addEventListener("click", reloadAll);
setInterval(loadAlerts, 5 * 60 * 1000);
setInterval(() => { SHEL.list = []; SHEL.state = null; loadShelterFeeds(); }, 5 * 60 * 1000); // shelter open/closed status stays current
window.__app = { map, S, toggle, DATA, TIME, dock, timeline, clock, addArc, get plan() { return PLAN; }, mapContext, refreshPanels, get alerts() { return alerts; }, SHEL, get emp() { return EMP; }, FACTORS };
