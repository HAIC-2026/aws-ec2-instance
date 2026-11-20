/* AllReady ArcGIS bridge. MIT licensed. No Esri SDK needed: this talks to the open ArcGIS REST API, which every
   Esri server (Hawaiʻi Statewide GIS, county GIS, ArcGIS Online, CDC, FEMA) exposes. Paste any public
   MapServer, FeatureServer or ImageServer URL and it becomes a map layer.
   - Feature layers are queried as GeoJSON in WGS84, paged, and simplified for display.
   - Map services draw as server-rendered images (export), cached map services as tiles.
   - Services that need a sign-in are refused: AllReady uses public data only.
   - Field names that suggest personal information are flagged before anything is added. */
import { fetchT } from "./net.js";

export const PRESETS = [
  { g: "Hazards (Hawaiʻi Statewide GIS)", n: "Fire risk areas", u: "https://geodata.hawaii.gov/arcgis/rest/services/Hazards/MapServer/7", haz: "wildfire" },
  { g: "Hazards (Hawaiʻi Statewide GIS)", n: "Lava flow hazard zones", u: "https://geodata.hawaii.gov/arcgis/rest/services/Hazards/MapServer/3", haz: "volcano" },
  { g: "Hazards (Hawaiʻi Statewide GIS)", n: "Tsunami safe zones", u: "https://geodata.hawaii.gov/arcgis/rest/services/Hazards/MapServer/13", haz: "tsunami" },
  { g: "Hazards (Hawaiʻi Statewide GIS)", n: "1% coastal flood zone, 3.2 ft sea level rise", u: "https://geodata.hawaii.gov/arcgis/rest/services/Hazards/MapServer/15", haz: "flood" },
  { g: "Facilities (Hawaiʻi Statewide GIS)", n: "Hospitals", u: "https://geodata.hawaii.gov/arcgis/rest/services/Infrastructure/MapServer/5" },
  { g: "Facilities (Hawaiʻi Statewide GIS)", n: "Fire stations, all types", u: "https://geodata.hawaii.gov/arcgis/rest/services/EmergMgmtPubSafety/MapServer/7" },
  { g: "Facilities (Hawaiʻi Statewide GIS)", n: "EMS stations", u: "https://geodata.hawaii.gov/arcgis/rest/services/EmergMgmtPubSafety/MapServer/8" },
  { g: "Facilities (Hawaiʻi Statewide GIS)", n: "Trauma centers", u: "https://geodata.hawaii.gov/arcgis/rest/services/EmergMgmtPubSafety/MapServer/9" },
];

// Names that suggest a record is about a person rather than a place or an area.
const PII = /(^|_)(ssn|social_?sec|dob|birth(_?date)?|first_?name|last_?name|full_?name|client(_?id|_?name)?|patient|case_?(no|num|number|id)|medicaid|medicare_?id|mrn|member_?id|household_?id|email|cell|mobile|home_?phone|ethnicity|race|gender|sex|diagnos\w*|immigration|citizenship)(_|$)/i;
const SYS = /^(objectid|fid|shape(_?(length|area|leng))?|globalid|st_area|st_length|shape\.\w+|st_area\(shape\)|st_length\(shape\))$/i;

export function normalize(raw) {
  let u; try { u = new URL(String(raw).trim()); } catch { throw new Error("That is not a web address."); }
  if (u.protocol !== "https:") throw new Error("Use an https address.");
  const m = u.pathname.replace(/\/+$/, "").match(/^(.*\/(MapServer|FeatureServer|ImageServer))(?:\/(\d+))?$/i);
  if (!m) throw new Error("Paste a MapServer, FeatureServer or ImageServer address (optionally ending in a layer number).");
  return { service: u.origin + m[1], type: m[2].toLowerCase(), layer: m[3] != null ? +m[3] : null, url: u.origin + m[1] + (m[3] != null ? "/" + m[3] : "") };
}

async function getJSON(url) {
  const r = await fetchT(url + (url.includes("?") ? "&" : "?") + "f=json");
  if (!r.ok) throw new Error(`The server answered ${r.status}.`);
  const j = await r.json();
  if (j.error) throw new Error(j.error.code === 499 || j.error.code === 498 || /token/i.test(j.error.message || "") ? "This service needs a sign-in. AllReady only adds public services." : j.error.message || "The server returned an error.");
  return j;
}

export async function describe(raw) {
  const n = normalize(raw);
  const j = await getJSON(n.url);
  const attribution = (j.copyrightText || "").replace(/<[^>]+>/g, "").slice(0, 140);
  if (n.type === "imageserver") return { ...n, kind: "image", name: j.name || "Image service", attribution };
  if (n.layer == null) {
    if (n.type === "featureserver") {
      const ls = (j.layers || []).map((l) => `${l.id}: ${l.name}`).join("; ");
      throw new Error("Add a layer number to the end of the address. Layers here: " + (ls || "none listed"));
    }
    const tiled = j.singleFusedMapCache && [102100, 3857].includes(j.tileInfo?.spatialReference?.latestWkid || j.tileInfo?.spatialReference?.wkid);
    return { ...n, kind: tiled ? "tiled" : "dynamic", name: j.mapName || j.documentInfo?.Title || "Map service", attribution, maxLod: tiled ? (j.tileInfo.lods?.length || 19) - 1 : null };
  }
  if (j.type === "Group Layer") throw new Error("This is a group layer. Pick one of its layers: " + (j.subLayers || []).map((l) => `${l.id}: ${l.name}`).join("; "));
  if (j.type === "Raster Layer") return { ...n, kind: "dynamic", sub: n.layer, url: n.service, name: j.name, attribution };
  const canQuery = /query/i.test(j.capabilities || "Query");
  const fields = (j.fields || []).map((f) => f.name);
  return {
    ...n, kind: canQuery ? "feature" : "dynamic", sub: canQuery ? null : n.layer, name: j.name || "Layer", attribution,
    geom: { esriGeometryPoint: "point", esriGeometryMultipoint: "point", esriGeometryPolyline: "line", esriGeometryPolygon: "polygon" }[j.geometryType] || "polygon",
    fields, display: j.displayField || "", maxRecords: j.maxRecordCount || 1000,
    geojson: /geojson/i.test(j.supportedQueryFormats || ""), paging: !!j.advancedQueryCapabilities?.supportsPagination,
    pii: fields.filter((f) => PII.test(f)),
  };
}

// Esri JSON geometry to GeoJSON (used only when a server cannot answer in GeoJSON)
function esri2geo(g) {
  if (!g) return null;
  if (g.x != null) return { type: "Point", coordinates: [g.x, g.y] };
  if (g.points) return { type: "MultiPoint", coordinates: g.points };
  if (g.paths) return { type: "MultiLineString", coordinates: g.paths };
  if (g.rings) return { type: "Polygon", coordinates: g.rings }; // ring winding lets MapLibre split outers and holes
  return null;
}

export async function queryAll(info, { max = 20000, onProgress } = {}) {
  const page = Math.min(info.maxRecords || 1000, 2000), out = [];
  const simp = info.geom === "point" ? "" : "&maxAllowableOffset=0.0002&geometryPrecision=5";
  const fmt = info.geojson ? "geojson" : "json";
  for (let off = 0; off < max; off += page) {
    const q = `${info.url}/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326${simp}&f=${fmt}` + (info.paging ? `&resultOffset=${off}&resultRecordCount=${page}` : "");
    const r = await fetchT(q, {}, 30000); if (!r.ok) throw new Error(`The server answered ${r.status}.`);
    const j = await r.json(); if (j.error) throw new Error(j.error.message || "Query failed.");
    const fs = info.geojson ? j.features || [] : (j.features || []).map((f) => ({ type: "Feature", properties: f.attributes, geometry: esri2geo(f.geometry) }));
    out.push(...fs.filter((f) => f.geometry)); onProgress?.(out.length);
    if (!info.paging || fs.length < page || !(j.exceededTransferLimit || j.properties?.exceededTransferLimit || fs.length === page)) break;
  }
  return { type: "FeatureCollection", features: out };
}

export function rasterTiles(info) {
  if (info.kind === "tiled") return `${info.service}/tile/{z}/{y}/{x}`;
  if (info.kind === "image") return `${info.service}/exportImage?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&format=png32&transparent=true&f=image`;
  const show = info.sub != null ? `&layers=show:${info.sub}` : "";
  return `${info.service}/export?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&format=png32&transparent=true${show}&f=image`;
}

// Attribute rows for the inspector: skip system fields, keep it short.
export function attrRows(props, fields, limit = 10) {
  const keys = (fields?.length ? fields : Object.keys(props)).filter((k) => !SYS.test(k) && !PII.test(k) && props[k] != null && props[k] !== "" && props[k] !== " ");
  return keys.slice(0, limit).map((k) => [k.replace(/_/g, " "), typeof props[k] === "number" && props[k] > 9e11 && props[k] < 4e12 ? new Date(props[k]).toISOString().slice(0, 10) : String(props[k]).slice(0, 80)]);
}
