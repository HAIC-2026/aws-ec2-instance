/* AllReady — Insights widget definitions. MIT licensed.

   Each widget is { id, title, hint, w, h, render(host, ctx) }. `ctx` carries the loaded
   datasets and the current scenario, so every widget reads the same numbers the map reads.

   The narrative widgets exist because a gap table is not an insight. "6,171 accessible
   shelter spaces short" is a number; "Honolulu publishes no ADA field at all, so the real
   accessible-space gap statewide is unknown and cannot be closed by procurement" is the
   thing a planner can act on. */

import { SOURCES } from "./sources.js";
import { backtest, reading, rate } from "./backtest.js";
import { LINES } from "./empower.js";
import { FACTORS } from "./model.js";
import { SCENARIOS, OWNERS, fmtOffset } from "./scenario.js";
import { ask, health, renderText } from "./assistant.js";
import { setManualSupply } from "./live.js";

const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };
const fmt = (n) => (n == null || Number.isNaN(n) ? "–" : Math.round(n).toLocaleString("en-US"));
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

function table(cols, rows, { max = 200, align = {} } = {}) {
  const wrap = el("div", "t-wrap");
  const t = el("table", "q-t");
  const thead = el("thead"), tr = el("tr");
  cols.forEach((c) => { const th = el("th", null, c); if (align[c] === "r") th.style.textAlign = "right"; tr.append(th); });
  thead.append(tr); t.append(thead);
  const tb = el("tbody");
  rows.slice(0, max).forEach((r) => {
    const row = el("tr");
    r.forEach((v, i) => {
      const td = el("td");
      const isNum = typeof v === "number";
      td.textContent = v == null ? "—" : isNum ? v.toLocaleString("en-US", { maximumFractionDigits: 2 }) : String(v);
      if (v == null) td.className = "t-null";
      if (isNum || align[cols[i]] === "r") td.style.textAlign = "right";
      row.append(td);
    });
    tb.append(row);
  });
  t.append(tb); wrap.append(t);
  if (rows.length > max) wrap.append(el("p", "src", `Showing ${max} of ${rows.length.toLocaleString()} rows.`));
  return wrap;
}

function statRow(items) {
  const g = el("div", "stat-row");
  for (const it of items) {
    const d = el("div", "stat");
    d.append(el("b", null, it.v));
    d.append(el("span", null, it.k));
    if (it.note) d.append(el("em", null, it.note));
    if (it.tone) d.dataset.tone = it.tone;
    g.append(d);
  }
  return g;
}

/* ---------------- live metrics for the stat tiles ----------------
   Every metric is a function of the loaded feeds. `a` is "state" or a county FIPS. */
export const AREAS = [["state", "All of Hawaiʻi"], ["15003", "Honolulu"], ["15001", "Hawaiʻi County"], ["15009", "Maui County"], ["15007", "Kauaʻi County"]];
const SUMMARY = { sig: null, text: "", at: "", busy: null };
const inA = (a) => (x) => a === "state" || (x.countyFips || x.fips) === a;
const tsum = (D, a, k) => D.tracts.filter(inA(a)).reduce((t, x) => t + (x[k] || 0), 0);
const sh = (D, a) => D.shelters.filter(inA(a));
const SVI = "CDC/ATSDR SVI 2022 · ACS 2018–22", COUNTY = "County shelter feeds · live", EMPW = "HHS emPOWER · current release";
const noFeed = (D, a) => (a === "15009" ? "Maui: FEMA shelter registry" : a === "state" ? "Maui from FEMA registry" : "");
const share = (k) => (D, a) => { const p = tsum(D, a, "pop"); return { v: p ? (tsum(D, a, k) / p) * 100 : null }; };
const emp = (k) => (D, a) => { if (!D.emp) return { v: null, note: "emPOWER not loaded" }; const rows = Object.values(D.emp.byFips).filter((c) => a === "state" || c.fips === a); return { v: rows.reduce((t, c) => t + (c[k] || 0), 0), note: "Medicare only — a floor" }; };
/* One colour per domain, the same on every page: shelters teal, people blue, access and
   functional needs violet, medical coral, hazards amber. Colour is never the only signal. */
const TONE = (k) => (/^shelter/.test(k) ? "shel" : /afn|disab|lep|limited|vehicle|age|elder|older/.test(k) ? "afn" : /power|dialysis|oxygen|empower|medical/.test(k) ? "med" : /alert|quake|fire|hazard/.test(k) ? "haz" : /pop|resident|tract|household/.test(k) ? "pop" : "neutral");

export const METRICS = {
  manual: { n: "Manual value", stateOnly: true, src: "Entered by hand — not from a feed", get: () => ({ v: null }) },
  shelters_open: { n: "Shelters open now", src: COUNTY, get: (D, a) => ({ v: sh(D, a).filter((x) => x.status === "open").length, note: noFeed(D, a) || `${sh(D, a).filter((x) => x.status !== "unknown").length} sites report a status` }) },
  shelters_total: { n: "Shelters on record", src: COUNTY, get: (D, a) => ({ v: sh(D, a).length, note: noFeed(D, a) }) },
  shelter_spaces: { n: "Shelter spaces on record", src: COUNTY, get: (D, a) => ({ v: sh(D, a).reduce((t, x) => t + (x.capacity || 0), 0), note: `${sh(D, a).filter((x) => x.capacity == null).length} sites publish no capacity` }) },
  shelters_ada: { n: "Shelters confirmed accessible", src: COUNTY, get: (D, a) => ({ v: sh(D, a).filter((x) => x.ada === true).length, note: `${sh(D, a).filter((x) => x.ada == null).length} have no ADA record` }) },
  shelters_power: { n: "Shelters with backup power", src: COUNTY, get: (D, a) => ({ v: sh(D, a).filter((x) => x.power === true).length, note: `${sh(D, a).filter((x) => x.power == null).length} have no power record` }) },
  shelters_pets: { n: "Shelters accepting animals", src: COUNTY, get: (D, a) => ({ v: sh(D, a).filter((x) => x.pets === true).length, note: `${sh(D, a).filter((x) => x.pets == null).length} have no animal policy on record` }) },
  shelters_hardened: { n: "Wind-hardened shelters", src: COUNTY, get: (D, a) => ({ v: sh(D, a).filter((x) => x.hardened === true).length, note: `${sh(D, a).filter((x) => x.hardened == null).length} have no hardening record` }) },
  population: { n: "Residents", src: SVI, get: (D, a) => ({ v: tsum(D, a, "pop"), note: `${D.tracts.filter(inA(a)).length} census tracts` }) },
  afn_high: { n: "Residents in high-AFN tracts", src: SVI, get: (D, a) => { const T = D.tracts.filter(inA(a)), hi = T.filter((x) => x.afn_index >= 75); return { v: hi.reduce((t, x) => t + x.pop, 0), note: `${hi.length} of ${T.length} tracts at AFN index 75+` }; } },
  afn_high_pct: { n: "Share living in high-AFN tracts", unit: "%", dp: 1, src: SVI, get: (D, a) => { const T = D.tracts.filter(inA(a)), p = T.reduce((t, x) => t + x.pop, 0); return { v: p ? (T.filter((x) => x.afn_index >= 75).reduce((t, x) => t + x.pop, 0) / p) * 100 : null, note: "AFN index 75+ (Hawaiʻi rank)" }; } },
  disability: { n: "Residents with a disability", src: SVI, get: (D, a) => ({ v: tsum(D, a, "disability") }) },
  pct_disability: { n: "Disability, share of residents", unit: "%", dp: 1, src: SVI, get: share("disability") },
  lep: { n: "Limited-English residents", src: SVI, get: (D, a) => ({ v: tsum(D, a, "limited_english") }) },
  pct_lep: { n: "Limited English, share of residents", unit: "%", dp: 1, src: SVI, get: share("limited_english") },
  age65: { n: "Residents 65 and older", src: SVI, get: (D, a) => ({ v: tsum(D, a, "age_65_plus") }) },
  pct_age65: { n: "65 and older, share of residents", unit: "%", dp: 1, src: SVI, get: share("age_65_plus") },
  no_vehicle: { n: "Households with no vehicle", src: SVI, get: (D, a) => ({ v: tsum(D, a, "no_vehicle") }) },
  power_dependent: { n: "Power-dependent residents", src: EMPW, get: emp("dme") },
  dialysis: { n: "Residents on dialysis", src: EMPW, get: emp("dialysis") },
  power_per_1000: { n: "Power-dependent per 1,000 residents", dp: 1, src: EMPW + " ÷ SVI population", get: (D, a) => { const e = emp("dme")(D, a), p = tsum(D, a, "pop"); return { v: e.v != null && p ? (e.v / p) * 1000 : null, note: "Medicare only — a floor" }; } },
  residents_per_space: { n: "Residents per shelter space", dp: 1, src: "SVI population ÷ county shelter capacity", get: (D, a) => { const c = sh(D, a).reduce((t, x) => t + (x.capacity || 0), 0); return { v: c ? tsum(D, a, "pop") / c : null, note: c ? noFeed(D, a) : "no capacity published for this area" }; } },
  alerts_active: { n: "NWS alerts in force", stateOnly: true, src: "api.weather.gov · live", get: (D) => ({ v: D.alerts ? D.alerts.length : null, note: D.alerts?.length ? [...new Set(D.alerts.map((x) => x.event))].slice(0, 2).join(", ") : D.alerts ? "none right now" : "feed unavailable" }) },
  quakes_7d: { n: "Earthquakes M2.5+, past 7 days", stateOnly: true, src: "USGS · live", get: (D) => ({ v: D.quakes ? D.quakes.count : null, note: D.quakes?.max ? `largest M${D.quakes.max.toFixed(1)}` : D.quakes ? "" : "feed unavailable" }) },
};

/* ---------------- widget catalogue ---------------- */

export const WIDGETS = {
  headline: {
    title: "Headline", hint: "The four numbers a briefing opens with.", w: 12, h: 3,
    render(host, ctx) {
      const { plan, tracts, shelters, score } = ctx;
      if (!plan) return host.append(el("p", "empty", ctx.idle));
      const missing = score.filter((c) => !c.published).length;
      host.append(statRow([
        { k: "residents in scope", v: fmt(plan.demand.atRisk), note: `${tracts.length} census tracts` },
        { k: "projected to need public shelter", v: fmt(plan.demand.shelterPop), note: `${ctx.scenario.n}, ${ctx.phase.n}` },
        { k: "confirmed shelter spaces", v: fmt(plan.supply.spaces), note: `${shelters.length} sites, ${plan.supply.capacityUnknownSites} without a capacity figure`, tone: plan.supply.spaces < plan.demand.shelterPop ? "bad" : "ok" },
        { k: "counties with shelter data", v: `${4 - missing}/4`, note: missing ? "a county feed did not load" : "Maui from FEMA's registry", tone: missing ? "warn" : "ok" },
      ]));
    },
  },

  /* One number, Grafana-style. The planner picks the metric and the area; the figure is
     computed from the feeds loaded in this session, never typed in. Each tile names its
     source and whether it is a live feed or a survey vintage. */
  stat: {
    title: "Metric", hint: "One live number: pick the metric and the area.", w: 2, h: 3,
    render(host, ctx, state) {
      const key = METRICS[state.metric] ? state.metric : "shelters_open";
      const area = AREAS.some(([k]) => k === state.area) ? state.area : "state";
      const m = METRICS[key];
      const r = m.get(ctx.all, m.stateOnly ? "state" : area);
      if (key === "manual") { // a tile the planner fills in: a label and a number, tagged as manual
        const box = el("div", "tile");
        const v = el("input", "tile-v tile-edit"); v.type = "text"; v.inputMode = "decimal"; v.placeholder = "0"; v.value = state.value ?? ""; v.setAttribute("aria-label", "Value");
        const n = el("input", "tile-n tile-edit"); n.type = "text"; n.placeholder = "Label, e.g. Generators staged"; n.value = state.label ?? ""; n.setAttribute("aria-label", "Label");
        v.addEventListener("change", () => { state.value = v.value; state.save(); });
        n.addEventListener("change", () => { state.label = n.value; state.save(); });
        box.append(v, n, el("em", "tile-src", "Manual entry — not from a feed"));
        const row = el("div", "tile-pick"), s3 = el("select", "sel"); s3.setAttribute("aria-label", "Metric");
        Object.entries(METRICS).forEach(([k, x]) => { const o = el("option", null, x.n); o.value = k; s3.append(o); });
        s3.value = key; s3.onchange = () => { state.metric = s3.value; state.save(); ctx.rerender(); };
        row.append(s3); host.append(box, row); return;
      }
      const box = el("div", "tile");
      box.dataset.tone = TONE(key);
      const v = el("b", "tile-v", r.v == null ? "—" : typeof r.v === "number" ? r.v.toLocaleString("en-US", { maximumFractionDigits: m.dp ?? 0 }) + (m.unit || "") : r.v);
      box.append(v, el("span", "tile-n", m.n));
      if (r.note) box.append(el("em", "tile-note", r.note));
      box.append(el("em", "tile-src", m.src));
      const row = el("div", "tile-pick");
      const mk = (opts, val, on, label) => { const s2 = el("select", "sel"); s2.setAttribute("aria-label", label); opts.forEach(([k, n]) => { const o = el("option", null, n); o.value = k; s2.append(o); }); s2.value = val; s2.onchange = () => on(s2.value); return s2; };
      row.append(mk(Object.entries(METRICS).map(([k, x]) => [k, x.n]), key, (v2) => { state.metric = v2; state.save(); ctx.rerender(); }, "Metric"));
      if (!m.stateOnly) row.append(mk(AREAS, area, (v2) => { state.area = v2; state.save(); ctx.rerender(); }, "Area"));
      else row.append(el("span", "tile-fixed", "Statewide"));
      host.append(box, row);
    },
  },

  /* Written by the model from the live figures on this page, on demand. Nothing here is
     stored prose: change the hazard, phase or area and it is regenerated from the new numbers. */
  summary: {
    title: "AI summary", hint: "A model-written overview of the current figures. Regenerates when the scope changes.", w: 5, h: 8,
    render(host, ctx) {
      const sig = `${ctx.modeLabel}|${(ctx.all.alerts || []).length}|${ctx.all.shelters.filter((x) => x.status === "open").length}|${ctx.scopeName}|${ctx.plan?.demand.shelterPop}|${ctx.all.shelters.length}`;
      const out = el("div", "ai-out"), bar = el("div", "ai-bar");
      const btn = el("button", "btn ghost", "Regenerate"); btn.type = "button";
      const st = el("span", "src");
      bar.append(st, btn); host.append(out, bar);
      // The grid re-renders as feeds arrive; always write into the box that is on screen now.
      SUMMARY.out = out; SUMMARY.st = st; SUMMARY.btn = btn;
      const gen = async (force) => {
        const h = await health();
        if (!h.ai) { out.textContent = ""; out.append(el("p", "empty", h.offline ? "The assistant server is not running here, so no summary can be written. Start the app with a model configured (README → “Turn on the assistant”)." : `No model is answering (${h.model}). Start Ollama or set LLM_API_KEY, then press Regenerate.`)); st.textContent = ""; return; }
        if (!force && SUMMARY.sig === sig && SUMMARY.text) { renderText(out, SUMMARY.text); st.textContent = `${h.model} · ${SUMMARY.at}`; return; }
        if (SUMMARY.busy) { if (SUMMARY.partial) renderText(out, SUMMARY.partial); else out.textContent = "Writing from the current figures… a local model takes 10–40 seconds."; btn.disabled = true; return; }
        SUMMARY.busy = sig; SUMMARY.partial = ""; out.textContent = "Writing from the current figures… a local model takes 10–40 seconds."; btn.disabled = true;
        try {
          const text = await ask({
            context: ctx.aiContext(),
            messages: [{ role: "user", content: "Write the briefing summary for this dashboard from the snapshot: 1) the situation in one or two sentences, 2) the three figures that matter most and why, 3) which gaps are real shortages and which are missing county data, 4) the single most useful next action and who would take it. Under 170 words. Use only numbers in the snapshot." }],
            onText: (_, all) => { SUMMARY.partial = all; renderText(SUMMARY.out, all); },
          });
          Object.assign(SUMMARY, { sig, text, at: new Date().toLocaleTimeString("en-US", { timeZone: "Pacific/Honolulu", hour: "numeric", minute: "2-digit" }) + " HST" });
          renderText(SUMMARY.out, text); SUMMARY.st.textContent = `${h.model} · ${SUMMARY.at} · written from the figures on this page`;
        } catch (e) { SUMMARY.out.textContent = ""; SUMMARY.out.append(el("p", "q-err", e.message)); }
        finally { SUMMARY.busy = null; SUMMARY.partial = ""; SUMMARY.btn.disabled = false; }
      };
      btn.onclick = () => gen(true);
      gen(false);
    },
  },

  gaps: {
    title: "Resources & gaps", hint: "Every modelled resource line with its gap and basis.", w: 7, h: 8,
    render(host, ctx) {
      if (!ctx.plan) return host.append(el("p", "empty", ctx.idle));
      host.append(el("p", "src", ctx.modeLabel + (ctx.live ? "" : " — hypothetical, not a real event")));
      const wrap = el("div", "t-wrap"), t = el("table", "q-t"), hr = el("tr");
      ["Resource", "CMIST", "Needed", "Supply", "Gap", "State"].forEach((c, i) => { const th = el("th", null, c); if (i > 1 && i < 5) th.style.textAlign = "right"; hr.append(th); });
      const th = el("thead"); th.append(hr); t.append(th);
      const tb = el("tbody");
      for (const r of ctx.plan.resources) {
        const tr = el("tr");
        const cell = (v, right) => { const td = el("td", v == null ? "t-null" : null, v == null ? "—" : typeof v === "number" ? v.toLocaleString("en-US") : v); if (right) td.style.textAlign = "right"; return td; };
        const sup = el("td"); sup.style.textAlign = "right";
        if (r.have != null && !r.manual) sup.textContent = r.have.toLocaleString("en-US");
        else { // no feed publishes this: the planner may enter what is on hand
          const inp = el("input", "t-in"); inp.type = "number"; inp.min = "0"; inp.placeholder = "enter"; inp.value = r.manual ? r.have : "";
          inp.setAttribute("aria-label", `${r.n}: supply on hand (manual entry)`);
          inp.addEventListener("change", () => { setManualSupply(r.k, inp.value); ctx.rerender(); });
          sup.append(inp);
        }
        tr.append(cell(r.n), cell(r.cmist === "—" ? null : r.cmist), cell(r.need, true), sup, cell(r.gap, true),
          cell(r.manual ? r.state + " (manual supply)" : r.state === "unknown" ? "unknown" : r.state === "demand-only" ? "no feed" : r.state));
        tb.append(tr);
      }
      t.append(tb); wrap.append(t); host.append(wrap);
      const blocked = ctx.plan.resources.filter((r) => r.blocked);
      if (blocked.length) {
        host.append(el("h4", null, "Gaps that cannot be computed"));
        const ul = el("ul", "blk");
        blocked.forEach((r) => ul.append(el("li", null, `${r.n} — ${r.blocked}.`)));
        host.append(ul);
      }
    },
  },

  readiness: {
    title: "County data readiness", hint: "How much of what a planner needs each county actually publishes.", w: 6, h: 9,
    render(host, ctx) {
      for (const c of ctx.score) {
        const box = el("div", "rd-c");
        const h = el("div", "rd-h");
        h.append(el("b", null, c.name));
        const g = el("span", "sh-grade", c.feedDown ? "no answer" : c.published ? `${c.pct}%` : "no feed");
        g.dataset.g = c.grade; h.append(g);
        box.append(h, el("p", "src", `${c.agency} · “${c.term}”`));
        if (c.feedNote) box.append(el("p", "sh-none", c.feedNote));
        if (!c.published || c.feedDown) { if (!c.published) box.append(el("p", "sh-none", c.gap)); host.append(box); continue; }
        const bars = el("div", "sh-attrs");
        for (const a of c.attrs) {
          const r = el("div", "sh-a");
          r.append(el("span", null, a.n));
          const bar = el("i");
          bar.style.setProperty("--p", a.pct + "%");
          bar.style.setProperty("--c", a.pct >= 75 ? "var(--ok)" : a.pct >= 40 ? "var(--warn)" : "var(--danger)");
          r.append(bar, el("em", null, `${a.have}/${a.of}`));
          r.title = a.why;
          bars.append(r);
        }
        box.append(bars);
        host.append(box);
      }
    },
  },

  cmist: {
    title: "CMIST breakdown", hint: "The five access and functional needs categories for the current scope.", w: 3, h: 9,
    render(host, ctx) {
      if (!ctx.plan) {
        // No event in force: show who lives here — the real resident counts — not a modelled demand.
        const e = ctx.emp ? Object.values(ctx.emp.byFips).filter((c) => ctx.area.fips.includes(c.fips)).reduce((t, c) => t + (c.dme || 0), 0) : null;
        const rows = [["C", "Communication", ctx.area.lep, "Residents who speak English less than well"], ["M", "Medical", e, "Medicare beneficiaries on electricity-dependent equipment (a floor)"], ["I", "Independence", ctx.area.dis, "Residents living with a disability"], ["S", "Safety & support", ctx.area.a65 + ctx.area.a17, "Residents 65+ and under 18"], ["T", "Transportation", ctx.area.nov, "Households with no vehicle"]];
        for (const [k, n, v, what] of rows) { const d = el("div", "cm"); d.dataset.k = k; d.append(el("i", "cml", k), el("b", null, n), el("span", null, fmt(v)), el("p", null, what)); host.append(d); }
        return host.append(el("p", "src", `Residents of ${ctx.scopeName} — not an event estimate. CDC/ATSDR SVI 2022; M from HHS emPOWER.`));
      }
      for (const [k, v] of Object.entries(ctx.plan.demand.cmist)) {
        const d = el("div", "cm"); d.dataset.k = k;
        d.append(el("i", "cml", k));
        d.append(el("b", null, v.n));
        d.append(el("span", null, fmt(v.v)));
        d.append(el("p", null, v.what));
        host.append(d);
      }
      host.append(el("p", "src", "C, I, S and T from CDC/ATSDR SVI 2022; M from HHS emPOWER. One person can appear in several rows, so they do not sum."));
    },
  },

  empower: {
    title: "Medical dependence (emPOWER)", hint: "Electricity-dependent residents by county.", w: 3, h: 9,
    render(host, ctx) {
      if (!ctx.emp) return host.append(el("p", "empty", "emPOWER has not loaded."));
      const rows = Object.values(ctx.emp.byFips)
        .filter((c) => c.benes > 0)
        .sort((a, b) => b.dme - a.dme)
        // Small health counts are shown as a range, never an exact figure (privacy: a count
        // of 3 in a small county is close to identifying someone).
        .map((c) => [c.county, c.benes, ...LINES.map((l) => (c[l.k] >= 1 && c[l.k] <= 10 ? "1–10" : c[l.k]))]);
      host.append(table(["County", "Medicare", ...LINES.map((l) => l.n.replace(" services", "").replace("Electricity-dependent equipment", "Power-dependent"))], rows));
      host.append(el("p", "src", "HHS emPOWER counts Medicare beneficiaries only. Residents on Medicaid, private cover or none are equally electricity-dependent and are not here, so every figure is a floor."));
    },
  },

  tracts: {
    title: "Highest-need census tracts", hint: "Ranked by composite AFN index.", w: 6, h: 8,
    render(host, ctx) {
      const rows = [...ctx.tracts].sort((a, b) => b.afn_index - a.afn_index).slice(0, 25)
        .map((t) => [t.tract, t.county.replace("City and County of ", ""), t.afn_index, t.pop, t.disability, t.limited_english, t.no_vehicle, t.age_65_plus]);
      host.append(table(["Tract", "County", "AFN index", "Population", "Disability", "Limited English", "No vehicle", "65+"], rows, { max: 25 }));
      host.append(el("p", "src", "AFN index = mean Hawaiʻi percentile rank across disability, limited English, no vehicle and age 65+. Ranks are relative to Hawaiʻi tracts."));
    },
  },

  actions: {
    title: "Data actions", hint: "Gaps closable with a phone call rather than a purchase order.", w: 5, h: 11,
    render(host, ctx) {
      const ul = el("ul", "act");
      for (const a of ctx.actions.slice(0, 10)) {
        const li = el("li");
        li.append(el("b", null, a.title), el("p", null, a.action), el("em", null, "Unblocks: " + a.unblocks));
        ul.append(li);
      }
      host.append(ul);
    },
  },

  decisions: {
    title: "Decision points", hint: "Who decides what, when, and how residents are told.", w: 6, h: 8,
    render(host, ctx) {
      const sc = SCENARIOS[ctx.hazard];
      if (!sc) return host.append(el("p", "empty", ctx.idle));
      const rows = sc.points.map((p) => [
        fmtOffset(p.t, sc.unit), OWNERS[p.owner].n, p.action, p.trigger,
        p.comms ? `${p.comms.channel}${p.comms.langs?.length ? ` · ${p.comms.langs.length} languages` : ""}` : "—",
      ]);
      host.append(table(["When", "Who", "Decision or action", "Trigger", "Communication"], rows, { max: 40 }));
    },
  },

  factors: {
    title: "Planning assumptions", hint: "Every factor behind the numbers, sourced and challengeable.", w: 6, h: 8,
    render(host) {
      const rows = [];
      const add = (name, f) => rows.push([name, typeof f.v === "number" && f.v < 1 ? (f.v * 100).toFixed(0) + "%" : f.v, f.u, f.src, f.std ? "published standard" : "AllReady assumption"]);
      for (const [k, v] of Object.entries(FACTORS.evac)) add(`Evacuation rate — ${k}`, v);
      for (const [k, v] of Object.entries(FACTORS.publicShelter)) add(`Public-shelter share — ${k}`, v);
      for (const [k, v] of Object.entries(FACTORS)) if (v && v.u) add(k, v);
      host.append(table(["Factor", "Value", "Unit", "Source", "Status"], rows, { max: 60 }));
    },
  },

  backtest: {
    title: "Checked against past events", hint: "The live shelter formula run on past events, beside the counts that were published.", w: 12, h: 12,
    render(host, ctx) {
      const rows = backtest(ctx.all.tracts);
      host.append(el("p", "bt-read", reading(rows)));
      const wrap = el("div", "t-wrap"), t = el("table", "q-t"), hd = el("tr");
      ["Event", "Area", "Residents in area", "Published count", "Model likely (range)", "Turnout: observed / assumed", "Result", "Source"].forEach((c, i) => { const th = el("th", null, c); if (i >= 2 && i <= 5) th.style.textAlign = "right"; hd.append(th); });
      const th = el("thead"); th.append(hd); t.append(th);
      const tb = el("tbody");
      for (const r of rows) {
        const tr = el("tr");
        const num = (v) => { const td = el("td", null, v); td.style.textAlign = "right"; return td; };
        const src = el("td"); const a = el("a", null, "Open ↗"); a.href = r.url; a.target = "_blank"; a.rel = "noopener noreferrer"; a.title = r.quote; src.append(a);
        tr.append(el("td", null, `${r.name}, ${r.date}`), el("td", null, `${r.place} — ${r.areaNote}`), num(r.pop.toLocaleString("en-US")), num(r.published.toLocaleString("en-US")),
          num(`${r.likely.toLocaleString("en-US")} (${r.low.toLocaleString("en-US")}–${r.high.toLocaleString("en-US")})`), num(`${rate(r.observed)} / ${rate(r.assumed)}`), el("td", null, r.verdict + (r.context ? ` · ${r.context}` : "")), src);
        tb.append(tr);
      }
      t.append(tb); wrap.append(t); host.append(wrap);
      host.append(el("p", "src", "Published counts were read at the linked sources; the model column is computed now from the census tracts on this page with the same untuned factors the live tool uses. Residents are today's (ACS 2018–2022), not the event year's. Observed turnout is the published count divided by residents in the area; assumed turnout is the evacuation rate times the public-shelter rate in Planning factors. Shelter counts are people present on one night, not capacity."));
    },
  },

  sources: {
    title: "Data sources", hint: "Every feed behind these numbers, with a link to check it.", w: 6, h: 8,
    render(host, ctx) {
      const wrap = el("div", "t-wrap"), t = el("table", "q-t"), hd = el("tr");
      ["Source", "Used for", "Freshness", "Check it"].forEach((c) => hd.append(el("th", null, c)));
      const th = el("thead"); th.append(hd); t.append(th);
      const tb = el("tbody");
      for (const x of SOURCES) { const tr = el("tr"); tr.append(el("td", null, x.n), el("td", null, x.use), el("td", null, x.fresh)); const td = el("td"); const a = el("a", null, "Open ↗"); a.href = x.url; a.target = "_blank"; a.rel = "noopener noreferrer"; td.append(a); tr.append(td); tb.append(tr); }
      t.append(tb); wrap.append(t); host.append(wrap, el("p", "src", `Live feeds last read ${ctx.readAt}.`));
    },
  },

  note: {
    title: "Note", hint: "A free-text note that stays on the dashboard.", w: 4, h: 4,
    render(host, ctx, state) {
      const ta = el("textarea", "q-in note-in");
      ta.rows = 4;
      ta.placeholder = "Briefing note, caveat, or a question for the county…";
      ta.value = state.text || "";
      ta.setAttribute("aria-label", "Note");
      ta.addEventListener("input", () => { state.text = ta.value; state.save?.(); });
      host.append(ta);
    },
  },
};

export const WIDGET_LIST = Object.entries(WIDGETS).map(([k, v]) => ({ k, ...v }));
