/* AllReady workspace: dockable, resizable, tabbed panels (Adobe-style). MIT licensed. No dependencies.
   - Three dock zones (left, right, bottom) around a fixed center (the map). Zones resize with splitters.
   - A zone holds groups stacked along it; a group holds panels as tabs. Groups resize with splitters too.
   - Drag a tab onto another group's tabs (add as tab), onto the top/bottom (or left/right) of a group (split),
     onto an empty edge (new zone), or onto the map (float). Drag a floating window's title bar to move it;
     drop it on a dock target to dock the whole window. Esc cancels a drag.
   - Every move is also available from each group's ⋯ menu, so the workspace works without a mouse.
   - Layout is saved to localStorage. Narrow screens get one bottom sheet with every open panel as a tab. */

const ZONES = ["left", "right", "bottom"];
const MINZ = { left: 220, right: 220, bottom: 96 };
const DEFZ = { left: 340, right: 330, bottom: 168 };
const GMIN = 72; // smallest group along its zone
const EDGE = 30; // px band at the workspace edge that docks into an empty zone
const DRAG_START = 6;
const NARROW = 900;

const el = (tag, cls, attrs = {}) => { const n = document.createElement(tag); if (cls) n.className = cls; for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) n.setAttribute(k, v === true ? "" : v); return n; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const GRID = 12, snapG = (v) => Math.round(v / GRID) * GRID; // floating windows move and size on this grid
const inR = (r, x, y) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;

export function createDock({ root, center, panels, presets = {}, initial = "default", storeKey = "allready.ws.v1", onLayout = () => {}, overlay = false }) {
  // overlay:true lets the centre fill the whole workspace and the zones float above it.
  // That is what makes translucent panels mean anything — there has to be something behind
  // them. Splitters and sizing are unchanged; only the centre's rectangle differs.
  const P = new Map(panels.map((p) => [p.id, p])); // id -> { id, title, zone, mount(el), onShow, onHide, float:{w,h} }
  const PEL = new Map(); // id -> panel element (created once, moved between groups)
  const listeners = new Set();
  const BADGE = new Map(); // id -> short text shown on the tab (alert counts and the like)
  let narrow = false, drag = null, menu = null;

  // ---------- state ----------
  const blank = () => ({ v: 1, zones: { left: { size: DEFZ.left, hide: false, groups: [] }, right: { size: DEFZ.right, hide: false, groups: [] }, bottom: { size: DEFZ.bottom, hide: false, groups: [] } }, floats: [] });
  const grp = (tabs, extra = {}) => ({ tabs: [...tabs], active: tabs[0], size: 1, min: false, ...extra });
  function fromPreset(name) {
    const pr = presets[name] || presets.default; const s = blank();
    for (const z of ZONES) { (pr[z] || []).forEach((t) => s.zones[z].groups.push(Array.isArray(t) ? grp(t) : grp(t.tabs, { size: t.size || 1 }))); if (pr.sizes?.[z]) s.zones[z].size = pr.sizes[z]; }
    (pr.floats || []).forEach((f) => s.floats.push(grp(f.tabs, { x: f.x, y: f.y, w: f.w, h: f.h })));
    return s;
  }
  function sanitize(s) {
    const seen = new Set();
    const clean = (g) => { g.tabs = (g.tabs || []).filter((id) => P.has(id) && !seen.has(id) && seen.add(id)); if (!g.tabs.includes(g.active)) g.active = g.tabs[0]; g.size = +g.size > 0 ? +g.size : 1; return g.tabs.length; };
    for (const z of ZONES) { s.zones[z] = Object.assign({ size: DEFZ[z], hide: false, groups: [] }, s.zones[z] || {}); s.zones[z].groups = s.zones[z].groups.filter(clean); }
    s.floats = (s.floats || []).filter(clean);
    return s;
  }
  let S;
  try { const raw = JSON.parse(localStorage.getItem(storeKey)); S = raw?.v === 1 ? sanitize(raw) : null; } catch { S = null; }
  if (!S) S = sanitize(fromPreset(initial));
  const save = () => { if (!narrow) try { localStorage.setItem(storeKey, JSON.stringify(S)); } catch {} };

  // ---------- where things are ----------
  const allGroups = () => [...ZONES.flatMap((z) => S.zones[z].groups.map((g, i) => ({ g, z, i }))), ...S.floats.map((g, i) => ({ g, z: "float", i }))];
  const findPanel = (id) => allGroups().find(({ g }) => g.tabs.includes(id));
  const isOpen = (id) => !!findPanel(id);
  function detach(ids) { // pull panels out of whatever group holds them; drop empty groups
    for (const id of ids) {
      const f = findPanel(id); if (!f) continue;
      f.g.tabs = f.g.tabs.filter((x) => x !== id);
      if (f.g.active === id) f.g.active = f.g.tabs[0];
      if (!f.g.tabs.length) (f.z === "float" ? S.floats : S.zones[f.z].groups).splice(f.i, 1);
    }
  }

  // ---------- DOM skeleton ----------
  root.classList.add("dk");
  const Z = {}, SPL = {};
  for (const z of ZONES) { Z[z] = el("div", "dk-zone dk-" + z, { "data-zone": z, role: "region", "aria-label": z[0].toUpperCase() + z.slice(1) + " panels" }); SPL[z] = el("div", "dk-zsplit dk-zs-" + z, { "data-zsplit": z, role: "separator", "aria-label": "Resize " + z + " panels", tabindex: "0", "aria-orientation": z === "bottom" ? "horizontal" : "vertical" }); }
  center.classList.add("dk-center");
  if (overlay) root.classList.add("dk-overlay");
  const FL = el("div", "dk-floats"), PARK = el("div", "dk-park", { hidden: true, "aria-hidden": "true" }), DROP = el("div", "dk-drop", { hidden: true }), GHOST = el("div", "dk-ghost", { hidden: true });
  root.append(center, Z.left, Z.right, Z.bottom, SPL.left, SPL.right, SPL.bottom, FL, DROP, GHOST, PARK);

  for (const p of panels) { const n = el("div", "dk-p", { "data-panel": p.id, id: "panel-" + p.id, role: "tabpanel" }); p.mount(n); PEL.set(p.id, n); PARK.append(n); }

  // ---------- render ----------
  // Reconciles instead of rebuilding: group sections are cached per group object and panel elements only move
  // when their place really changes, so a panel keeps its scroll position and focus while others open,
  // close or switch tabs.
  const SEC = new WeakMap(), SPLC = new Map();
  let shown = new Set(), narrowG = null;
  function place(box, nodes) {
    for (const c of [...box.children]) if (!nodes.includes(c)) c.remove();
    nodes.forEach((n, i) => { if (box.children[i] !== n) box.insertBefore(n, box.children[i] || null); });
  }
  function render() {
    narrow = root.clientWidth < NARROW;
    const view = narrow ? narrowView() : S;
    const keep = new Set();
    for (const z of ZONES) {
      const nodes = [];
      view.zones[z].groups.forEach((g, i) => { if (i) nodes.push(splitter(z, i)); nodes.push(groupEl(g, z, i, keep)); });
      place(Z[z], nodes);
    }
    place(FL, view.floats.map((g, i) => groupEl(g, "float", i, keep)));
    for (const [id, n] of PEL) if (!keep.has(id) && n.parentNode !== PARK) PARK.append(n);
    layout();
    // lifecycle: tell panels when they become visible or hidden
    const now = new Set(allViewGroups(view).filter(({ g }) => !g.min).map(({ g }) => g.active));
    for (const id of shown) if (!now.has(id)) P.get(id).onHide?.();
    for (const id of now) if (!shown.has(id)) P.get(id).onShow?.();
    shown = now;
    listeners.forEach((f) => f());
  }
  const allViewGroups = (v) => [...ZONES.flatMap((z) => v.zones[z].groups.map((g) => ({ g, z }))), ...v.floats.map((g) => ({ g, z: "float" }))];
  function narrowView() { // one bottom sheet, every open panel as a tab, nothing floating
    const v = blank(); const tabs = allGroups().flatMap(({ g }) => g.tabs);
    const act = S._narrowActive && tabs.includes(S._narrowActive) ? S._narrowActive : tabs[0];
    narrowG ||= { size: 1, _narrow: true };
    Object.assign(narrowG, { tabs, active: act, min: !!S._narrowMin });
    if (tabs.length) v.zones.bottom.groups.push(narrowG);
    v.zones.bottom.size = S._narrowSize || Math.round(root.clientHeight * 0.46);
    return v;
  }

  function groupEl(g, z, i, keep) {
    const floating = z === "float";
    let sec = SEC.get(g);
    if (!sec || sec._floating !== floating) {
      sec = el("section"); sec._floating = floating;
      const head = el("header", "dk-h"), tl = el("div", "dk-tabs", { role: "tablist" });
      const mb = el("button", "dk-mb", { type: "button", "aria-haspopup": "menu", "aria-label": "Options for this panel group", title: "Panel options" }); mb.textContent = "⋯";
      head.append(tl, el("div", "dk-grab", { "aria-hidden": "true" }), mb);
      sec.append(head, el("div", "dk-b"));
      if (floating) for (const d of ["n", "e", "s", "w", "ne", "nw", "se", "sw"]) sec.append(el("div", "dk-rs dk-rs-" + d, { "data-rs": d, "aria-hidden": "true" }));
      SEC.set(g, sec);
    }
    sec._g = g; sec._z = z; sec._i = i;
    sec.className = "dk-g" + (floating ? " dk-f" : "") + (g.min ? " dk-min" : "");
    sec.setAttribute("aria-label", g.tabs.map((id) => P.get(id).title).join(", ") + " panels");
    sec.querySelector(".dk-grab").title = floating ? "Drag to move, or onto a dock to dock this window" : "Drag to move this group";
    const tl = sec.querySelector(".dk-tabs"); tl.textContent = "";
    g.tabs.forEach((id) => {
      const p = P.get(id), on = id === g.active;
      const w = el("div", "dk-tw" + (on ? " on" : ""));
      const b = el("button", "dk-tab", { type: "button", role: "tab", "aria-selected": on ? "true" : "false", tabindex: on ? "0" : "-1", "aria-controls": "panel-" + id, "data-pid": id, title: g._narrow ? p.title : p.title + " · drag to move" });
      b.textContent = p.title; if (BADGE.get(id)) { const c = el("b", "cnt"); c.textContent = BADGE.get(id); b.append(c); }
      const x = el("button", "dk-x", { type: "button", tabindex: "-1", "aria-label": "Close " + p.title, "data-close": id }); x.textContent = "×";
      w.append(b, x); tl.append(w);
    });
    const body = sec.querySelector(".dk-b"), want = !g.min && g.active ? PEL.get(g.active) : null;
    if (want) { keep.add(g.active); if (body.firstChild !== want) { if (body.firstChild) PARK.append(body.firstChild); body.append(want); } }
    else if (body.firstChild) PARK.append(body.firstChild);
    if (floating) Object.assign(sec.style, { left: g.x + "px", top: g.y + "px", width: g.w + "px", height: g.min ? "auto" : g.h + "px", flex: "" });
    else Object.assign(sec.style, { left: "", top: "", width: "", height: "", flex: g.min ? "0 0 auto" : `${g.size} 1 0px` });
    return sec;
  }
  function splitter(z, i) {
    const k = z + i; if (SPLC.has(k)) return SPLC.get(k);
    const n = el("div", "dk-gsplit", { "data-gsplit": i, "data-zone": z, role: "separator", tabindex: "0", "aria-label": "Resize panel groups", "aria-orientation": z === "bottom" ? "vertical" : "horizontal" });
    SPLC.set(k, n); return n;
  }

  function sizes() {
    const W = root.clientWidth, H = root.clientHeight, v = narrow ? narrowView() : S;
    const open = (z) => v.zones[z].groups.length && !v.zones[z].hide;
    const L = open("left") ? clamp(v.zones.left.size, MINZ.left, W * 0.45) : 0;
    const R = open("right") ? clamp(v.zones.right.size, MINZ.right, W * 0.45) : 0;
    const bMin = v.zones.bottom.groups.every((g) => g.min) ? 34 : MINZ.bottom;
    const B = open("bottom") ? (v.zones.bottom.groups.every((g) => g.min) ? 34 : clamp(v.zones.bottom.size, bMin, H * (narrow ? 0.8 : 0.6))) : 0;
    return { W, H, L, R, B };
  }
  function layout() {
    const { W, H, L, R, B } = sizes();
    const put = (n, x, y, w, h) => Object.assign(n.style, { left: x + "px", top: y + "px", width: Math.max(0, w) + "px", height: Math.max(0, h) + "px" });
    put(Z.left, 0, 0, L, H); put(Z.right, W - R, 0, R, H); put(Z.bottom, L, H - B, W - L - R, B);
    put(center, ...(overlay ? [0, 0, W, H] : [L, 0, W - L - R, H - B]));
    put(SPL.left, L - 3, 0, 6, H); put(SPL.right, W - R - 3, 0, 6, H); put(SPL.bottom, L, H - B - 3, W - L - R, 6);
    SPL.left.hidden = !L; SPL.right.hidden = !R; SPL.bottom.hidden = !B || (narrow ? false : false);
    for (const z of ZONES) Z[z].hidden = !(z === "left" ? L : z === "right" ? R : B);
    // keep floating windows reachable
    for (const sec of FL.children) { const g = sec._g; g.x = clamp(g.x, -g.w + 80, W - 80); g.y = clamp(g.y, 0, H - 30); sec.style.left = g.x + "px"; sec.style.top = g.y + "px"; }
    onLayout();
  }
  new ResizeObserver(() => { const was = narrow; narrow = root.clientWidth < NARROW; if (was !== narrow) render(); else layout(); }).observe(root);

  // ---------- public actions ----------
  function activate(id, { focus = false } = {}) {
    const f = findPanel(id); if (!f) return;
    f.g.active = id; f.g.min = false;
    if (f.z !== "float") S.zones[f.z].hide = false;
    if (narrow) { S._narrowActive = id; S._narrowMin = false; }
    save(); render();
    if (focus) root.querySelector(`.dk-tab[data-pid="${id}"]`)?.focus();
  }
  function open(id, opts = {}) {
    if (!P.has(id)) return;
    if (isOpen(id)) return activate(id, opts);
    const p = P.get(id), z = opts.zone || p.zone || "right";
    if (z === "float") { const { W, H } = sizes(); const w = p.float?.w || 380, h = p.float?.h || 300; S.floats.push(grp([id], { x: Math.round((W - w) / 2), y: Math.round((H - h) / 3), w, h })); }
    else { const zs = S.zones[z]; zs.hide = false; if (zs.groups.length) { const g = zs.groups[p.withGroup ?? 0] || zs.groups[0]; g.tabs.push(id); } else zs.groups.push(grp([id])); }
    activate(id, opts);
  }
  function close(id) { detach([id]); save(); render(); }
  function toggle(id) { isOpen(id) ? close(id) : open(id); }
  function moveGroup(g, from, to) { // to: "left" | "right" | "bottom" | "float"
    const ids = [...g.tabs], act = g.active; detach(ids);
    if (to === "float") { const { W, H } = sizes(); const p = P.get(act), w = p.float?.w || 380, h = p.float?.h || 300; S.floats.push(grp(ids, { active: act, x: Math.round(W / 2 - w / 2), y: Math.round(H / 4), w, h })); }
    else { S.zones[to].hide = false; S.zones[to].groups.push(grp(ids, { active: act })); }
    save(); render();
  }
  function applyPreset(name) { const a = S._narrowActive, sz = S._narrowSize; S = sanitize(fromPreset(name)); S._narrowActive = a; S._narrowSize = sz; save(); render(); }
  function toggleZone(z) { S.zones[z].hide = !S.zones[z].hide; save(); render(); return !S.zones[z].hide; }

  // ---------- pointer: tabs, title bars, splitters, resize handles ----------
  root.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const t = e.target;
    if (t.closest(".dk-x, .dk-mb")) return;
    if (t.closest("[data-zsplit], [data-gsplit], [data-rs], .dk-h")) document.body.classList.add("dk-busy");
    const zs = t.closest("[data-zsplit]"); if (zs) return startZoneSplit(e, zs.dataset.zsplit);
    const gs = t.closest("[data-gsplit]"); if (gs) return startGroupSplit(e, gs);
    const rs = t.closest("[data-rs]"); if (rs) return startResize(e, rs.closest(".dk-g"), rs.dataset.rs);
    const tab = t.closest(".dk-tab"); const head = t.closest(".dk-h");
    if (tab || head) {
      const sec = t.closest(".dk-g"); const g = sec._g, z = sec._z;
      const whole = !tab || (z === "float" && g.tabs.length === 1) || g._narrow;
      // the narrow bottom sheet only switches tabs; it does not rearrange
      drag = { kind: "pending", x0: e.clientX, y0: e.clientY, sec, g, z, ids: whole ? [...g.tabs] : [tab.dataset.pid], act: whole ? g.active : tab.dataset.pid, whole, id: e.pointerId, noDrag: !!g._narrow };
    }
  });
  window.addEventListener("pointermove", (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    if (drag.kind === "pending") {
      if (drag.noDrag || Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < DRAG_START) return;
      beginDrag(e);
    }
    if (drag.kind === "move") moveWindow(e);
    else if (drag.kind === "tab") dragTab(e);
    else drag.move?.(e);
  });
  window.addEventListener("pointerup", (e) => { document.body.classList.remove("dk-busy"); if (!drag || drag.id !== e.pointerId) return; const d = drag; drag = null; finishDrag(d, e); });
  window.addEventListener("pointercancel", () => cancelDrag());
  window.addEventListener("keydown", (e) => { if (e.key === "Escape" && drag && drag.kind !== "pending") cancelDrag(); });
  window.addEventListener("blur", () => cancelDrag());

  function beginDrag(e) {
    document.body.classList.add("dk-dragging");
    const r = root.getBoundingClientRect();
    if (drag.z === "float" && drag.whole) { // move the floating window itself
      const sr = drag.sec.getBoundingClientRect();
      drag.kind = "move"; drag.dx = e.clientX - sr.left; drag.dy = e.clientY - sr.top; drag.r = r;
      drag.sec.classList.add("dk-moving");
    } else {
      drag.kind = "tab"; drag.r = r;
      GHOST.textContent = drag.ids.map((id) => P.get(id).title).join(" · ");
      GHOST.hidden = false;
    }
  }
  function cancelDrag() {
    document.body.classList.remove("dk-busy");
    if (!drag) return; const d = drag; drag = null;
    document.body.classList.remove("dk-dragging"); DROP.hidden = true; GHOST.hidden = true;
    if (d.kind === "move") { d.sec.classList.remove("dk-moving"); render(); }
    d.end?.(true);
  }

  // Which dock target is under the pointer? Used by tab drags and window moves.
  function hitTarget(x, y, self) {
    const r = drag.r, lx = x - r.left, ly = y - r.top;
    for (const z of ZONES) { // empty edges first
      if (S.zones[z].groups.length && !S.zones[z].hide) continue;
      const { W, H, L, R } = sizes();
      if (z === "left" && lx < EDGE) return { type: "zone", zone: z, rect: [0, 0, DEFZ.left * 0.6, H] };
      if (z === "right" && lx > W - EDGE) return { type: "zone", zone: z, rect: [W - DEFZ.right * 0.6, 0, DEFZ.right * 0.6, H] };
      if (z === "bottom" && ly > H - EDGE && lx > L && lx < W - R) return { type: "zone", zone: z, rect: [L, H - DEFZ.bottom * 0.7, W - L - R, DEFZ.bottom * 0.7] };
    }
    const secs = [...FL.children].reverse().concat(ZONES.flatMap((z) => [...Z[z].querySelectorAll(":scope > .dk-g")]));
    for (const sec of secs) {
      if (sec === self) continue;
      const b = sec.getBoundingClientRect(); if (!inR(b, x, y)) continue;
      const hb = sec.querySelector(".dk-h").getBoundingClientRect(), rel = (v, a, s) => (v - a) / s;
      const R0 = [b.left - r.left, b.top - r.top, b.width, b.height];
      if (inR(hb, x, y) || sec._z === "float" || sec._g.min) return { type: "tabs", sec, rect: [hb.left - r.left, hb.top - r.top, hb.width, hb.height] };
      if (sec._z === "bottom") {
        const f = rel(x, b.left, b.width);
        if (f < 0.25) return { type: "split", sec, where: 0, rect: [R0[0], R0[1], R0[2] / 2, R0[3]] };
        if (f > 0.75) return { type: "split", sec, where: 1, rect: [R0[0] + R0[2] / 2, R0[1], R0[2] / 2, R0[3]] };
      } else {
        const f = rel(y, b.top, b.height);
        if (f < 0.3) return { type: "split", sec, where: 0, rect: [R0[0], R0[1], R0[2], R0[3] / 2] };
        if (f > 0.7) return { type: "split", sec, where: 1, rect: [R0[0], R0[1] + R0[3] / 2, R0[2], R0[3] / 2] };
      }
      return { type: "tabs", sec, rect: [hb.left - r.left, hb.top - r.top, hb.width, b.height] };
    }
    return null;
  }
  function showDrop(t) {
    if (!t) { DROP.hidden = true; return; }
    const [x, y, w, h] = t.rect; Object.assign(DROP.style, { left: x + "px", top: y + "px", width: w + "px", height: h + "px" });
    DROP.dataset.type = t.type; DROP.hidden = false;
  }
  function dragTab(e) {
    Object.assign(GHOST.style, { left: e.clientX - drag.r.left + 12 + "px", top: e.clientY - drag.r.top + 10 + "px" });
    let t = hitTarget(e.clientX, e.clientY, drag.whole ? drag.sec : null);
    if (t && t.sec === drag.sec && t.type === "tabs" && drag.g.tabs.length === drag.ids.length) t = null; // dropping a whole group on itself
    if (!t) { const p = P.get(drag.act); t = { type: "float", rect: [e.clientX - drag.r.left - 20, e.clientY - drag.r.top - 12, p.float?.w || 380, p.float?.h || 300] }; }
    drag.t = t; showDrop(t);
  }
  function moveWindow(e) {
    const g = drag.g; g.x = snapG(e.clientX - drag.r.left - drag.dx); g.y = snapG(clamp(e.clientY - drag.r.top - drag.dy, 0, drag.r.height - 30));
    drag.sec.style.left = g.x + "px"; drag.sec.style.top = g.y + "px";
    drag.t = hitTarget(e.clientX, e.clientY, drag.sec); showDrop(drag.t);
  }
  function finishDrag(d, e) {
    document.body.classList.remove("dk-dragging"); DROP.hidden = true; GHOST.hidden = true;
    if (d.kind === "pending") { // a click: select the tab, or nothing
      const tab = e.target.closest?.(".dk-tab");
      if (tab) { const g = d.g; if (g._narrow) { S._narrowActive = tab.dataset.pid; S._narrowMin = false; } else { g.active = tab.dataset.pid; g.min = false; } save(); render(); root.querySelector(`.dk-tab[data-pid="${tab.dataset.pid}"]`)?.focus(); }
      return;
    }
    if (d.kind === "move") { d.sec.classList.remove("dk-moving"); if (d.t) dropOn(d, d.t, e); else { save(); } return; }
    if (d.kind === "tab") return dropOn(d, d.t, e);
    d.end?.(false);
  }
  function dropOn(d, t, e) {
    const ids = d.ids, act = d.act;
    // resolve the target group object before detaching (detach can shift indices)
    const tg = t.sec?._g, tz = t.sec?._z;
    if (tg === d.g && (t.type === "tabs" || d.g.tabs.every((id) => ids.includes(id)))) { render(); return; } // dropped on itself
    detach(ids);
    if (t.type === "tabs") { tg.tabs.push(...ids); tg.active = act; tg.min = false; }
    else if (t.type === "split") {
      const list = S.zones[tz].groups, i = list.indexOf(tg), half = tg.size / 2; tg.size = half;
      list.splice(i + t.where, 0, grp(ids, { active: act, size: half }));
    } else if (t.type === "zone") { S.zones[t.zone].hide = false; S.zones[t.zone].size ||= DEFZ[t.zone]; S.zones[t.zone].groups.push(grp(ids, { active: act })); }
    else if (t.type === "float") { const [x, y, w, h] = t.rect; S.floats.push(grp(ids, { active: act, x, y, w, h })); }
    save(); render();
  }

  // splitter between the map and a zone
  function startZoneSplit(e, z) {
    e.preventDefault();
    const s0 = sizes(), v = narrow ? null : S.zones[z];
    const startSize = z === "left" ? s0.L : z === "right" ? s0.R : s0.B, x0 = e.clientX, y0 = e.clientY;
    drag = { kind: "split", id: e.pointerId, move(ev) {
      const d = z === "left" ? ev.clientX - x0 : z === "right" ? x0 - ev.clientX : y0 - ev.clientY;
      if (narrow) S._narrowSize = Math.max(34, startSize + d); else v.size = Math.max(MINZ[z], startSize + d);
      layout();
    }, end() { save(); } };
    document.body.classList.add("dk-resizing-" + (z === "bottom" ? "row" : "col"));
    const up = () => { document.body.classList.remove("dk-resizing-row", "dk-resizing-col"); window.removeEventListener("pointerup", up); save(); };
    window.addEventListener("pointerup", up);
  }
  // splitter between two groups in a zone
  function startGroupSplit(e, sp) {
    e.preventDefault();
    const z = sp.dataset.zone, i = +sp.dataset.gsplit, secs = [...Z[z].querySelectorAll(":scope > .dk-g")];
    const horiz = z === "bottom", len = (n) => { const b = n.getBoundingClientRect(); return horiz ? b.width : b.height; };
    secs.forEach((s) => { if (!s._g.min) s._g.size = len(s); });
    const a = secs[i - 1]._g, b = secs[i]._g; if (a.min || b.min) return;
    const tot = a.size + b.size, a0 = a.size, p0 = horiz ? e.clientX : e.clientY;
    drag = { kind: "split", id: e.pointerId, move(ev) {
      a.size = clamp(a0 + (horiz ? ev.clientX : ev.clientY) - p0, GMIN, tot - GMIN); b.size = tot - a.size;
      secs[i - 1].style.flex = `${a.size} 1 0px`; secs[i].style.flex = `${b.size} 1 0px`;
    }, end() { save(); } };
    const up = () => { window.removeEventListener("pointerup", up); save(); };
    window.addEventListener("pointerup", up);
  }
  // resize a floating window
  function startResize(e, sec, d) {
    e.preventDefault(); const g = sec._g, x0 = e.clientX, y0 = e.clientY, s = { x: g.x, y: g.y, w: g.w, h: g.h };
    drag = { kind: "split", id: e.pointerId, move(ev) {
      const dx = ev.clientX - x0, dy = ev.clientY - y0;
      if (d.includes("e")) g.w = Math.max(240, s.w + dx);
      if (d.includes("w")) { g.w = Math.max(240, s.w - dx); g.x = s.x + (s.w - g.w); }
      if (d.includes("s")) g.h = Math.max(140, s.h + dy);
      if (d.includes("n")) { g.h = Math.max(140, s.h - dy); g.y = Math.max(0, s.y + (s.h - g.h)); }
      // every edge lands on the same 12px grid the windows move on, so two windows
      // resized by eye still line up exactly
      g.x = snapG(g.x); g.y = snapG(g.y); g.w = snapG(g.w); g.h = snapG(g.h);
      Object.assign(sec.style, { left: g.x + "px", top: g.y + "px", width: g.w + "px", height: g.h + "px" });
    }, end() { save(); } };
    const up = () => { window.removeEventListener("pointerup", up); save(); };
    window.addEventListener("pointerup", up);
  }

  // ---------- clicks and keys ----------
  root.addEventListener("click", (e) => {
    const x = e.target.closest("[data-close]"); if (x) { close(x.dataset.close); return; }
    const mb = e.target.closest(".dk-mb"); if (mb) { openGroupMenu(mb, mb.closest(".dk-g")); return; }
  });
  root.addEventListener("dblclick", (e) => { // double-click a tab bar to collapse or expand the group, like Adobe
    const head = e.target.closest(".dk-h"); if (!head || e.target.closest(".dk-mb, .dk-x")) return;
    const g = head.closest(".dk-g")._g; if (g._narrow) S._narrowMin = !S._narrowMin; else g.min = !g.min; save(); render();
  });
  root.addEventListener("keydown", (e) => {
    const tab = e.target.closest?.(".dk-tab");
    if (tab) {
      const sec = tab.closest(".dk-g"), g = sec._g, ids = g.tabs, k = ids.indexOf(tab.dataset.pid);
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); const n = ids[(k + (e.key === "ArrowRight" ? 1 : ids.length - 1)) % ids.length]; if (g._narrow) S._narrowActive = n; else g.active = n; render(); root.querySelector(`.dk-tab[data-pid="${n}"]`)?.focus(); }
      else if (e.key === "Delete") { e.preventDefault(); close(tab.dataset.pid); }
      else if ((e.key === "F10" && e.shiftKey) || e.key === "ContextMenu") { e.preventDefault(); openGroupMenu(sec.querySelector(".dk-mb"), sec); }
      return;
    }
    const sp = e.target.closest?.("[data-zsplit]");
    if (sp && /Arrow/.test(e.key)) {
      e.preventDefault(); const z = sp.dataset.zsplit, step = e.shiftKey ? 60 : 16, v = S.zones[z];
      const grow = { left: "ArrowRight", right: "ArrowLeft", bottom: "ArrowUp" }[z], shrink = { left: "ArrowLeft", right: "ArrowRight", bottom: "ArrowDown" }[z];
      if (e.key === grow) v.size = sizes()[z === "left" ? "L" : z === "right" ? "R" : "B"] + step; else if (e.key === shrink) v.size = Math.max(MINZ[z], sizes()[z === "left" ? "L" : z === "right" ? "R" : "B"] - step);
      layout(); save();
    }
  });

  // ---------- menus (group ⋯ menu and the Panels menu in the top bar) ----------
  function popMenu(anchor, items) {
    closeMenu();
    const m = el("div", "dk-menu", { role: "menu" });
    for (const it of items) {
      if (it === "-") { m.append(el("div", "dk-sep", { role: "separator" })); continue; }
      if (it.label) { const h = el("div", "dk-mlabel"); h.textContent = it.label; m.append(h); continue; }
      const b = el("button", "dk-mi", { type: "button", role: it.check != null ? "menuitemcheckbox" : "menuitem", ...(it.check != null ? { "aria-checked": it.check ? "true" : "false" } : {}) });
      b.innerHTML = `<span class="dk-ck" aria-hidden="true">${it.check ? "✓" : ""}</span><span></span>`; b.lastChild.textContent = it.text;
      if (it.hint) { const s = el("small"); s.textContent = it.hint; b.append(s); }
      b.onclick = () => { closeMenu(); it.run(); };
      m.append(b);
    }
    document.body.append(m);
    const a = anchor.getBoundingClientRect(), mw = m.offsetWidth, mh = m.offsetHeight;
    m.style.left = clamp(a.right - mw, 8, innerWidth - mw - 8) + "px";
    m.style.top = (a.bottom + mh + 8 > innerHeight ? Math.max(8, a.top - mh - 6) : a.bottom + 6) + "px";
    const btns = [...m.querySelectorAll("button")]; btns[0]?.focus();
    m.addEventListener("keydown", (e) => {
      const k = btns.indexOf(document.activeElement);
      if (e.key === "ArrowDown") { e.preventDefault(); btns[(k + 1) % btns.length].focus(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); btns[(k - 1 + btns.length) % btns.length].focus(); }
      else if (e.key === "Escape" || e.key === "Tab") { e.preventDefault(); closeMenu(); anchor.focus(); }
    });
    anchor.setAttribute("aria-expanded", "true");
    menu = { m, anchor };
    setTimeout(() => document.addEventListener("pointerdown", outside, true));
  }
  const outside = (e) => { if (menu && !menu.m.contains(e.target) && e.target !== menu.anchor) closeMenu(); };
  function closeMenu() { if (!menu) return; menu.m.remove(); menu.anchor.setAttribute("aria-expanded", "false"); document.removeEventListener("pointerdown", outside, true); menu = null; }
  function openGroupMenu(anchor, sec) {
    const g = sec._g, z = sec._z, act = P.get(g.active);
    const where = { left: "Dock left", right: "Dock right", bottom: "Dock at bottom" };
    const items = [{ label: g.tabs.map((id) => P.get(id).title).join(", ") }];
    if (!g._narrow) {
      if (z !== "float") items.push({ text: "Float as a window", run: () => moveGroup(g, z, "float") });
      for (const t of ZONES) if (t !== z) items.push({ text: where[t], run: () => moveGroup(g, z, t) });
      if (g.tabs.length > 1) items.push({ text: `Move “${act.title}” to its own window`, run: () => { detach([act.id]); S.floats.push(grp([act.id], { x: 80, y: 60, w: act.float?.w || 380, h: act.float?.h || 300 })); save(); render(); } });
      items.push("-");
    }
    items.push({ text: g.min || (g._narrow && S._narrowMin) ? "Expand" : "Collapse", hint: "or double-click the tabs", run: () => { if (g._narrow) S._narrowMin = !S._narrowMin; else g.min = !g.min; save(); render(); } });
    items.push({ text: `Close “${act.title}”`, run: () => close(act.id) });
    if (g.tabs.length > 1) items.push({ text: "Close all in this group", run: () => { detach([...g.tabs]); save(); render(); } });
    popMenu(anchor, items);
  }
  function mountMenu(btn) {
    btn.setAttribute("aria-haspopup", "menu"); btn.setAttribute("aria-expanded", "false");
    btn.addEventListener("click", () => {
      if (menu?.anchor === btn) return closeMenu();
      const items = [{ label: "Panels" }, ...panels.map((p) => ({ text: p.title, check: isOpen(p.id), run: () => toggle(p.id) }))];
      const names = Object.entries(presets).filter(([, v]) => v.title);
      if (names.length) { items.push("-", { label: "Workspaces" }); names.forEach(([k, v]) => items.push({ text: v.title, hint: v.hint, run: () => applyPreset(k) })); }
      items.push("-", { text: "Reset workspace", run: () => applyPreset(initial) });
      popMenu(btn, items);
    });
  }

  function badge(id, v) {
    const t = v ? String(v) : ""; if ((BADGE.get(id) || "") === t) return; BADGE.set(id, t);
    root.querySelectorAll(`.dk-tab[data-pid="${id}"]`).forEach((b) => { b.querySelector(".cnt")?.remove(); if (t) { const c = el("b", "cnt"); c.textContent = t; b.append(c); } });
  }

  render();
  return { open, badge, close, toggle, activate, isOpen, applyPreset, toggleZone, mountMenu, render, el: (id) => PEL.get(id), on: (f) => listeners.add(f), get narrow() { return narrow; } };
}
