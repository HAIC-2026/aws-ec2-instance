/* AllReady — one navigation for every page. MIT licensed.

   The order follows the DHS framework a planner works through: see what is happening (Live
   map), rehearse an event for any county (Event planner), read the statewide picture
   (Insights), line up who does what (Coordination), and check the data behind it (Data health). */

import { mountThemeToggle } from "./theme.js";
import { mountLanguage } from "./lang.js";

export const PAGES = [
  { href: "home.html", n: "Home", k: "home" },
  { href: "index.html", n: "Live map", k: "map" },
  { href: "scenarios.html", n: "Event planner", k: "scenarios" },
  { href: "insights.html", n: "Insights", k: "insights" },
  { href: "roles.html", n: "Coordination", k: "roles" },
  { href: "method.html", n: "Data health", k: "method" },
];

const el = (t, a = {}, ...kids) => {
  const n = document.createElement(t);
  for (const [k, v] of Object.entries(a)) if (v != null) n.setAttribute(k, v);
  n.append(...kids.filter((k) => k != null));
  return n;
};

/** Links only, for pages that keep their own header (map, Insights). */
export function navLinks(current, cls = "lnk") {
  return PAGES.filter((p) => p.k !== "home").map((p) => el("a", { class: cls, href: p.href, "aria-current": p.k === current ? "page" : null }, p.n));
}

/** The full top bar for the planning pages. `host` is replaced. */
export function mountTopBar(host, current, sub = "") {
  const theme = el("div"), lang = el("div"), clock = el("div", { class: "s-clock" }, el("span", {}, "--:--:-- HST"), el("br"), el("span", {}, "Public, de-identified data"));
  const bar = el("header", { class: "s-top" },
    el("div", { class: "s-top-in" },
      el("a", { class: "s-mark", href: "home.html", "aria-label": "AllReady home" }, el("b", {}, "All", el("span", {}, "Ready")), sub ? el("small", {}, sub) : null),
      el("nav", { class: "s-nav", "aria-label": "Pages" }, ...PAGES.map((p) => el("a", { href: p.href, "aria-current": p.k === current ? "page" : null }, p.n))),
      el("div", { class: "s-tools" }, lang, theme, clock)));
  host.replaceWith(bar);
  mountThemeToggle(theme);
  mountLanguage(lang);
  const t = clock.firstChild;
  const tick = () => (t.textContent = new Date().toLocaleTimeString("en-US", { timeZone: "Pacific/Honolulu", hour12: false }) + " HST");
  tick(); setInterval(tick, 1000);
  return bar;
}
