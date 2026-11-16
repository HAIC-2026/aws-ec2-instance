/* AllReady — Shelters and Resources panel rendering. MIT licensed.
   Kept out of planner.js so the map engine stays a map engine. */

import { ATTRS } from "./shelters.js";
import { FACTORS } from "./model.js";

const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };
const fmt = (n) => (n == null ? "–" : Math.round(n).toLocaleString("en-US"));

/* ---------------- Shelters: supply + what each county never published ---------------- */

export function renderShelters(host, { shelters, score, actions, onZoomCounty, loading, error }) {
  host.textContent = "";
  host.classList.add("sh");
  if (loading) { host.append(el("p", "empty", "Loading county shelter layers…")); return; }
  if (error) { host.append(el("p", "empty", error)); return; }

  const published = score.filter((c) => c.published);
  const totalCap = score.reduce((t, c) => t + c.capacity, 0);
  const capKnown = score.reduce((t, c) => t + c.capacityKnownFor, 0);

  const sum = el("div", "sh-sum");
  const cell = (b, s) => { const d = el("div"); d.append(el("b", null, b), el("span", null, s)); return d; };
  sum.append(
    cell(fmt(shelters.length), "shelters"),
    cell(fmt(totalCap), "spaces on record"),
    cell(`${published.length}/4`, "counties publishing"),
  );
  host.append(sum);

  const scroll = el("div", "scroll");

  for (const c of score) {
    const box = el("div", "sh-c");
    const h = el("div", "sh-ch");
    h.append(el("b", null, c.name));
    const g = el("span", "sh-grade", c.published ? `${c.pct}%` : "no feed");
    g.dataset.g = c.grade;
    h.append(g);
    box.append(h);
    box.append(el("p", "sh-term", `${c.agency} · calls them “${c.term}”`));

    if (c.url) { const a = el("a", "link", "Open this county’s public feed ↗"); a.href = c.url; a.target = "_blank"; a.rel = "noopener noreferrer"; box.append(a); }
    if (!c.published) {
      box.append(el("p", "sh-none", c.gap));
      scroll.append(box);
      continue;
    }

    const line = el("p", "src");
    line.textContent = `${fmt(c.count)} sites · ${fmt(c.capacity)} spaces across the ${fmt(c.capacityKnownFor)} that publish a capacity` +
      (c.open ? ` · ${c.open} open now` : "");
    box.append(line);

    const attrs = el("div", "sh-attrs");
    for (const a of c.attrs) {
      const r = el("div", "sh-a");
      r.append(el("span", null, a.n));
      const bar = el("i");
      bar.style.setProperty("--p", a.pct + "%");
      bar.style.setProperty("--c", a.pct >= 75 ? "var(--ok)" : a.pct >= 40 ? "var(--warn)" : "var(--danger)");
      r.append(bar, el("em", null, `${a.have}/${a.of}`));
      r.title = a.why;
      attrs.append(r);
    }
    box.append(attrs);

    if (onZoomCounty) {
      const b = el("button", "link", "Show on the map");
      b.type = "button";
      b.onclick = () => onZoomCounty(c.fips);
      box.append(b);
    }
    scroll.append(box);
  }

  // The gaps that close with a phone call, not a purchase order.
  const ah = el("div", "sh-c");
  ah.append(el("b", null, "Highest-value data actions"));
  scroll.append(ah);

  const ol = el("ul", "act");
  for (const a of actions.slice(0, 7)) {
    const li = el("li");
    li.append(el("b", null, a.title), el("p", null, a.action), el("em", null, "Unblocks: " + a.unblocks));
    ol.append(li);
  }
  scroll.append(ol);

  scroll.append(el("p", "foot", "Sources: Honolulu DEM (HOLIS GIS), Hawaiʻi County Civil Defense Agency, Kauaʻi County Emergency Management Agency — public ArcGIS feature services, read live. Facility records only; no personal information."));
  host.append(scroll);
}

/* ---------------- Resources: demand, supply, and honest gaps ---------------- */

export function renderResources(host, { plan, scenario, phase, area, onExport, onFactors, loading, mode, live, shelters = [], score = [], read = "", onManual, onWhatIf }) {
  host.textContent = "";
  host.classList.add("rs");
  if (loading) {
    host.append(el("p", "empty", "Reading census tracts (CDC/ATSDR SVI), the three county shelter feeds and HHS emPOWER…"));
    return;
  }
  if (!plan || !scenario || !phase) {
    // Live mode with nothing in force: show what is real — the supply on record — and no
    // invented demand. Zeros here are the truth, not a placeholder.
    const hd = el("div", "rs-hd");
    hd.append(el("b", null, mode === "live" ? "No active event" : "No scenario set"));
    hd.append(el("span", null, mode === "live" ? "No hurricane, tsunami, flood or fire-weather alert is in force, so there is no demand to calculate. Supply on record right now:" : "Set a scenario on the event clock."));
    host.append(hd);
    const sum = (f) => shelters.filter(f).length;
    const rows = [
      ["Shelters open now", sum((x) => x.status === "open")],
      ["Shelters on record", shelters.length],
      ["Shelter spaces on record", shelters.reduce((t, x) => t + (x.capacity || 0), 0)],
      ["Confirmed accessible (ADA)", sum((x) => x.ada === true)],
      ["With backup power", sum((x) => x.power === true)],
      ["Accepting animals", sum((x) => x.pets === true)],
      ["Wind-hardened", sum((x) => x.hardened === true)],
      ["Counties publishing a shelter feed", `${score.filter((c) => c.published).length} of 4`],
    ];
    const ul = el("ul", "rs-l");
    for (const [k, v] of rows) { const li = el("li", "rs-i"); const t = el("div", "rs-t"); t.textContent = k; const n = el("div", "rs-n"); n.textContent = typeof v === "number" ? fmt(v) : v; li.append(t, n); ul.append(li); }
    host.append(ul, el("p", "src rs-read", read));
    if (mode === "live" && onWhatIf) { const f = el("div", "rs-f"); const b = el("button", "btn ghost", "Plan a what-if scenario"); b.type = "button"; b.onclick = onWhatIf; f.append(b); host.append(f); }
    return;
  }
  const { demand: d, resources: R } = plan;

  const hd = el("div", "rs-hd");
  hd.append(el("b", null, mode === "live" ? `Live · ${live?.label || scenario.n}` : `What-if · ${scenario.n} · ${phase.n}`));
  if (mode !== "live") hd.append(el("span", "rs-flag", "Hypothetical scenario — not a real event"));
  hd.append(el("span", null,
    `${fmt(d.atRisk)} at risk → ${fmt(d.evacuating)} evacuating → ${fmt(d.shelterPop)} in public shelter (range ${fmt(d.shelterLow)}–${fmt(d.shelterHigh)}) · ` +
    `${area?.tracts || 0} census tracts · evacuation ${Math.round(d.ramp * 100)}%`));
  host.append(hd);

  const short = R.filter((r) => r.state === "short").length;
  const unknown = R.filter((r) => r.state === "unknown").length;
  if (short || unknown) {
    const warn = el("p", "src");
    warn.style.cssText = "padding:9px 14px;border-bottom:1px solid var(--line)";
    warn.textContent = `${short} resource line${short === 1 ? "" : "s"} short of confirmed supply · ` +
      `${unknown} that cannot be computed because the counties never published the attribute.`;
    host.append(warn);
  }

  const ul = el("ul", "rs-l");
  for (const r of R) {
    const li = el("li", "rs-i");
    li.dataset.s = r.state;

    const t = el("div", "rs-t");
    t.append(document.createTextNode(r.n));
    if (r.cmist && r.cmist !== "—") t.append(el("span", "rs-cm", r.cmist));
    li.append(t);

    const n = el("div", "rs-n");
    n.append(document.createTextNode(fmt(r.need)));
    n.append(el("small", null, r.unit));
    li.append(n);

    li.append(el("p", "rs-why", r.how));

    const gap = el("p", "rs-gap");
    gap.dataset.s = r.state;
    if (r.state === "met") gap.textContent = `Confirmed supply ${fmt(r.have)} — covered.`;
    else if (r.state === "short") gap.textContent = `Confirmed supply ${fmt(r.have)} · gap ${fmt(r.gap)} ${r.unit}.`;
    else if (r.state === "unknown") gap.textContent = `Gap unknown — ${r.blocked}.`;
    else gap.textContent = "No feed publishes this supply. Enter what you have on hand:";
    if (r.manual) gap.textContent += " (your figure, entered by hand)";
    li.append(gap);
    // Manual entry only where no feed publishes a figure; it never overrides county data.
    if (onManual && (r.state === "demand-only" || r.manual)) {
      const inp = el("input", "rs-in"); inp.type = "number"; inp.min = "0"; inp.placeholder = "on hand"; inp.value = r.manual ? r.have : "";
      inp.setAttribute("aria-label", `${r.n}: supply on hand (manual entry)`);
      inp.addEventListener("change", () => onManual(r.k, inp.value));
      li.append(inp);
    }

    ul.append(li);
  }
  host.append(ul, el("p", "src rs-read", read));

  const f = el("div", "rs-f");
  const ex = el("button", "btn", "Export the plan");
  ex.type = "button"; ex.onclick = onExport;
  f.append(ex);
  if (onFactors) {
    const fb = el("button", "btn ghost", "Planning factors");
    fb.type = "button"; fb.onclick = onFactors;
    f.append(fb);
  }
  host.append(f);
}

/* ---------------- Planning factors: every assumption, visible and argued ---------------- */

export function renderFactors(host) {
  host.textContent = "";
  host.classList.add("scroll", "pad");
  host.append(el("h2", null, "Planning factors"));
  host.append(el("p", "src", "Every number the resource model uses. Published standards are marked; everything else is a AllReady assumption that should be argued with DHS and the counties before it is relied on."));

  const group = (title, entries) => {
    host.append(el("h4", null, title));
    const ul = el("ul", "act");
    for (const [k, v] of entries) {
      const li = el("li");
      li.style.borderLeftColor = v.std ? "var(--ok)" : "var(--warn)";
      li.append(el("b", null, `${k} — ${typeof v.v === "number" && v.v < 1 ? (v.v * 100).toFixed(0) + "%" : v.v} ${v.u}`));
      li.append(el("p", null, v.src + (v.std ? "" : " · assumption, not a published standard")));
      if (v.note) li.append(el("em", null, v.note));
      ul.append(li);
    }
    host.append(ul);
  };

  group("Who ends up in a public shelter", [
    ...Object.entries(FACTORS.evac).map(([k, v]) => [`Evacuation rate — ${k}`, v]),
    ...Object.entries(FACTORS.publicShelter).map(([k, v]) => [`Public-shelter share — ${k}`, v]),
    ["AFN uplift", FACTORS.afnUplift],
  ]);
  group("Congregate care", [
    ["Space, general", FACTORS.space], ["Space, AFN", FACTORS.spaceAfn],
    ["Water, drinking", FACTORS.water], ["Water, all uses", FACTORS.waterOps],
    ["Meals", FACTORS.meals], ["Cots", FACTORS.cots], ["Blankets", FACTORS.blankets],
    ["Staffing", FACTORS.staffRatio], ["Shifts", FACTORS.shifts],
  ]);
  group("CMIST-specific", [
    ["Dialysis", FACTORS.dialysisSessions], ["Interpreters", FACTORS.interpreter],
    ["Paratransit lift capacity", FACTORS.liftCapacity], ["Ambulatory per run", FACTORS.ambulatoryPerRun],
    ["Pet-owning households", FACTORS.petHouseholds], ["Animals per household", FACTORS.petsPerHousehold],
    ["Generators", FACTORS.generatorPerShelter],
  ]);
  host.append(el("p", "foot", "Changing a factor here changes every needs estimate and gap in the session. That is deliberate: a planning figure nobody is allowed to question is not a planning figure."));
}

/* ---------------- Data sources: every feed, its link, and when it was last read ---------------- */
export function renderSources(host, list) {
  host.textContent = "";
  host.classList.add("scroll");
  const ul = el("ul", "srcs");
  for (const x of list) {
    const li = el("li");
    const a = el("a", null, x.n + " ↗"); a.href = x.url; a.target = "_blank"; a.rel = "noopener noreferrer";
    li.append(a, el("p", null, x.use), el("em", null, `${x.fresh} · last read: ${x.read}`));
    ul.append(li);
  }
  host.append(ul);
}
