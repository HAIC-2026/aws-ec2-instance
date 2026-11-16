/* AllReady — map markup: shapes and icons a planner places by hand. MIT licensed.

   The data layers say what the feeds know. This says what the planner knows: "the quake
   damage is inside this radius", "this stretch of coast is the tsunami concern", "this
   shelter is the one with the generator — call Leilani". Shapes are drawn on the map, icons
   are dropped onto it and snap onto shapes; each carries a title, notes, a point of
   contact and an optional time window, so it appears and disappears with the timeline.

   Shapes: circle (radius), line, arrow, freehand path, area. Lines can snap to the roads
   and coastline of a vector basemap as they are drawn.
   Icons: hazards, and the help an access-and-functional-needs plan actually points at —
   accessible shelter, medical, dialysis, power, water, food, transport, language, pets…

   Privacy: contacts here are for facility and agency points of contact (a shelter manager,
   an EOC desk), never residents. Everything is stored in this browser only (localStorage)
   and leaves it only if the planner exports the file. */

import * as maplibregl from "maplibre-gl";

const KEY = "allready.markup.v1";
const NS = "http://www.w3.org/2000/svg";
const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };
const uid = () => "m" + Math.random().toString(36).slice(2, 9);

/* 24×24 stroke icons. Drawn for this app: simple enough to read at 18px on a map. */
export const ICONS = {
  // hazards
  hurricane: { n: "Hurricane", g: "Hazards", d: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM12 9c0-4 3-6 7-6-2 1-3 3-3 6M12 15c0 4-3 6-7 6 2-1 3-3 3-6" },
  tsunami: { n: "Tsunami", g: "Hazards", d: "M2 17c2 0 2-1.5 4-1.5S8 17 10 17s2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5M3 12c1-5 5-8 10-7-3 1-4 4-2 6 2 2 5 1 6-1" },
  flood: { n: "Flood", g: "Hazards", d: "M4 11 12 4l8 7M6.5 9.5V14M17.5 9.5V14M2 17c2 0 2-1.5 4-1.5S8 17 10 17s2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5M2 21c2 0 2-1.5 4-1.5S8 21 10 21s2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5" },
  wildfire: { n: "Wildfire", g: "Hazards", d: "M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9ZM10.5 17.5a1.5 2 0 0 0 3 0c0-1-1-1.5-1.5-3-.5 1.5-1.5 2-1.5 3Z" },
  earthquake: { n: "Earthquake", g: "Hazards", d: "M2 12h4l2-6 3 12 3-9 2 5 2-2h4" },
  volcano: { n: "Volcano / lava", g: "Hazards", d: "M3 20 9 9h6l6 11ZM9 9l1.5 3 1.5-2 1.5 2L15 9M12 6V3M8 5 7 3M16 5l1-2" },
  landslide: { n: "Landslide", g: "Hazards", d: "M3 20 15 6l6 14ZM7 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM4.5 14a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" },
  outage: { n: "Power outage", g: "Hazards", d: "M13 2 5 13h6l-1 9 8-11h-6ZM3 3l18 18" },
  roadclosed: { n: "Road closed", g: "Hazards", d: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM7 12h10" },
  evac: { n: "Evacuation zone", g: "Hazards", d: "M4 12h13M12 6l6 6-6 6M20 4v16" },
  // help / AFN support
  shelter: { n: "Shelter", g: "Help & AFN support", d: "M3 11 12 3l9 8M5.5 9.5V20h13V9.5M10 20v-6h4v6" },
  accessible: { n: "Accessible shelter", g: "Help & AFN support", d: "M12 6.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM12 8v5h4l2 5M12 10.5h4M10 12a5 5 0 1 0 5.5 7" },
  medical: { n: "Medical", g: "Help & AFN support", d: "M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z" },
  dialysis: { n: "Dialysis", g: "Help & AFN support", d: "M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11ZM9.5 14h5M12 11.5v5" },
  oxygen: { n: "Oxygen", g: "Help & AFN support", d: "M9 6V4h6v2M8 8a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2ZM10.5 13a1.5 2 0 1 0 3 0 1.5 2 0 0 0-3 0Z" },
  power: { n: "Backup power", g: "Help & AFN support", d: "M13 2 5 13h6l-1 9 8-11h-6Z" },
  water: { n: "Water", g: "Help & AFN support", d: "M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" },
  food: { n: "Food / meals", g: "Help & AFN support", d: "M6 3v8a2 2 0 0 0 4 0V3M8 3v18M17 3c-2 2-3 5-3 8h3v10" },
  transport: { n: "Transport", g: "Help & AFN support", d: "M5 5h14a1 1 0 0 1 1 1v10H4V6a1 1 0 0 1 1-1ZM4 11h16M7 16v2.5M17 16v2.5M7.5 13.5h.01M16.5 13.5h.01" },
  paratransit: { n: "Paratransit / lift", g: "Help & AFN support", d: "M3 7h12v9H3ZM15 10h3l3 3v3h-6M7 18.5a1.5 1.5 0 1 0 0-3M17 18.5a1.5 1.5 0 1 0 0-3M9 9.5v4M7 11.5h4" },
  language: { n: "Interpreter", g: "Help & AFN support", d: "M4 5h9M8.5 3v2M11 5c-.5 3.5-3 6-6.500 7.500M6 8c1 2 3 3.500 5 4.500M13 20l4-9 4 9M14.300 17h5.400" },
  pets: { n: "Pets / service animals", g: "Help & AFN support", d: "M12 20c-3 0-5-1.500-5-3.500S9.500 12 12 12s5 2.500 5 4.500S15 20 12 20ZM6 11a1.500 2 0 1 0 0-4M18 11a1.500 2 0 1 1 0-4M9.500 8a1.500 2 0 1 0 0-4M14.500 8a1.500 2 0 1 1 0-4" },
  supplies: { n: "Supplies / staging", g: "Help & AFN support", d: "M21 8 12 3 3 8v8l9 5 9-5ZM3 8l9 5 9-5M12 13v8" },
  fuel: { n: "Fuel", g: "Help & AFN support", d: "M5 20V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v15M4 20h11M7.500 7.500h4v4h-4ZM14 9h2l2 2v6a1.500 1.500 0 0 0 3 0V8l-2-2" },
  comms: { n: "Comms / siren", g: "Help & AFN support", d: "M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM8.500 15.500a5 5 0 0 1 0-7M15.500 8.500a5 5 0 0 1 0 7M5.500 18.500a9 9 0 0 1 0-13M18.500 5.500a9 9 0 0 1 0 13" },
  hub: { n: "Community hub", g: "Help & AFN support", d: "M12 7a2.500 2.500 0 1 0 0-5 2.500 2.500 0 0 0 0 5ZM5 14a2 2 0 1 0 0-4M19 14a2 2 0 1 1 0-4M7 21v-4a5 5 0 0 1 10 0v4M2.500 20v-2.500A2.500 2.500 0 0 1 5 15M21.500 20v-2.500A2.500 2.500 0 0 0 19 15" },
  note: { n: "Note", g: "Help & AFN support", d: "M5 3h10l4 4v14H5ZM14 3v5h5M8.500 12h7M8.500 16h5" },
};
// normalise the decimals written with trailing zeros above
for (const k in ICONS) ICONS[k].d = ICONS[k].d.replace(/(\.\d*?)0+(?=\D|$)/g, "$1").replace(/\.(?=\D|$)/g, "");

const SHAPES = [
  ["circle", "Radius", "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 12h9"],
  ["line", "Line", "M4 19 20 5"],
  ["arrow", "Arrow", "M4 19 20 5M12 5h8v8"],
  ["path", "Draw", "M3 17c3-8 6 4 9-4s5 2 9-6"],
  ["area", "Area", "M4 8l8-4 8 5-3 10-10 1Z"],
];
const COLORS = ["#ffffff", "#ff6a5c", "#f0c24a", "#5fd39a", "#4d9fff", "#c084fc", "#0b0b0d"];

function svg(d, size = 18) {
  const s = document.createElementNS(NS, "svg");
  for (const [k, v] of Object.entries({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 1.7, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" })) s.setAttribute(k, v);
  const p = document.createElementNS(NS, "path"); p.setAttribute("d", d); s.append(p);
  return s;
}

const KM = 111.32;
function circlePoly([lon, lat], km, n = 72) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * 2 * Math.PI;
    pts.push([lon + (km * Math.sin(a)) / (KM * Math.cos((lat * Math.PI) / 180)), lat + (km * Math.cos(a)) / KM]);
  }
  return pts;
}
const distKm = (a, b) => Math.hypot((a[0] - b[0]) * KM * Math.cos((a[1] * Math.PI) / 180), (a[1] - b[1]) * KM);

export function createAnnotations({ map, host, font = () => ["Noto Sans Regular"], onChange = () => {}, onSelect = () => {} }) {
  let items = [];
  try { items = JSON.parse(localStorage.getItem(KEY)) || []; } catch {}
  let tool = "select", armedIcon = null, selected = null, draft = null, snap = false, time = null;
  const markers = new Map(); // icon id -> Marker
  let handles = [];

  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {} onChange(); };
  const byId = (id) => items.find((x) => x.id === id);
  const inTime = (it) => { const t = time ?? Date.now(); return (!it.from || t >= Date.parse(it.from)) && (!it.to || t <= Date.parse(it.to)); };
  const anchor = (it) => it.kind === "icon" ? it.at : it.kind === "circle" ? it.center : it.coords[Math.floor((it.coords.length - 1) / 2)];

  /* ---------- map layers (shapes) ---------- */
  function geo() {
    const fs = [];
    const all = draft ? [...items, draft] : items;
    for (const it of all) {
      if (it.kind === "icon" || (it !== draft && !inTime(it))) continue;
      const props = { id: it.id, color: it.color || "#ffffff", width: it.width || 3, title: it.title || "", sel: it.id === selected ? 1 : 0, arrow: it.kind === "arrow" ? 1 : 0 };
      if (it.kind === "circle") fs.push({ type: "Feature", properties: { ...props, poly: 1 }, geometry: { type: "Polygon", coordinates: [circlePoly(it.center, it.radiusKm)] } });
      else if (it.kind === "area" && it.coords.length >= 3) fs.push({ type: "Feature", properties: { ...props, poly: 1 }, geometry: { type: "Polygon", coordinates: [[...it.coords, it.coords[0]]] } });
      else if (it.coords?.length >= 2) fs.push({ type: "Feature", properties: props, geometry: { type: "LineString", coordinates: it.coords } });
    }
    return { type: "FeatureCollection", features: fs };
  }
  /** Called on every style load: sources, layers and the arrowhead image do not survive setStyle. */
  function attach() {
    if (!map.hasImage("mk-arrow")) {
      const c = document.createElement("canvas"); c.width = c.height = 32;
      const x = c.getContext("2d"); x.fillStyle = "#fff"; x.beginPath(); x.moveTo(6, 5); x.lineTo(28, 16); x.lineTo(6, 27); x.closePath(); x.fill();
      map.addImage("mk-arrow", x.getImageData(0, 0, 32, 32), { sdf: true });
    }
    if (!map.getSource("markup")) map.addSource("markup", { type: "geojson", data: geo() });
    const add = (l) => { if (!map.getLayer(l.id)) map.addLayer(l); };
    add({ id: "markup-fill", type: "fill", source: "markup", filter: ["==", ["get", "poly"], 1], paint: { "fill-color": ["get", "color"], "fill-opacity": 0.14 } });
    add({ id: "markup-line", type: "line", source: "markup", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["get", "color"], "line-width": ["+", ["get", "width"], ["*", ["get", "sel"], 1.5]], "line-dasharray": ["case", ["==", ["get", "poly"], 1], ["literal", [2, 1.5]], ["literal", [1, 0]]] } });
    add({ id: "markup-arrow", type: "symbol", source: "markup", filter: ["==", ["get", "arrow"], 1], layout: { "symbol-placement": "line", "symbol-spacing": 70, "icon-image": "mk-arrow", "icon-size": ["interpolate", ["linear"], ["get", "width"], 1, 0.4, 10, 1], "icon-allow-overlap": true }, paint: { "icon-color": ["get", "color"] } });
    // symbol-placement cannot be data-driven, so areas and lines get a label layer each
    const label = (id, filter, placement) => add({ id, type: "symbol", source: "markup", filter: ["all", ["!=", ["get", "title"], ""], filter], layout: { "text-field": ["get", "title"], "text-font": font(), "text-size": 12, "symbol-placement": placement, "text-offset": [0, -0.9], "text-allow-overlap": true }, paint: { "text-color": "#fff", "text-halo-color": "rgba(0,0,0,.85)", "text-halo-width": 1.6 } });
    label("markup-label-area", ["==", ["get", "poly"], 1], "point");
    label("markup-label-line", ["!=", ["get", "poly"], 1], "line-center");
  }
  const redraw = () => map.getSource("markup")?.setData(geo());

  /* ---------- icons (HTML markers: crisp at any zoom, and they sit on the globe) ---------- */
  function iconEl(it) {
    const d = el("button", "mk-icon" + (it.id === selected ? " is-sel" : ""));
    d.type = "button";
    d.style.setProperty("--s", (it.size || 1));
    d.style.setProperty("--c", it.color || "#ffffff");
    const def = ICONS[it.icon] || ICONS.note;
    const badge = el("span", "mk-badge"); badge.append(svg(def.d, 18));
    d.append(badge);
    if (it.title) d.append(el("span", "mk-title", it.title));
    d.setAttribute("aria-label", `${def.n}${it.title ? ": " + it.title : ""}`);
    d.addEventListener("click", (e) => { e.stopPropagation(); select(it.id); });
    return d;
  }
  /** Snap an icon onto a shape under it: the centre of a radius, the nearest vertex of a line. */
  function snapIcon(it) {
    it.parent = null;
    const p = map.project(it.at); let best = null;
    for (const s of items) {
      if (s.kind === "icon" || !inTime(s)) continue;
      const cands = s.kind === "circle" ? [s.center] : s.coords;
      for (const c of cands) { const q = map.project(c), dd = Math.hypot(q.x - p.x, q.y - p.y); if (dd < 34 && (!best || dd < best.d)) best = { d: dd, c, s }; }
    }
    if (best) { it.at = [...best.c]; it.parent = best.s.id; }
  }
  function syncIcons() {
    for (const [id, m] of markers) if (!byId(id) || !inTime(byId(id))) { m.remove(); markers.delete(id); }
    for (const it of items) {
      if (it.kind !== "icon" || !inTime(it)) continue;
      let m = markers.get(it.id);
      if (m) { m.remove(); markers.delete(it.id); }
      m = new maplibregl.Marker({ element: iconEl(it), draggable: true, anchor: "center" }).setLngLat(it.at).addTo(map);
      m.on("dragend", () => {
        const ll = m.getLngLat(); it.at = [ll.lng, ll.lat];
        snapIcon(it); m.setLngLat(it.at);
        save(); select(it.id);
      });
      markers.set(it.id, m);
    }
  }

  /* ---------- selection handles for shapes ---------- */
  function clearHandles() { handles.forEach((h) => h.remove()); handles = []; }
  function handle(lngLat, cls, onDrag, onEnd) {
    const m = new maplibregl.Marker({ element: el("div", "mk-handle " + cls), draggable: true }).setLngLat(lngLat).addTo(map);
    m.on("drag", () => { const l = m.getLngLat(); onDrag([l.lng, l.lat]); redraw(); });
    m.on("dragend", () => { onEnd?.(); save(); drawHandles(); });
    handles.push(m);
  }
  function moveBy(it, dx, dy) {
    if (it.kind === "circle") it.center = [it.center[0] + dx, it.center[1] + dy];
    else it.coords = it.coords.map(([x, y]) => [x + dx, y + dy]);
    for (const c of items) if (c.kind === "icon" && c.parent === it.id) { c.at = [c.at[0] + dx, c.at[1] + dy]; markers.get(c.id)?.setLngLat(c.at); }
  }
  function drawHandles() {
    clearHandles();
    const it = byId(selected);
    if (!it || it.kind === "icon" || !inTime(it)) return;
    let last = anchor(it);
    handle(last, "is-move", (p) => { moveBy(it, p[0] - last[0], p[1] - last[1]); last = p; });
    if (it.kind === "circle") {
      const edge = () => [it.center[0] + it.radiusKm / (KM * Math.cos((it.center[1] * Math.PI) / 180)), it.center[1]];
      handle(edge(), "is-size", (p) => { it.radiusKm = Math.max(0.05, distKm(it.center, p)); });
    } else if (it.coords.length <= 14) {
      it.coords.forEach((c, i) => { if (c !== last) handle(c, "is-vertex", (p) => { it.coords[i] = p; }); });
    }
  }

  /* ---------- snapping a drawn point to roads / coastline of a vector basemap ---------- */
  function snapTo(point) {
    if (!snap) return null;
    const r = 14;
    let fs = [];
    try { fs = map.queryRenderedFeatures([[point.x - r, point.y - r], [point.x + r, point.y + r]]); } catch {}
    let best = null;
    const seg = (a, b) => {
      const A = map.project(a), B = map.project(b), dx = B.x - A.x, dy = B.y - A.y, L = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((point.x - A.x) * dx + (point.y - A.y) * dy) / L));
      const d = Math.hypot(A.x + t * dx - point.x, A.y + t * dy - point.y);
      if (d <= r && (!best || d < best.d)) best = { d, c: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] };
    };
    const walk = (line) => { for (let i = 1; i < line.length; i++) seg(line[i - 1], line[i]); };
    for (const f of fs) {
      const sl = f.sourceLayer || "";
      if (f.source === "markup" || !/transportation|water|waterway|boundary/.test(sl)) continue;
      const g = f.geometry;
      if (g.type === "LineString") walk(g.coordinates);
      else if (g.type === "MultiLineString" || g.type === "Polygon") g.coordinates.forEach(walk);
      else if (g.type === "MultiPolygon") g.coordinates.forEach((p) => p.forEach(walk));
    }
    return best?.c || null;
  }
  const pt = (e) => snapTo(e.point) || [e.lngLat.lng, e.lngLat.lat];

  /* ---------- drawing ---------- */
  function finish() {
    if (!draft) return;
    const ok = draft.kind === "circle" || draft.coords.length >= (draft.kind === "area" ? 3 : 2);
    if (ok) { items.push(draft); selected = draft.id; }
    draft = null; setTool("select"); save(); refresh();
  }
  function setTool(t) {
    tool = t; armedIcon = null; draft = draft && t !== "select" ? draft : null;
    map.getCanvas().style.cursor = t === "select" ? "" : "crosshair";
    if (t !== "path") map.dragPan.enable();
    renderPanel();
  }
  /** planner.js calls this first on every map click; true means "handled, do not inspect". */
  function consume(e) {
    if (armedIcon) { addIcon(armedIcon, [e.lngLat.lng, e.lngLat.lat]); return true; }
    if (tool === "select") {
      const hit = map.getLayer("markup-line") ? map.queryRenderedFeatures([[e.point.x - 6, e.point.y - 6], [e.point.x + 6, e.point.y + 6]], { layers: ["markup-line", "markup-fill"] })[0] : null;
      if (hit) { select(hit.properties.id); return true; }
      if (selected) { select(null); }
      return false;
    }
    if (tool === "circle") {
      // radius starts at ~1/8 of the visible width, so it is a sensible size at any zoom
      const b = map.getBounds(), km = Math.max(0.2, distKm([b.getWest(), e.lngLat.lat], [b.getEast(), e.lngLat.lat]) / 16);
      draft = { id: uid(), kind: "circle", center: pt(e), radiusKm: +km.toFixed(2), color: "#ff6a5c", width: 2, title: "" };
      finish(); return true;
    }
    if (tool === "path") return true; // handled by the drag listeners
    if (!draft) draft = { id: uid(), kind: tool, coords: [], color: tool === "area" ? "#f0c24a" : "#ffffff", width: 3, title: "" };
    draft.coords.push(pt(e)); redraw();
    return true;
  }
  map.on("dblclick", (e) => { if (draft && tool !== "path") { e.preventDefault(); draft.coords.pop(); finish(); } });
  addEventListener("keydown", (e) => {
    if (e.key === "Enter" && draft) finish();
    else if (e.key === "Escape" && (draft || tool !== "select" || armedIcon)) { draft = null; setTool("select"); redraw(); }
    else if ((e.key === "Delete" || e.key === "Backspace") && selected && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) remove(selected);
  });
  // freehand
  let drawing = false;
  const down = (e) => { if (tool !== "path") return; e.preventDefault(); map.dragPan.disable(); drawing = true; draft = { id: uid(), kind: "path", coords: [pt(e)], color: "#4d9fff", width: 3, title: "" }; };
  const move = (e) => {
    if (!drawing || !draft) return;
    const p = pt(e), l = draft.coords[draft.coords.length - 1], a = map.project(l), b = map.project(p);
    if (Math.hypot(a.x - b.x, a.y - b.y) > 5) { draft.coords.push(p); redraw(); }
  };
  const up = () => { if (!drawing) return; drawing = false; map.dragPan.enable(); finish(); };
  map.on("mousedown", down); map.on("mousemove", move); map.on("mouseup", up);
  map.on("touchstart", down); map.on("touchmove", move); map.on("touchend", up);

  function addIcon(key, at) {
    const it = { id: uid(), kind: "icon", icon: key, at, size: 1, color: "#ffffff", title: ICONS[key]?.n || "", notes: "", contact: {} };
    snapIcon(it); items.push(it); armedIcon = null; map.getCanvas().style.cursor = ""; selected = it.id; save(); refresh();
  }
  // drag an icon out of the palette and drop it on the map
  const cont = map.getContainer();
  cont.addEventListener("dragover", (e) => { if (e.dataTransfer.types.includes("text/allready-icon")) e.preventDefault(); });
  cont.addEventListener("drop", (e) => {
    const k = e.dataTransfer.getData("text/allready-icon"); if (!k) return;
    e.preventDefault();
    const r = cont.getBoundingClientRect(), ll = map.unproject([e.clientX - r.left, e.clientY - r.top]);
    addIcon(k, [ll.lng, ll.lat]);
  });

  function select(id) { selected = id; refresh(); onSelect(id); }
  function remove(id) {
    items = items.filter((x) => x.id !== id);
    for (const c of items) if (c.parent === id) c.parent = null;
    if (selected === id) selected = null;
    save(); refresh();
  }
  function refresh() { redraw(); syncIcons(); drawHandles(); renderPanel(); }

  /* ---------- panel ---------- */
  function field(label, input) { const l = el("label", "mk-f"); l.append(el("span", null, label), input); return l; }
  function input(type, value, on, attrs = {}) {
    const i = el(type === "textarea" ? "textarea" : "input");
    if (type !== "textarea") i.type = type;
    for (const [k, v] of Object.entries(attrs)) i.setAttribute(k, v);
    i.value = value ?? "";
    i.addEventListener("input", () => on(i.value));
    return i;
  }
  function renderPanel() {
    if (!host) return;
    const keepFocus = document.activeElement?.dataset?.mk;
    host.textContent = ""; host.classList.add("mk");

    const tools = el("div", "mk-tools");
    const tb = (key, name, d) => {
      const b = el("button", "mk-tool"); b.type = "button"; b.append(svg(d, 17), el("span", null, name));
      b.setAttribute("aria-pressed", tool === key && !armedIcon); b.onclick = () => setTool(key); return b;
    };
    tools.append(tb("select", "Select", "M5 3l14 8-6 2-2 6Z"), ...SHAPES.map(([k, n, d]) => tb(k, n, d)));
    host.append(tools);

    const hint = { select: "Click a shape or icon to edit it. Drag icons anywhere; drop one on a shape and it snaps on and travels with it.", circle: "Click the map to drop a radius. Drag the edge handle to size it.", line: "Click each point. Double-click or press Enter to finish.", arrow: "Click each point in the direction of travel. Double-click or Enter to finish.", path: "Press and drag to draw.", area: "Click each corner. Double-click or Enter to close it." }[tool];
    host.append(el("p", "src mk-hint", armedIcon ? `Click the map to place “${ICONS[armedIcon].n}”. Esc cancels.` : hint));

    const sn = el("label", "mk-snap");
    const cb = el("input"); cb.type = "checkbox"; cb.checked = snap; cb.onchange = () => { snap = cb.checked; };
    sn.append(cb, el("span", null, "Snap lines to roads and coastline (vector basemaps: Dark, Light, Streets)"));
    host.append(sn);

    const scroll = el("div", "scroll");
    const groups = {};
    for (const [k, v] of Object.entries(ICONS)) (groups[v.g] ||= []).push([k, v]);
    for (const [g, list] of Object.entries(groups)) {
      scroll.append(el("h4", "mk-h", g));
      const grid = el("div", "mk-pal");
      for (const [k, v] of list) {
        const b = el("button", "mk-pi"); b.type = "button"; b.draggable = true; b.title = v.n + " — drag onto the map, or click then click the map";
        b.setAttribute("aria-label", v.n); b.setAttribute("aria-pressed", armedIcon === k);
        b.append(svg(v.d, 19));
        b.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/allready-icon", k); e.dataTransfer.effectAllowed = "copy"; });
        b.onclick = () => { armedIcon = armedIcon === k ? null : k; tool = "select"; map.getCanvas().style.cursor = armedIcon ? "crosshair" : ""; renderPanel(); };
        grid.append(b);
      }
      scroll.append(grid);
    }

    const it = byId(selected);
    if (it) {
      const set = (fn) => (v) => { fn(v); save(); redraw(); if (it.kind === "icon") syncIcons(); };
      const ed = el("div", "mk-ed");
      ed.append(el("h4", "mk-h", it.kind === "icon" ? ICONS[it.icon]?.n || "Icon" : SHAPES.find((s) => s[0] === it.kind)?.[1] || "Shape"));
      const title = input("text", it.title, set((v) => (it.title = v)), { placeholder: "Title, e.g. Tsunami — north shore", "data-mk": "title" });
      ed.append(field("Title", title));
      if (it.kind === "circle") ed.append(field("Radius (km)", input("number", it.radiusKm, set((v) => { it.radiusKm = Math.max(0.05, +v || 0.05); drawHandles(); }), { min: "0.05", step: "0.1", "data-mk": "r" })));
      else if (it.kind === "icon") ed.append(field("Size", input("range", it.size || 1, set((v) => (it.size = +v)), { min: "0.6", max: "2.4", step: "0.1" })));
      else ed.append(field("Line weight", input("range", it.width || 3, set((v) => (it.width = +v)), { min: "1", max: "10", step: "0.5" })));
      const sw = el("div", "mk-sw");
      COLORS.forEach((c) => { const b = el("button"); b.type = "button"; b.style.background = c; b.setAttribute("aria-label", "Colour " + c); b.setAttribute("aria-pressed", (it.color || "#ffffff") === c); b.onclick = () => { it.color = c; save(); refresh(); }; sw.append(b); });
      ed.append(field("Colour", sw));
      const tw = el("div", "mk-2");
      tw.append(field("Shown from", input("datetime-local", it.from || "", set((v) => (it.from = v || null)))), field("Until", input("datetime-local", it.to || "", set((v) => (it.to = v || null)))));
      ed.append(tw, el("p", "src", "Leave both empty to keep it on the map always. With times set it appears and disappears as the History timeline plays."));
      ed.append(field("Notes", input("textarea", it.notes, set((v) => (it.notes = v)), { rows: "3", placeholder: "What a responder needs to know", "data-mk": "notes" })));
      it.contact ||= {};
      ed.append(el("h4", "mk-h", "Point of contact"));
      const c2 = el("div", "mk-2");
      c2.append(field("Name", input("text", it.contact.name, set((v) => (it.contact.name = v)), { autocomplete: "off", "data-mk": "cn" })), field("Role", input("text", it.contact.role, set((v) => (it.contact.role = v)), { placeholder: "Shelter manager", autocomplete: "off", "data-mk": "cr" })));
      const c3 = el("div", "mk-2");
      c3.append(field("Phone", input("tel", it.contact.phone, set((v) => (it.contact.phone = v)), { autocomplete: "off", "data-mk": "cp" })), field("Email", input("email", it.contact.email, set((v) => (it.contact.email = v)), { autocomplete: "off", "data-mk": "ce" })));
      ed.append(c2, c3, el("p", "src", "For facility and agency contacts only — not residents. Stored in this browser; it leaves only if you export."));
      const row = el("div", "mk-row");
      const del = el("button", "btn ghost", "Delete"); del.type = "button"; del.onclick = () => remove(it.id);
      const zoom = el("button", "btn ghost", "Zoom to"); zoom.type = "button"; zoom.onclick = () => map.flyTo({ center: anchor(it), zoom: Math.max(map.getZoom(), 11) });
      row.append(zoom, del); ed.append(row);
      scroll.append(ed);
    }

    scroll.append(el("h4", "mk-h", `On the map (${items.length})`));
    if (!items.length) scroll.append(el("p", "empty mk-empty", "Nothing placed yet."));
    const ul = el("ul", "mk-list");
    for (const x of items) {
      const b = el("button", null); b.type = "button"; b.setAttribute("aria-pressed", x.id === selected);
      const d = x.kind === "icon" ? ICONS[x.icon]?.d : SHAPES.find((s) => s[0] === x.kind)?.[2];
      b.append(svg(d || ICONS.note.d, 15), el("span", null, x.title || (x.kind === "icon" ? ICONS[x.icon]?.n : SHAPES.find((s) => s[0] === x.kind)?.[1])));
      if (x.from || x.to) b.append(el("em", null, "timed"));
      if (!inTime(x)) b.classList.add("is-off");
      b.onclick = () => { select(x.id); };
      const li = el("li"); li.append(b); ul.append(li);
    }
    scroll.append(ul);

    const io = el("div", "mk-row");
    const ex = el("button", "btn ghost", "Export"); ex.type = "button";
    ex.onclick = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(items, null, 1)], { type: "application/json" })); a.download = "allready-markup.json"; a.click(); };
    const im = el("button", "btn ghost", "Import"); im.type = "button";
    im.onclick = () => { const f = el("input"); f.type = "file"; f.accept = "application/json"; f.onchange = async () => { try { const j = JSON.parse(await f.files[0].text()); if (Array.isArray(j)) { items = j.filter((x) => x && x.id && x.kind); save(); refresh(); } } catch {} }; f.click(); };
    io.append(ex, im); scroll.append(io);
    host.append(scroll);
    if (keepFocus) { const n = host.querySelector(`[data-mk="${keepFocus}"]`); n?.focus(); }
  }

  const safeAttach = () => { try { if (map.isStyleLoaded() || map.getStyle()) { attach(); redraw(); } } catch (e) { if (!/not done loading/i.test(String(e?.message))) console.warn("markup attach:", e); } };
  safeAttach(); map.on("style.load", safeAttach); syncIcons(); renderPanel();
  return {
    attach: safeAttach,
    consume, render: renderPanel,
    setTime(t) { time = t; redraw(); syncIcons(); drawHandles(); },
    /** Timed items as timeline spans. */
    spans: () => items.filter((x) => x.from).map((x) => ({ t0: Date.parse(x.from), t1: x.to ? Date.parse(x.to) : Date.now(), label: x.title || x.kind, color: x.color })),
    get count() { return items.length; },
    get selected() { return selected; },
    /* What the AI assistant is allowed to see: geometry, titles, notes and timing.
       Points of contact are deliberately left out — they never leave this browser. */
    snapshot: () => items.map(({ contact, ...x }) => ({ ...x, visible: inTime(x) })),
  };
}
