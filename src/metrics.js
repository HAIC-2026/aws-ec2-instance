/* AllReady — Goals & Metrics. MIT licensed.

   The DHS submission names three goals, and the AI-planning rubric scores a whole category
   on whether the plan achieves them. So AllReady measures itself against them, live, from the
   data actually loaded in the session — not from a slide.

     Goal 1  Hazard-specific AFN vulnerability maps for all four hazard types covering every
             county. Target: 100% of census tracts.
     Goal 2  Needs estimates across all five CMIST categories, validated as reasonable.
     Goal 3  Reduce the time to produce a coordinated needs-and-resources plan for an event
             from a stated baseline to a stated target. Teams propose both, with justification.

   Goal 3's baseline is ours and is argued, not asserted — see BASELINE below. The clock is
   real: it starts when the session first has data and stops the first time a complete plan
   (population + needs + resources + gaps for a named scenario) exists. */

import { HAZARDS } from "./model.js";

/**
 * Proposed baseline for Goal 3, justified from the agency's own description of today's
 * process in the challenge submission:
 *   "Pulling program and provider reports, cross-referencing lists with hazard zones,
 *    contacting partners (phone, text, email) to confirm shelter, transport, staffing,
 *    and supply capacity." … "Deduplication and verification are often required."
 * Four counties × partner confirmation rounds, across agencies that do not co-plan.
 * Stated as a proposal to validate with DHS, not as a measured figure.
 */
export const BASELINE = {
  hours: 72,
  label: "3 business days",
  staffHours: 24,
  basis: "DHS describes today's process as pulling program and provider reports, cross-referencing them against hazard zones by hand, then confirming capacity with partners by phone, text and email — across four counties that do not co-plan, with de-duplication and verification needed each cycle.",
  caveat: "Proposed by AllReady, not measured. Needs validation with DHS and county EMAs.",
};
export const TARGET = { minutes: 15, label: "under 15 minutes" };

const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const fmt = (n) => (n == null ? "–" : Math.round(n).toLocaleString("en-US"));

/** Session timing. Monotonic, so a clock change cannot flatter the number. */
export function createTimer() {
  let t0 = null, tPlan = null, tOut = null;
  return {
    start() { if (t0 == null) t0 = performance.now(); },
    // A complete plan exists in memory.
    planReady() { if (t0 != null && tPlan == null) tPlan = performance.now(); },
    // The planner actually produced the artifact. Goal 3 asks for a plan, not a capability,
    // so this — not page load — is what stops the clock.
    exported() { if (t0 != null) tOut ??= performance.now(); },
    reset() { t0 = null; tPlan = null; tOut = null; },
    get started() { return t0 != null; },
    get elapsedMs() { return t0 == null ? 0 : (tOut ?? performance.now()) - t0; },
    get ready() { return tPlan != null; },
    get done() { return tOut != null; },
  };
}

const dur = (ms) => {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
};

/**
 * Compute the three goals from live session state.
 * state: { tracts:{scored,total,withPop}, counties:[readiness], cmist:{...}, hazards:Set,
 *          shelters:n, empower:bool, timer }
 */
export function score(state) {
  const { tracts, counties, cmist, shelters, empower, timer } = state;

  // --- Goal 1 ---
  const countiesMapped = counties.filter((c) => c.count > 0 || c.fips).length;
  const g1 = {
    n: "Hazard-specific AFN maps, every county, 100% of tracts",
    rows: [
      { k: "Census tracts scored", have: tracts.scored, of: tracts.total, pct: pct(tracts.scored, tracts.total),
        note: tracts.total ? `${fmt(tracts.total - tracts.withPop)} tracts have no resident population and are excluded from scoring` : "CDC/ATSDR SVI 2022 not loaded yet" },
      { k: "Hazard types modelled", have: state.hazards.size, of: HAZARDS.length, pct: pct(state.hazards.size, HAZARDS.length),
        note: HAZARDS.map((h) => h.n).join(", ") },
      { k: "Counties covered", have: countiesMapped, of: 4, pct: pct(countiesMapped, 4),
        note: "Tract-level AFN scoring covers all four counties; shelter supply does not — see the readiness scorecard." },
    ],
  };
  g1.pct = Math.round(g1.rows.reduce((t, r) => t + r.pct, 0) / g1.rows.length);

  // --- Goal 2 ---
  const g2rows = Object.entries(cmist).map(([k, v]) => ({
    k: `${k} — ${v.n}`, have: v.source ? 1 : 0, of: 1, pct: v.source ? 100 : 0,
    note: v.source || "no source wired",
  }));
  const g2 = {
    n: "Needs estimates across all five CMIST categories",
    rows: g2rows,
    pct: pct(g2rows.filter((r) => r.pct === 100).length, g2rows.length),
    validation: "Estimates are computed from published rates and documented planning factors. The same formula is run, untuned, on Hurricane Lane (2018) and the Maui wildfires (2023) beside the published shelter counts — see “Checked against past events” on the Insights page. The margin that counts as reasonable is for DHS and the county EMAs to agree; every factor is exposed for that conversation.",
  };

  // --- Goal 3 ---
  const elapsed = timer.elapsedMs;
  const g3 = {
    n: "Time from forecast to a coordinated needs-and-resources plan",
    baselineH: BASELINE.hours,
    targetMin: TARGET.minutes,
    elapsed, elapsedLabel: timer.started ? dur(elapsed) : "not started",
    done: timer.done, ready: timer.ready,
    hit: timer.done && elapsed <= TARGET.minutes * 60000,
    speedup: timer.done && elapsed > 0 ? Math.round((BASELINE.hours * 3600000) / elapsed) : null,
    pct: timer.done ? (elapsed <= TARGET.minutes * 60000 ? 100 : 60) : timer.ready ? 50 : 0,
  };

  return {
    g1, g2, g3,
    overall: Math.round((g1.pct + g2.pct + g3.pct) / 3),
    shelters, empower,
  };
}

/* ---------------- panel ---------------- */

const el = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };

function bar(p) {
  const b = el("div", "mx-bar");
  const i = el("i");
  i.style.width = Math.min(100, p) + "%";
  i.dataset.s = p >= 95 ? "good" : p >= 50 ? "part" : "thin";
  b.append(i);
  return b;
}

function goalBlock(g, idx) {
  const s = el("section", "mx-goal");
  const h = el("header");
  h.append(el("span", "mx-gn", "Goal " + idx), el("b", null, g.n), el("span", "mx-gp", g.pct + "%"));
  s.append(h, bar(g.pct));
  const ul = el("ul", "mx-rows");
  for (const r of g.rows || []) {
    const li = el("li");
    li.append(el("span", "mx-k", r.k), el("span", "mx-v", r.of === 1 ? (r.pct ? "✓" : "—") : `${fmt(r.have)} / ${fmt(r.of)}`));
    li.append(el("em", null, r.note));
    ul.append(li);
  }
  s.append(ul);
  return s;
}

export function createMetrics(host, getState) {
  host.classList.add("mx");

  function render() {
    const st = getState();
    if (!st) { host.textContent = ""; host.append(el("p", "empty", "Loading…")); return; }
    const s = score(st);
    host.textContent = "";

    const top = el("div", "mx-top");
    top.append(el("span", "mx-lab", "Challenge goals, measured live"));
    const o = el("div", "mx-overall");
    o.append(el("b", null, s.overall + "%"), el("span", null, "goals met"));
    top.append(o);
    host.append(top);

    host.append(goalBlock(s.g1, 1), goalBlock(s.g2, 2));

    // Goal 3 reads differently: it is a stopwatch, not a coverage bar.
    const g3 = el("section", "mx-goal");
    const h3 = el("header");
    h3.append(el("span", "mx-gn", "Goal 3"), el("b", null, s.g3.n), el("span", "mx-gp", s.g3.done ? "met" : s.g3.ready ? "plan ready" : "running"));
    g3.append(h3);
    const clock = el("div", "mx-clock");
    const c1 = el("div", "mx-c1");
    c1.append(el("b", null, s.g3.elapsedLabel));
    clock.append(c1, el("span", "mx-c2", `vs. a proposed baseline of ${BASELINE.label} (${BASELINE.staffHours} staff-hours)`));
    g3.append(clock);
    if (s.g3.speedup) g3.append(el("p", "mx-speed", `≈ ${fmt(s.g3.speedup)}× faster than the baseline process. Target is ${TARGET.label}.`));
    else g3.append(el("p", "mx-speed", s.g3.ready
    ? `A complete plan is assembled and the clock is still running. Target is ${TARGET.label}; it stops when you export the plan.`
    : `Target: ${TARGET.label}. The clock runs from the first moment there is data to plan with, and stops when you export the plan.`));
    const d = el("details", "mx-just");
    d.append(el("summary", null, "How the baseline was derived"));
    d.append(el("p", null, BASELINE.basis), el("p", "mx-caveat", BASELINE.caveat));
    g3.append(d);
    host.append(g3);

    const foot = el("p", "src");
    foot.textContent = "Measured from the data loaded in this session. Goals are quoted from the DHS challenge submission; the Goal 3 baseline and target are proposed by AllReady and marked for validation.";
    host.append(foot);
  }

  return { render };
}

/* ---------------- plan export ---------------- */

/** The coordinated plan, as Markdown. This is the artifact Goal 3's clock is timing. */
export function buildBrief(st) {
  const { scenario, phase, hazard, plan, area, readinessScore, actions, counties } = st;
  const L = [];
  const p = (s = "") => L.push(s);
  const now = new Date().toLocaleString("en-US", { timeZone: "Pacific/Honolulu" });

  p(`# Coordinated needs-and-resources plan — ${scenario?.n || hazard}`);
  p(`*Generated by AllReady at ${now} HST. Not an alert and not an operations order.*`);
  p();
  p(`**Scenario phase:** ${phase?.n || "—"} · evacuation progress ${Math.round((phase?.ramp ?? 0) * 100)}%`);
  p(`**Area:** ${area?.tracts || 0} census tracts · ${fmt(area?.pop)} residents`);
  p();

  p(`## 1. Population and access & functional needs`);
  p(`| CMIST | Need | People | Source |`);
  p(`|---|---|---:|---|`);
  for (const [k, v] of Object.entries(plan?.demand?.cmist || {})) {
    p(`| **${k}** | ${v.what} | ${fmt(v.v)} | ${k === "M" ? "HHS emPOWER" : "CDC/ATSDR SVI 2022 (ACS 2018–2022)"} |`);
  }
  p();
  p(`Of ${fmt(plan?.demand?.atRisk)} residents at risk, an estimated ${fmt(plan?.demand?.evacuating)} evacuate and ${fmt(plan?.demand?.shelterPop)} seek public shelter (planning range ${fmt(plan?.demand?.shelterLow)}–${fmt(plan?.demand?.shelterHigh)}).`);
  p();

  p(`## 2. Resources required and gaps`);
  p(`| Resource | CMIST | Needed | Confirmed available | Gap | Basis |`);
  p(`|---|---|---:|---:|---:|---|`);
  for (const r of plan?.resources || []) {
    const have = r.have == null ? "not published" : fmt(r.have);
    const gap = r.gap == null ? "**unknown**" : r.gap > 0 ? `**${fmt(r.gap)}**` : "0";
    p(`| ${r.n} | ${r.cmist} | ${fmt(r.need)} ${r.unit} | ${have} | ${gap} | ${r.how} |`);
  }
  p();
  const blocked = (plan?.resources || []).filter((r) => r.blocked);
  if (blocked.length) {
    p(`### Gaps that cannot be computed from published data`);
    for (const r of blocked) p(`- **${r.n}** — ${r.blocked}.`);
    p();
  }

  p(`## 3. Coordination — roles, decision points, communication`);
  p(`Counties lead mass care; the State (HI-EMA with DHS as ESF-6 co-lead) supports.`);
  p();
  p(`| When | Who | Decision or action | Trigger | Communication |`);
  p(`|---|---|---|---|---|`);
  for (const dpt of scenario?.points || []) {
    const o = st.owners?.[dpt.owner];
    const c = dpt.comms ? `${dpt.comms.channel}${dpt.comms.langs?.length ? ` · ${dpt.comms.langs.length} languages` : ""}${dpt.comms.messenger ? ` · ${dpt.comms.messenger}` : ""}` : "—";
    p(`| ${st.fmtOffset(dpt.t, scenario.unit)} | ${o?.n || dpt.owner} | ${dpt.action} | ${dpt.trigger} | ${c} |`);
  }
  p();

  p(`## 4. Shelter data readiness by county`);
  p(`| County | Term used | Shelters | Capacity on record | Attributes published |`);
  p(`|---|---|---:|---:|---:|`);
  for (const c of readinessScore || []) {
    p(`| ${c.name} | ${c.term} | ${c.published ? c.count : "none published"} | ${c.capacity ? fmt(c.capacity) : "–"} | ${c.published ? c.pct + "%" : "–"} |`);
  }
  p();

  p(`## 5. Highest-value data actions`);
  p(`These are gaps in the record, not shortages of supply. Each one is closable without procurement.`);
  p();
  (actions || []).slice(0, 8).forEach((a, i) => {
    p(`${i + 1}. **${a.title}** — ${a.action}`);
    p(`   *Unblocks:* ${a.unblocks}`);
  });
  p();

  p(`## Sources`);
  p(`- CDC/ATSDR Social Vulnerability Index 2022 (ACS 2018–2022 five-year estimates), census-tract level`);
  p(`- HHS emPOWER, public REST service — de-identified Medicare counts at ZIP and county level`);
  for (const c of counties || []) if (c.published) p(`- ${c.agency} — ${c.term} (${c.count} records)`);
  p(`- Hawaiʻi Statewide GIS Program; FEMA NFHL; NWS; USGS; NASA FIRMS/GIBS; Open-Meteo`);
  p();
  p(`**Privacy:** every figure above is derived from published, de-identified, area-level data. No individual is represented, no registry is created, and no personally identifiable information is read, stored or transmitted by this tool.`);

  return L.join("\n");
}

export function downloadBrief(md, name = "allready-plan.md") {
  const b = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const u = URL.createObjectURL(b);
  const a = document.createElement("a");
  a.href = u; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(u), 2000);
}
