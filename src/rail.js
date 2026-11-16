/* AllReady — left icon rail. MIT licensed. No dependencies.

   Replaces the stack of accordions that used to pile up down the left edge. One strip of
   icons, one active pane. Everything is still a dock panel underneath, so panels can still
   be torn off, tabbed and floated — the rail is just a faster way to reach them.

   Accessibility: every button is a real toggle with aria-pressed and a visible text label
   on hover and focus, because an icon-only rail is unusable otherwise. */

const NS = "http://www.w3.org/2000/svg";

const ICONS = {
  layers: "M12 3 3 8l9 5 9-5-9-5ZM3 12l9 5 9-5M3 16l9 5 9-5",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3.5 2",
  people: "M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 20v-2a4 4 0 0 0-3-3.9M16 2.1a4 4 0 0 1 0 7.8",
  box: "M21 8 12 3 3 8m18 0v8l-9 5-9-5V8m18 0-9 5m0 0L3 8m9 5v8",
  shelter: "M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5M10 20v-5.5h4V20",
  alert: "M10.3 3.9 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0ZM12 9v4M12 17h.01",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM12 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
  pin: "M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  list: "M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01",
  tv: "M3 4.5h18v12H3zM8 21h8M12 16.5V21",
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.800ZM19 15l.8 2.200L22 18l-2.2.800L19 21l-.8-2.200L16 18l2.200-.800Z".replace(/(\.\d)00/g, "$1"),
  link: "M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1",
  pen: "M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1ZM14 7l3 3",
};

function icon(d) {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("width", "19"); svg.setAttribute("height", "19");
  svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor"); svg.setAttribute("stroke-width", "1.6");
  svg.setAttribute("stroke-linecap", "round"); svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  const p = document.createElementNS(NS, "path");
  p.setAttribute("d", d);
  svg.append(p);
  return svg;
}

/**
 * items: [{ id, title, icon, group }] — id must match a dock panel id.
 * A `null` entry inserts the flexible spacer that pushes the rest to the bottom.
 */
export function createRail(host, { items, dock }) {
  host.className = "rail";
  host.setAttribute("role", "toolbar");
  host.setAttribute("aria-label", "Workspace panels");
  host.setAttribute("aria-orientation", "vertical");

  const btns = new Map();

  /** Open AND on screen — a background tab is mounted but has no layout box. */
  const showing = (id) => {
    const n = dock.el(id);
    return !!n && !!n.offsetParent;
  };

  for (const it of items) {
    if (!it) { const s = document.createElement("div"); s.className = "rail-sp"; host.append(s); continue; }
    const b = document.createElement("button");
    b.type = "button";
    b.className = "rail-b";
    b.dataset.id = it.id;
    b.setAttribute("aria-pressed", "false");
    b.setAttribute("aria-label", it.title);
    b.append(icon(ICONS[it.icon] || ICONS.layers));
    const lbl = document.createElement("span");
    lbl.className = "rail-lbl";
    lbl.textContent = it.title;
    b.append(lbl);
    b.addEventListener("click", () => {
      // Three states, not two. A panel that is open but sitting behind another tab in its
      // group should come forward on click — closing it would be the opposite of what the
      // click meant. Only the pane you can actually see closes.
      if (!dock.isOpen(it.id)) dock.open(it.id);
      else if (showing(it.id)) dock.close(it.id);
      else dock.activate(it.id);
      sync();
    });
    host.append(b);
    btns.set(it.id, b);
  }

  /** Roving focus, so the rail behaves like a toolbar rather than ten separate tab stops. */
  host.addEventListener("keydown", (e) => {
    const list = [...btns.values()];
    const i = list.indexOf(document.activeElement);
    if (i < 0) return;
    const next = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (next) { e.preventDefault(); list[(i + next + list.length) % list.length].focus(); }
    else if (e.key === "Home") { e.preventDefault(); list[0].focus(); }
    else if (e.key === "End") { e.preventDefault(); list[list.length - 1].focus(); }
  });
  btns.forEach((b, id, m) => b.setAttribute("tabindex", [...m.keys()][0] === id ? "0" : "-1"));
  host.addEventListener("focusin", (e) => {
    btns.forEach((b) => b.setAttribute("tabindex", b === e.target ? "0" : "-1"));
  });

  /** Lit = the pane you are looking at. Dim-but-open panels stay unlit so the rail reads
      as "where am I", which is the question an icon rail is there to answer. */
  function sync() {
    btns.forEach((b, id) => {
      const on = showing(id);
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.classList.toggle("is-open", !on && dock.isOpen(id));
    });
  }

  function badge(id, v, alarm = false) {
    const b = btns.get(id);
    if (!b) return;
    let i = b.querySelector("i");
    if (!v && v !== 0) { i?.remove(); return; }
    if (!i) { i = document.createElement("i"); b.append(i); }
    i.textContent = String(v);
    b.dataset.alarm = alarm ? "1" : "0";
  }

  dock.on(sync);
  sync();
  return { sync, badge };
}
