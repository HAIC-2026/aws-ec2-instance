/* AllReady — scenario clock. MIT licensed. No dependencies.

   Part 3 of the DHS framework: "clarify roles, decision points, and communication pathways
   supporting the County-led response with State assistance."

   The old timeline replayed the past. A planner does not need that. What they need is the
   forward clock: at T-48 hours, who decides what, with which resources, and what do we tell
   residents — in which languages, through whose voice.

   Two facts shape every scenario below and are never allowed to drift:
     • Counties LEAD mass care. The State (HI-EMA with DHS as ESF-6 co-lead) SUPPORTS.
     • Each hazard has its own clock. Tsunami is minutes. Wildfire is hours. Hurricane is days.

   Everything in here is a planning template meant to be edited with the counties. It does
   not replace any county or state emergency operations plan, and it issues no alerts. */

const H = 60, D = 1440; // minutes

export const OWNERS = {
  county: { n: "County EMA", role: "Leads mass care", c: "#e8b84b" },
  state: { n: "State ESF-6 (HI-EMA + DHS)", role: "Supports the county", c: "#4aa3e8" },
  dhs: { n: "DHS", role: "AFN population and partner coordination", c: "#7c9ee8" },
  partner: { n: "Partners (Red Cross, Salvation Army, VOAD)", role: "Staffs and supplies shelters", c: "#5ec98a" },
  dot: { n: "DOT / transit", role: "Accessible transport and roads", c: "#c98a5e" },
  doh: { n: "DOH / health plans", role: "Medical and dialysis continuity", c: "#d46a8a" },
};

/** Languages the state's AFN communication has to cover, per the challenge brief. */
const LANGS_ALL = ["English", "ʻŌlelo Hawaiʻi", "Ilokano", "Tagalog", "Chuukese", "Marshallese", "Japanese", "Korean", "Chinese", "Vietnamese", "Spanish", "Samoan"];
const LANGS_CORE = ["English", "Ilokano", "Tagalog", "Chuukese", "Marshallese", "Spanish"];

const dp = (t, owner, action, trigger, comms = null, afn = false) => ({ t, owner, action, trigger, comms, afn });

export const SCENARIOS = {
  hurricane: {
    n: "Hurricane", c: "#a78bfa", unit: "h", from: -5 * D, to: 3 * D,
    lead: "Days of warning. The question is not whether we know — it is whether the plan moved before the wind did.",
    phases: [
      { t: -5 * D, n: "Monitoring", ramp: 0, roles: [], note: "CPHC has the system in a 5-day outlook." },
      { t: -4 * D, n: "Watch", ramp: 0.05, roles: [], note: "Hurricane Watch. Shelter rosters confirmed." },
      { t: -3 * D, n: "Pre-positioning", ramp: 0.15, roles: [], note: "Inter-island movement still possible." },
      { t: -2 * D, n: "Warning", ramp: 0.45, roles: ["pre", "refuge", "unknown"], note: "Pre-impact shelters open." },
      { t: -36 * H, n: "Accessible transport", ramp: 0.7, roles: ["pre", "refuge", "unknown"], note: "Last lift-equipped runs." },
      { t: -24 * H, n: "Final movement", ramp: 0.9, roles: ["pre", "refuge", "unknown"], note: "Shelters filling; high-rises shelter in place." },
      { t: -12 * H, n: "Shelter in place", ramp: 1, roles: ["pre", "refuge", "unknown"], note: "No further field response. Responders are sheltered." },
      { t: 0, n: "Impact", ramp: 1, roles: ["refuge"], note: "Landfall." },
      { t: 12 * H, n: "Assessment", ramp: 1, roles: ["refuge"], note: "Shelter integrity and road status." },
      { t: 1 * D, n: "Post-impact care", ramp: 1, roles: ["post", "refuge", "unknown"], note: "Post-impact shelters open; power priority list runs." },
      { t: 3 * D, n: "Recovery", ramp: 0.8, roles: ["post", "unknown"], note: "Mass care continues; transition begins." },
    ],
    points: [
      dp(-5 * D, "state", "Run the AFN population review for the forecast cone and share tract-level estimates with the affected counties.", "CPHC 5-day outlook includes the islands", { channel: "Agency-to-agency", langs: [], messenger: "State ESF-6 to County EMA" }, true),
      dp(-4 * D, "county", "Confirm the shelter roster: which sites, which staff, and which have generators, ADA access and animal policies on record.", "Hurricane Watch issued", null, true),
      dp(-4 * D, "dhs", "Contact partner nonprofits and community groups to confirm staffing and supply capacity.", "Hurricane Watch issued", { channel: "Partner call", langs: [], messenger: "DHS to Red Cross, Salvation Army, VOAD" }),
      dp(-3 * D, "state", "Pre-position generators, water, cots and medical supplies to island staging areas while inter-island transport is still flying.", "Watch continues; 72h to tropical-storm winds", null, true),
      dp(-3 * D, "doh", "Confirm dialysis centres' surge and early-session plans for patients in the forecast area.", "Watch continues", { channel: "Health plan and provider notification", langs: [], messenger: "DOH to dialysis providers" }, true),
      dp(-2 * D, "county", "Open pre-impact shelters. Announce which ones are accessible and which accept animals.", "Hurricane Warning issued", { channel: "Radio, TV, wireless alert, community radio", langs: LANGS_ALL, messenger: "County EMA with trusted community messengers" }, true),
      dp(-2 * D, "dot", "Begin accessible transport runs for households with no vehicle and for residents using mobility devices.", "Hurricane Warning issued", { channel: "Direct outreach via existing service rosters", langs: LANGS_CORE, messenger: "Paratransit and Handi-Van operators" }, true),
      dp(-36 * H, "dot", "LAST accessible transport window. After this, lift-equipped vehicles stop and anyone not moved shelters in place.", "Winds approaching 40 mph; vehicle operations unsafe", { channel: "Final direct outreach", langs: LANGS_CORE, messenger: "Operators and community organisations" }, true),
      dp(-24 * H, "county", "Issue shelter-in-place guidance for urban high-rises: extended power loss will stop lifts and air conditioning.", "Shelters approaching capacity", { channel: "Building managers, TV, wireless alert", langs: LANGS_ALL, messenger: "County EMA and building management" }, true),
      dp(-24 * H, "dhs", "Publish reassurance that shelters are safe to enter regardless of immigration status, through trusted community voices rather than government channels alone.", "Documented reluctance among immigrant households", { channel: "Community organisations, faith-based networks, ethnic media", langs: LANGS_ALL, messenger: "Trusted community messengers, not uniformed personnel" }, true),
      dp(-12 * H, "county", "Suspend field response. Confirm every shelter has power, water and staff for 72 hours unsupported.", "Tropical-storm-force winds arriving", null),
      dp(12 * H, "county", "Assess shelter integrity and road status; identify communities cut off by a single blocked road.", "Winds below 40 mph", null, true),
      dp(1 * D, "state", "Run the power-restoration priority list against emPOWER ZIP counts so electricity-dependent residents are sequenced first.", "Utility restoration planning begins", { channel: "Agency-to-utility", langs: [], messenger: "State ESF-6 to Hawaiian Electric" }, true),
      dp(1 * D, "county", "Open post-impact shelters for households whose homes are uninhabitable.", "Damage assessment complete", { channel: "Radio, TV, community networks", langs: LANGS_ALL, messenger: "County EMA" }),
      dp(3 * D, "partner", "Transition congregate shelter to longer-term housing casework; AFN households first.", "Shelter population stabilises", null, true),
    ],
  },

  tsunami: {
    n: "Tsunami", c: "#22d3ee", unit: "min", from: -200, to: 300,
    lead: "Minutes, not days. Everything that was not decided before the warning cannot be decided now.",
    phases: [
      { t: -200, n: "Message received", ramp: 0, roles: [], note: "PTWC issues a tsunami message for Hawaiʻi." },
      { t: -170, n: "Warning", ramp: 0.15, roles: [], note: "Sirens. Evacuation of the zone is ordered." },
      { t: -140, n: "Zone evacuation", ramp: 0.45, roles: ["pre", "refuge", "unknown"], note: "Safe-zone shelters and vertical refuge open." },
      { t: -90, n: "Assisted evacuation", ramp: 0.75, roles: ["pre", "refuge", "unknown"], note: "The households that cannot self-evacuate." },
      { t: -45, n: "Zone clearing", ramp: 0.95, roles: ["refuge", "unknown"], note: "Responders leave the zone." },
      { t: -15, n: "Zone closed", ramp: 1, roles: ["refuge"], note: "No movement in the inundation zone." },
      { t: 0, n: "First wave", ramp: 1, roles: ["refuge"], note: "Arrival. Later waves can be larger." },
      { t: 120, n: "Wave series", ramp: 1, roles: ["refuge"], note: "Do not re-enter: the series can run for hours." },
      { t: 240, n: "All-clear assessment", ramp: 0.8, roles: ["post", "refuge", "unknown"], note: "County decides re-entry." },
    ],
    points: [
      dp(-200, "state", "Notify all four counties and push the AFN layer for the inundation zone — who inside the zone cannot self-evacuate.", "PTWC tsunami message", { channel: "Agency-to-agency", langs: [], messenger: "HI-EMA to County EMAs" }, true),
      dp(-170, "county", "Sound sirens and broadcast evacuation. The message must be multimodal: audible, visual and text, because sirens alone do not reach Deaf and hard-of-hearing residents.", "Tsunami Warning", { channel: "Sirens, wireless alert, TV crawl, radio, text", langs: LANGS_ALL, messenger: "County EMA; ASL interpreter on broadcast" }, true),
      dp(-150, "county", "Evacuate care homes, hospitals and adult residential care facilities inside the zone — these have the longest movement times.", "Warning issued", { channel: "Direct facility notification", langs: [], messenger: "County EMA to licensed facilities" }, true),
      dp(-140, "county", "Open safe-zone shelters and designated vertical refuge above the inundation line.", "Zone evacuation under way", { channel: "Radio, wireless alert", langs: LANGS_ALL, messenger: "County EMA" }),
      dp(-90, "dot", "Assisted evacuation runs for no-vehicle households and residents using mobility devices inside the zone.", "Self-evacuation largely complete", { channel: "Direct outreach from service rosters", langs: LANGS_CORE, messenger: "Paratransit operators and neighbourhood volunteers" }, true),
      dp(-90, "doh", "Confirm dialysis patients scheduled in the zone are relocated or rescheduled.", "Zone evacuation under way", null, true),
      dp(-45, "county", "Clear responders from the zone. Anyone not evacuated now shelters vertically in place.", "Wave arrival inside 45 minutes", { channel: "Wireless alert, radio", langs: LANGS_ALL, messenger: "County EMA" }, true),
      dp(240, "county", "Decide re-entry only after the wave series ends. Publish re-entry in the same languages as the evacuation order.", "PTWC cancellation", { channel: "Radio, TV, wireless alert, community networks", langs: LANGS_ALL, messenger: "County EMA" }),
    ],
  },

  wildfire: {
    n: "Wildfire", c: "#fb923c", unit: "h", from: -8 * H, to: 48 * H,
    lead: "Little notice, fast movement, and communities served by a single road. Fire also destroys the homes people would otherwise return to, so shelter demand does not fall after impact.",
    phases: [
      { t: -8 * H, n: "Red flag", ramp: 0, roles: [], note: "Dry, windy conditions. Nothing is burning yet." },
      { t: -6 * H, n: "Detection", ramp: 0.05, roles: [], note: "Fire detected; single-access communities identified." },
      { t: -3 * H, n: "Advisory", ramp: 0.3, roles: ["pre", "unknown"], note: "Evacuation advisory. Shelters open outside the smoke footprint." },
      { t: -90, n: "Assisted evacuation", ramp: 0.6, roles: ["pre", "unknown"], note: "Households that cannot self-evacuate." },
      { t: -30, n: "Mandatory", ramp: 0.9, roles: ["pre", "unknown"], note: "Mandatory evacuation; roads may already be cut." },
      { t: 0, n: "Fire arrival", ramp: 1, roles: ["refuge", "unknown"], note: "Fire reaches the community." },
      { t: 6 * H, n: "Shelter surge", ramp: 1, roles: ["post", "pre", "unknown"], note: "Reunification begins; shelter population peaks." },
      { t: 24 * H, n: "Sustained care", ramp: 1, roles: ["post", "unknown"], note: "Homes destroyed: demand holds rather than falling." },
    ],
    points: [
      dp(-8 * H, "county", "Pre-alert communities with a single access road. These are the ones that cannot be evacuated late.", "Red flag conditions", { channel: "Community networks, text, local radio", langs: LANGS_CORE, messenger: "County EMA and neighbourhood boards" }, true),
      dp(-6 * H, "state", "Push the AFN layer for the fire's likely run: who in the path is electricity-dependent, has no vehicle, or cannot move quickly.", "Fire detected", null, true),
      dp(-3 * H, "county", "Issue evacuation advisory and open shelters upwind of the smoke footprint — smoke makes a nominally safe shelter unusable for respiratory patients.", "Fire advancing toward populated area", { channel: "Wireless alert, sirens, radio, door-to-door", langs: LANGS_ALL, messenger: "County EMA with community messengers" }, true),
      dp(-90, "dot", "Assisted evacuation for no-vehicle and mobility-limited households. Consider contraflow on single-access roads before they are cut.", "Advisory in force", { channel: "Direct outreach, door-to-door", langs: LANGS_CORE, messenger: "Paratransit, fire crews, neighbours" }, true),
      dp(-30, "county", "Mandatory evacuation. Confirm nobody is relying on a road already closed by fire.", "Fire within 30 minutes of structures", { channel: "Wireless alert, door-to-door", langs: LANGS_ALL, messenger: "County EMA and police" }, true),
      dp(6 * H, "partner", "Stand up family reunification and begin casework. Fire separates households faster than any other hazard here.", "Shelter intake rising", { channel: "Shelter intake, hotline, community hubs", langs: LANGS_ALL, messenger: "Red Cross with community organisations" }, true),
      dp(24 * H, "state", "Plan for sustained sheltering: fire destroys housing stock, so congregate shelter demand does not decay the way it does after a storm.", "Damage assessment shows destroyed homes", null, true),
    ],
  },

  flood: {
    n: "Flood", c: "#38bdf8", unit: "h", from: -3 * D, to: 3 * D,
    lead: "Rising water cuts roads and stream crossings before it reaches homes. The window closes on the road network first.",
    phases: [
      { t: -3 * D, n: "Watch", ramp: 0, roles: [], note: "NWS flood watch. Review flood-zone AFN tracts." },
      { t: -2 * D, n: "Pre-positioning", ramp: 0.1, roles: [], note: "Confirm shelters outside the flood hazard area." },
      { t: -1 * D, n: "Warning", ramp: 0.35, roles: ["pre", "unknown"], note: "Evacuation advisory for low-lying areas." },
      { t: -12 * H, n: "Roads closing", ramp: 0.7, roles: ["pre", "unknown"], note: "Stream crossings become impassable." },
      { t: -6 * H, n: "Final movement", ramp: 0.9, roles: ["pre", "unknown"], note: "Last safe vehicle movement." },
      { t: 0, n: "Crest", ramp: 1, roles: ["refuge", "unknown"], note: "Peak water level." },
      { t: 12 * H, n: "Assessment", ramp: 1, roles: ["post", "refuge", "unknown"], note: "Cut-off communities identified." },
      { t: 2 * D, n: "Recovery", ramp: 0.7, roles: ["post", "unknown"], note: "Water recedes; shelters hold for flooded homes." },
    ],
    points: [
      dp(-3 * D, "state", "Review AFN population inside the FEMA flood hazard area and the 3.2 ft sea-level-rise coastal zone.", "NWS flood watch", null, true),
      dp(-2 * D, "county", "Confirm which shelters sit outside the flood hazard area. A shelter inside the zone is not a shelter.", "Watch continues", null, true),
      dp(-1 * D, "county", "Evacuation advisory for low-lying areas and communities beyond a stream crossing.", "Flood warning issued", { channel: "Wireless alert, radio, community networks", langs: LANGS_ALL, messenger: "County EMA" }, true),
      dp(-12 * H, "dot", "Move no-vehicle and mobility-limited households before stream crossings go under. Roads close hours before homes flood.", "Rising water on gauges", { channel: "Direct outreach", langs: LANGS_CORE, messenger: "Paratransit and county crews" }, true),
      dp(-6 * H, "county", "Close roads and confirm no community is relying on a crossing already under water.", "Crossings impassable", { channel: "Wireless alert, road signage", langs: LANGS_ALL, messenger: "County EMA and DOT" }),
      dp(12 * H, "county", "Identify communities cut off by water and plan resupply — medication and dialysis first.", "Crest passed", null, true),
    ],
  },
};

/* ---------------- time formatting ---------------- */

export function fmtOffset(min, unit) {
  const s = min < 0 ? "T−" : min > 0 ? "T+" : "T";
  const a = Math.abs(min);
  if (min === 0) return "T‑0";
  if (unit === "min" || a < 60) return `${s}${a} min`;
  if (a < 48 * 60) return `${s}${Math.round(a / 60)} h`;
  const d = Math.floor(a / 1440), h = Math.round((a % 1440) / 60);
  return h ? `${s}${d} d ${h} h` : `${s}${d} d`;
}

export const phaseAt = (sc, t) => sc.phases.reduce((acc, p) => (t >= p.t ? p : acc), sc.phases[0]);
export const pointsNear = (sc, t, windowMin) => sc.points.filter((p) => p.t <= t && p.t >= t - windowMin);
export const pointsNext = (sc, t, n = 3) => sc.points.filter((p) => p.t > t).slice(0, n);

/* ---------------- clock UI ---------------- */

const el = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/**
 * The clock. Hazard tabs, a phase axis with decision-point marks, a draggable playhead,
 * and a "what happens now" list. Calls onChange({ hazard, t, phase, ramp, roles }).
 */
export function createScenarioClock(host, { onChange = () => {}, hazard = "hurricane" } = {}) {
  let key = SCENARIOS[hazard] ? hazard : "hurricane";
  let sc = SCENARIOS[key];
  // Open on the first phase where shelters actually open. Starting at T-5d is narratively
  // tidy but lands the planner on a screen of zeroes, which reads as broken rather than early.
  const opening = (x) => (x.phases.find((p) => p.roles.length) || x.phases[0]).t;
  let t = opening(sc);
  let playing = false, raf = 0, last = 0;
  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

  host.classList.add("sc");
  host.innerHTML = `
    <div class="sc-top">
      <div class="sc-haz" role="tablist" aria-label="Hazard scenario"></div>
      <div class="sc-grow"></div>
      <button class="sc-btn sc-play" type="button" aria-label="Play the scenario">▶</button>
      <button class="sc-btn sc-rew" type="button" aria-label="Back to the start">⏮</button>
      <span class="sc-now" role="status"></span>
    </div>
    <div class="sc-axis" tabindex="0" role="slider" aria-label="Scenario time">
      <div class="sc-bands"></div>
      <div class="sc-marks"></div>
      <div class="sc-head"><i></i></div>
      <div class="sc-ticks"></div>
    </div>
    <div class="sc-body">
      <div class="sc-phase"></div>
      <ul class="sc-points"></ul>
    </div>`;

  const q = (s) => host.querySelector(s);
  const axis = q(".sc-axis"), bands = q(".sc-bands"), marks = q(".sc-marks"),
    head = q(".sc-head"), ticks = q(".sc-ticks"), nowEl = q(".sc-now"),
    phaseEl = q(".sc-phase"), ptsEl = q(".sc-points"), hazEl = q(".sc-haz");

  const frac = (v) => (v - sc.from) / (sc.to - sc.from);
  const fromX = (x) => sc.from + (sc.to - sc.from) * clamp(x, 0, 1);

  function buildHaz() {
    hazEl.textContent = "";
    for (const [k, s] of Object.entries(SCENARIOS)) {
      const b = el("button", "sc-tab", s.n);
      b.type = "button"; b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", k === key);
      b.style.setProperty("--hz", s.c);
      b.onclick = () => setHazard(k);
      hazEl.append(b);
    }
  }

  function buildAxis() {
    bands.textContent = ""; marks.textContent = ""; ticks.textContent = "";
    sc.phases.forEach((p, i) => {
      const next = sc.phases[i + 1]?.t ?? sc.to;
      const b = el("div", "sc-band");
      b.style.left = frac(p.t) * 100 + "%";
      b.style.width = (frac(next) - frac(p.t)) * 100 + "%";
      b.style.opacity = 0.18 + 0.5 * p.ramp;
      b.style.background = sc.c;
      b.title = `${p.n} · ${fmtOffset(p.t, sc.unit)}`;
      b.append(el("span", "sc-bname", p.n));
      bands.append(b);
    });
    fitLabels();
    // T-0 is the only absolute reference on the axis.
    const z = el("div", "sc-zero");
    z.style.left = frac(0) * 100 + "%";
    z.append(el("span", null, "IMPACT"));
    ticks.append(z);

    sc.points.forEach((p, i) => {
      const m = el("button", "sc-mark");
      m.type = "button";
      m.style.left = frac(p.t) * 100 + "%";
      m.style.setProperty("--oc", OWNERS[p.owner].c);
      m.dataset.afn = p.afn ? "1" : "0";
      m.title = `${fmtOffset(p.t, sc.unit)} · ${OWNERS[p.owner].n}: ${p.action}`;
      m.setAttribute("aria-label", m.title);
      m.onclick = (e) => { e.stopPropagation(); setT(p.t); };
      marks.append(m);
    });
  }

  /**
   * A phase band narrower than its own name renders as unreadable stubs ("A..", "M..").
   * Below that width the name is dropped entirely and the band keeps only its tooltip —
   * the colour ramp still carries the shape of the timeline, which is the point of the axis.
   */
  function fitLabels() {
    const w = axis.getBoundingClientRect().width || host.getBoundingClientRect().width;
    if (!w) return;
    [...bands.children].forEach((b) => {
      const px = (parseFloat(b.style.width) / 100) * w;
      b.classList.toggle("is-tight", px < 58);
    });
  }
  new ResizeObserver(fitLabels).observe(host);

  function renderNow() {
    const p = phaseAt(sc, t);
    head.style.left = frac(t) * 100 + "%";
    axis.setAttribute("aria-valuetext", `${fmtOffset(t, sc.unit)} · ${p.n}`);
    nowEl.textContent = fmtOffset(t, sc.unit);

    phaseEl.textContent = "";
    const h = el("div", "sc-ph");
    h.append(el("b", null, p.n));
    const r = el("div", "sc-ramp");
    r.innerHTML = `<span>Evacuation progress</span><i style="--p:${Math.round(p.ramp * 100)}%"></i><b>${Math.round(p.ramp * 100)}%</b>`;
    h.append(r);
    const open = p.roles.length
      ? `Shelter types open: ${p.roles.filter((x) => x !== "unknown").join(", ") || "role not stated"}`
      : "No shelters open yet at this point in the clock.";
    h.append(el("p", "sc-open", open));
    phaseEl.append(h);

    ptsEl.textContent = "";
    const live = pointsNear(sc, t, 6 * H).slice(-4).reverse();
    const next = pointsNext(sc, t, 2);
    const row = (p2, state) => {
      const li = el("li", "sc-pt " + state);
      const o = OWNERS[p2.owner];
      li.style.setProperty("--oc", o.c);
      li.append(el("span", "sc-pt-t", fmtOffset(p2.t, sc.unit)));
      const bd = el("div", "sc-pt-b");
      const hd = el("div", "sc-pt-h");
      hd.append(el("b", null, o.n), el("em", null, o.role));
      if (p2.afn) hd.append(el("span", "sc-afn", "AFN"));
      bd.append(hd, el("p", "sc-act", p2.action), el("p", "sc-trig", "Trigger: " + p2.trigger));
      if (p2.comms) {
        const c = el("div", "sc-comms");
        c.append(el("b", null, "Communication"), el("span", null, p2.comms.channel));
        if (p2.comms.messenger) c.append(el("span", "sc-msgr", "Voice: " + p2.comms.messenger));
        if (p2.comms.langs?.length) c.append(el("span", "sc-langs", p2.comms.langs.join(" · ")));
        bd.append(c);
      }
      li.append(bd);
      return li;
    };
    if (!live.length && !next.length) ptsEl.append(el("li", "sc-empty", "No decision points at this point in the clock."));
    live.forEach((p2) => ptsEl.append(row(p2, "is-live")));
    next.forEach((p2) => ptsEl.append(row(p2, "is-next")));

    onChange({ hazard: key, t, phase: p, ramp: p.ramp, roles: p.roles.length ? p.roles : null, scenario: sc });
  }

  function setT(v) { t = clamp(Math.round(v), sc.from, sc.to); renderNow(); }
  function setHazard(k) {
    if (!SCENARIOS[k]) return;
    key = k; sc = SCENARIOS[k]; t = opening(sc); stop();
    host.style.setProperty("--hz", sc.c);
    [...hazEl.children].forEach((b, i) => b.setAttribute("aria-selected", Object.keys(SCENARIOS)[i] === k));
    buildAxis(); renderNow();
  }

  // Drag and keyboard on the axis
  let dragging = false;
  const xf = (e) => { const r = axis.getBoundingClientRect(); return (e.clientX - r.left) / r.width; };
  axis.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".sc-mark")) return;
    dragging = true; axis.setPointerCapture(e.pointerId); stop(); setT(fromX(xf(e)));
  });
  axis.addEventListener("pointermove", (e) => { if (dragging) setT(fromX(xf(e))); });
  axis.addEventListener("pointerup", () => (dragging = false));
  axis.addEventListener("keydown", (e) => {
    const step = (sc.to - sc.from) / 40, big = (sc.to - sc.from) / 8;
    const k = { ArrowRight: step, ArrowLeft: -step, PageUp: big, PageDown: -big }[e.key];
    if (k != null) { e.preventDefault(); stop(); setT(t + k); }
    else if (e.key === "Home") { e.preventDefault(); stop(); setT(sc.from); }
    else if (e.key === "End") { e.preventDefault(); stop(); setT(sc.to); }
    else if (e.key === " ") { e.preventDefault(); playing ? stop() : play(); }
  });

  function tick(ts) {
    if (!playing) return;
    const dt = last ? ts - last : 16; last = ts;
    // Whole scenario plays in about 30 seconds regardless of its real duration.
    setT(t + ((sc.to - sc.from) / 30000) * dt);
    if (t >= sc.to) { stop(); return; }
    raf = requestAnimationFrame(tick);
  }
  function play() {
    if (REDUCED) { setT(sc.to); return; }
    if (t >= sc.to) t = sc.from;
    playing = true; last = 0; q(".sc-play").textContent = "❚❚";
    q(".sc-play").setAttribute("aria-label", "Pause the scenario");
    raf = requestAnimationFrame(tick);
  }
  function stop() {
    playing = false; cancelAnimationFrame(raf);
    q(".sc-play").textContent = "▶"; q(".sc-play").setAttribute("aria-label", "Play the scenario");
  }
  q(".sc-play").onclick = () => (playing ? stop() : play());
  q(".sc-rew").onclick = () => { stop(); setT(sc.from); };
  // Play always runs the whole clock, even when we opened part-way through it.

  buildHaz(); host.style.setProperty("--hz", sc.c); buildAxis(); renderNow();

  return {
    get hazard() { return key; },
    get t() { return t; },
    get phase() { return phaseAt(sc, t); },
    setHazard, setT, redraw: renderNow, stop,
  };
}
