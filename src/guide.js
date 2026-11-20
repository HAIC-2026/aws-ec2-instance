/* AllReady — how to read each page, for someone opening it for the first time. MIT licensed.

   Two pieces, the same on every page:
   - a guide strip: what this page is for and how to use it, in three or four steps. It stays
     until the reader hides it (remembered per page) and comes back from the "?" button;
   - a help window: the same steps, how the pages fit together, and a glossary of every term
     a DHS worker new to emergency-management software will meet (AFN, CMIST, SVI, emPOWER…).
   All text is written with textContent; nothing here is ever parsed as HTML. */

import "./guide.css";

export const FLOW = [
  { k: "map", href: "index.html", n: "Live map", role: "See what is happening now",
    does: "What is happening now, and where: National Weather Service alerts in force, where residents with access and functional needs live, shelters on record, and hazard zones.",
    steps: ["Turn layers on or off in the Layers panel. AFN need (census tracts) and Shelters are on to start.",
      "Click anything on the map. The Inspector explains it: a census tract, a shelter, a flood or tsunami zone.",
      "Nothing in force? Press Rehearse in the Event clock, or open the Event planner, to run a what-if.",
      "Ask the Assistant. It answers only from what is on the screen."],
    not: "AllReady issues no warnings. Official alerts come only from the NWS and the counties." },
  { k: "scenarios", href: "scenarios.html", n: "Event planner", role: "Rehearse an event",
    does: "Rehearse one hazard in one county before it happens: who lives in the hazard zone, what they will need, what the records cover, and who to call for the rest.",
    steps: ["Choose a county and a hazard in the bar below the title, or click any cell in Statewide comparison.",
      "Read Key figures, then Resources and gaps. “Confirm” means no figure is published; the next column says who to ask.",
      "Check the 7-day warning outlook on the right to see which hazard is most likely this week.",
      "Print brief or Export CSV to share it; Open on live map to see the same event on the map."],
    not: "A what-if rehearsal, not a forecast or an alert." },
  { k: "roles", href: "roles.html", n: "Coordination", role: "Line up who acts",
    does: "Who meets each need: partner commitments set against the need, roles by function (county leads, State supports), and how a warning reaches residents.",
    steps: ["Pick a county and hazard under Commitments against need to see what is already covered.",
      "After a call with a partner, record what they committed. Organisations only: the form refuses personal details.",
      "The Event planner counts these commitments against its gaps automatically.",
      "Export CSV to share with the county, or import a partner's CSV."],
    not: "Commitments stay in this browser until exported. Nothing is sent anywhere." },
  { k: "insights", href: "insights.html", n: "Insights", role: "Brief leadership",
    does: "The statewide picture on one screen: key figures, how much each county publishes, the biggest gaps, and a written summary for a briefing.",
    steps: ["Choose the event (live, or a what-if) and the area in the bar at the top.",
      "Read the tiles from left to right. Every tile names its source underneath.",
      "Use + Add widget to add, remove or resize panels. Anything removed can be added back.",
      "Print brief gives a one-page handout."],
    not: "Area-level counts only. No individual is identified anywhere." },
  { k: "method", href: "method.html", n: "Data health", role: "Check the data",
    does: "Can this number be trusted? Every source is checked live from your browser, coverage is measured against the DHS goals, and both models are tested against what really happened.",
    steps: ["Source status: green answered just now, amber is slow, red did not answer.",
      "Coverage: residents inside each hazard zone, by county, from 2020 Census blocks.",
      "Model checks: the needs model against past events; the warning outlook against 2025–2026.",
      "Data in this browser: everything AllReady keeps on this computer, and a button to clear it."],
    not: "Every source is public. No DHS client data is used." },
];

export const GLOSSARY = [
  ["AFN", "Access and functional needs. People who may need help to get warnings, evacuate, or stay safe in a shelter: for example a disability, limited English, no car, or a medical device that needs power."],
  ["CMIST", "The five kinds of access and functional need: Communication, Medical, Independence, Safety and support, Transportation."],
  ["ESF-6", "Emergency Support Function 6: mass care, emergency assistance, housing and human services. Counties lead mass care; at State level HI-EMA and DHS co-facilitate ESF-6 to support them."],
  ["Mass care", "Sheltering, feeding, water, emergency supplies and family reunification for people displaced by a disaster."],
  ["Census tract", "A neighbourhood-sized area of about 4,000 residents. The smallest area AllReady reports, so no person or household can be identified."],
  ["SVI", "CDC/ATSDR Social Vulnerability Index. Census-tract estimates from the American Community Survey. AllReady uses its counts of disability, limited English, households without a vehicle, and age."],
  ["emPOWER", "An HHS dataset counting Medicare beneficiaries who rely on electricity-dependent medical equipment, oxygen or dialysis, by county and ZIP code. Counts only, never names."],
  ["Limited English (LEP)", "Residents who speak English less than “very well”, as reported by the Census Bureau."],
  ["Hazard zone", "The area the State publishes for each hazard: the tsunami evacuation zone, high fire-risk areas, and FEMA's 1%-a-year flood area. For a hurricane, the whole island."],
  ["Flood zone codes", "A, AE, AH, AO, V and VE: 1% chance of flooding each year (the “100-year” flood). X: lower risk. D: possible but not studied. Click the map to see the zone at any point."],
  ["Live and What-if", "Live means a real National Weather Service alert is in force. What-if is a rehearsal a planner chooses. AllReady always says which one you are looking at."],
  ["Planning standard, Near miss, Worst case", "How many residents are assumed to need a public shelter. Planning standard uses published factors; Near miss uses the turnout counted in a real Hawaiʻi event; Worst case doubles the shelter share."],
  ["Confirm", "Shown where no organisation publishes a figure. AllReady never guesses a supply number; it names who to ask."],
  ["Warning outlook", "A trained model's estimate of the chance that the NWS has a Red Flag, flood or high-wind warning in force on each of the next seven days. A planning signal, not a forecast."],
  ["Planning note and Field report", "Map markup status. A planning note is hypothetical. A field report is something staff saw, timed, and is not an official alert."],
  ["NWS, HI-EMA, VOAD", "National Weather Service; Hawaiʻi Emergency Management Agency; Voluntary Organizations Active in Disaster (Red Cross, Salvation Army and others)."],
];

const el = (t, a = {}, ...kids) => {
  const n = document.createElement(t);
  for (const [k, v] of Object.entries(a)) { if (v == null) continue; if (k.startsWith("on")) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v); }
  for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(String(c)));
  return n;
};
const KEY = (k) => "allready.guide.hidden." + k;
const isHidden = (k) => { try { return localStorage.getItem(KEY(k)) === "1"; } catch { return false; } };
const setHidden = (k, v) => { try { v ? localStorage.setItem(KEY(k), "1") : localStorage.removeItem(KEY(k)); } catch {} };

let strip = null, current = null;

/** The guide strip. `where`: an element to insert before, or { float: host } for the map. */
export function mountGuide(k, where) {
  current = FLOW.find((p) => p.k === k); if (!current) return;
  const close = el("button", { type: "button", class: "g-x", "aria-label": "Hide this guide. The ? button brings it back.", title: "Hide. The ? button brings it back.", onclick: () => { setHidden(k, true); strip.hidden = true; } }, "Hide");
  strip = el("section", { class: "g-strip" + (where?.float ? " g-float" : ""), "aria-label": "How to use this page" },
    el("div", { class: "g-head" },
      el("span", { class: "g-step" }, `${FLOW.indexOf(current) + 1} of ${FLOW.length} · ${current.role}`),
      el("b", {}, current.n), document.querySelector(".s-head p") ? null : el("span", { class: "g-does" }, current.does), close),
    el("ol", { class: "g-steps" }, current.steps.map((s) => el("li", {}, s))),
    el("p", { class: "g-not" }, current.not, " ", el("button", { type: "button", class: "g-more", onclick: openHelp }, "How the pages fit, and what the terms mean")));
  strip.hidden = isHidden(k);
  if (where?.float) where.float.append(strip);
  else if (where) where.parentNode.insertBefore(strip, where);
}

/** The "?" button for a page's top bar. */
export function helpButton(cls = "") {
  return el("button", { type: "button", class: "g-help " + cls, "aria-label": "How to use this page, and a glossary of terms", title: "How to use this page · glossary", onclick: openHelp }, "?");
}

let dlg = null;
export function openHelp() {
  if (current && strip?.hidden) { strip.hidden = false; setHidden(current.k, false); }
  if (!dlg) {
    dlg = el("dialog", { class: "g-dlg", "aria-labelledby": "gT" });
    const body = el("div", { class: "g-body" });
    dlg.append(el("header", {}, el("h2", { id: "gT" }, "Using AllReady"), el("button", { type: "button", class: "g-x", "aria-label": "Close", onclick: () => dlg.close() }, "Close")), body);
    body.append(
      current ? el("section", {}, el("h3", {}, `This page: ${current.n}`), el("p", {}, current.does), el("ol", {}, current.steps.map((s) => el("li", {}, s))), el("p", { class: "g-not" }, current.not)) : null,
      el("section", {}, el("h3", {}, "How the pages fit together"),
        el("p", {}, "The order follows the DHS brief: map who needs help and where, model what they will need, then match needs to the organisations that meet them."),
        el("ol", { class: "g-flow" }, FLOW.map((p) => el("li", { "aria-current": p === current ? "page" : null }, el("a", { href: p.href }, p.n), el("span", {}, ` ${p.role}. `), el("small", {}, p.does))))),
      el("section", {}, el("h3", {}, "Terms"), el("dl", { class: "g-gl" }, GLOSSARY.flatMap(([t, d]) => [el("dt", {}, t), el("dd", {}, d)]))),
      el("p", { class: "g-not" }, "Public, de-identified, area-level data only. No personal information, no registry of people, no alerts issued. Counties lead mass care; AllReady supports their plans and replaces none of them."));
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); }); // click outside closes
    document.body.append(dlg);
  }
  dlg.showModal();
}
