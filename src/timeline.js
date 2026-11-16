/* AllReady timeline. MIT licensed. No dependencies.
   A zoomable time axis over the last year (configurable). Hawaiʻi has no daylight saving time, so every label
   is HST = UTC-10 with no calendar surprises.
   - Zoom: 1D / 1W / 1M / 3M / 1Y buttons, mouse wheel or trackpad pinch (zooms around the pointer), double-click, + and - keys.
   - Pan: drag the lanes, shift+wheel or horizontal scroll, PageUp / PageDown.
   - Move the time: click anywhere, drag the ruler or the playhead, arrow keys (shift = 10 steps), the date box,
     or click an event mark. End (or LIVE) returns to now.
   - Play replays forward at a step that follows the zoom (15 min at 1 day, 1 day at 1 year).
   - Trail sets how much history the map shows behind the playhead (quakes in the last 7 days, say). */

const MIN = 6e4, HR = 36e5, DAY = 864e5, OFF = -10 * HR; // HST
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ZOOMS = [["1D", DAY], ["1W", 7 * DAY], ["1M", 30 * DAY], ["3M", 91 * DAY], ["1Y", 365 * DAY]];
const TRAILS = [["1 hour", HR], ["1 day", DAY], ["7 days", 7 * DAY], ["30 days", 30 * DAY], ["Whole view", 0]];
const STEPS = [5 * MIN, 15 * MIN, HR, 3 * HR, 6 * HR, 12 * HR, DAY, 2 * DAY, 7 * DAY];
const RULER = 24;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// The HST wall clock of instant t, read with getUTC* methods.
const wall = (t) => new Date(t + OFF);
const fmtFull = (t) => { const d = wall(t); let h = d.getUTCHours(); const ap = h < 12 ? "AM" : "PM"; h = h % 12 || 12; return `${WK[d.getUTCDay()]} ${MON[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()} · ${h}:${String(d.getUTCMinutes()).padStart(2, "0")} ${ap} HST`; };
const fmtSpan = (ms) => (ms >= 2 * DAY ? Math.round(ms / DAY) + " days" : ms >= 2 * HR ? Math.round(ms / HR) + " hours" : Math.round(ms / MIN) + " min");
const isoDayHST = (t) => wall(t).toISOString().slice(0, 10);

function ticks(v0, v1, px) { // pick major/minor units so labels never collide
  const span = v1 - v0, perPx = span / px;
  const fixed = [15 * MIN, 30 * MIN, HR, 3 * HR, 6 * HR, 12 * HR, DAY, 2 * DAY, 7 * DAY];
  const cand = [...fixed.map((u) => ({ u })), { mo: 1 }, { mo: 3 }, { mo: 6 }, { mo: 12 }];
  const len = (c) => c.u || c.mo * 30.4 * DAY;
  const major = cand.find((c) => len(c) / perPx >= 92) || cand[cand.length - 1];
  const mi = cand.indexOf(major);
  const minor = [...cand.slice(0, mi)].reverse().find((c) => len(c) / perPx >= 9 && len(major) % (c.u || 1) === 0) || null;
  return { major: list(major, v0, v1), minor: minor ? list(minor, v0, v1) : [], unit: major };
}
function list(c, v0, v1) {
  const out = [];
  if (c.u) { for (let t = Math.floor((v0 + OFF) / c.u) * c.u - OFF; t <= v1; t += c.u) if (t >= v0) out.push(t); return out; }
  const d = wall(v0); let y = d.getUTCFullYear(), m = Math.floor(d.getUTCMonth() / c.mo) * c.mo;
  for (let i = 0; i < 400; i++) { const t = Date.UTC(y, m, 1) - OFF; if (t > v1) break; if (t >= v0) out.push(t); m += c.mo; if (m > 11) { y += Math.floor(m / 12); m %= 12; } }
  return out;
}
function label(t, unit) {
  const d = wall(t);
  if (unit.mo) return d.getUTCMonth() === 0 || unit.mo >= 12 ? `${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}` : MON[d.getUTCMonth()];
  if (unit.u >= DAY) return `${MON[d.getUTCMonth()]} ${d.getUTCDate()}`;
  const h = d.getUTCHours(), m = d.getUTCMinutes();
  if (!h && !m) return `${WK[d.getUTCDay()]} ${MON[d.getUTCMonth()]} ${d.getUTCDate()}`;
  return `${h % 12 || 12}${m ? ":" + String(m).padStart(2, "0") : ""} ${h < 12 ? "AM" : "PM"}`;
}
export const stepFor = (span) => STEPS.find((s) => s >= span / 140) || STEPS[STEPS.length - 1];

export function createTimeline(host, { historyDays = 365, trail = 7 * DAY, span = 14 * DAY, onChange = () => {} } = {}) {
  const now = () => Date.now();
  const st = { live: true, t: now(), v0: 0, v1: 0, trail, playing: null, speed: 1, lanes: [], marks: [] };
  const lo = () => now() - historyDays * DAY;
  st.v1 = now() + span * 0.04; st.v0 = st.v1 - span;

  host.classList.add("tl2");
  host.innerHTML = `
  <div class="tl-bar" role="toolbar" aria-label="Timeline controls">
    <div class="tl-tr">
      <button type="button" class="tl-b" data-act="back" aria-label="Step back" title="Step back (←)">‹</button>
      <button type="button" class="tl-b tl-play" data-act="play" aria-label="Play replay" title="Play / pause (space)">▶</button>
      <button type="button" class="tl-b" data-act="fwd" aria-label="Step forward" title="Step forward (→)">›</button>
      <button type="button" class="tl-live on" data-act="live" aria-pressed="true" title="Jump to now (End)">LIVE</button>
    </div>
    <output class="tl-now" aria-live="polite"></output>
    <div class="tl-zoom" role="group" aria-label="Zoom">${ZOOMS.map(([n, ms]) => `<button type="button" data-span="${ms}" aria-pressed="false">${n}</button>`).join("")}</div>
    <label class="tl-f">Trail <select data-k="trail" aria-label="How much history the map shows behind the playhead">${TRAILS.map(([n, ms]) => `<option value="${ms}">${n}</option>`).join("")}</select></label>
    <select class="tl-sel" data-k="speed" aria-label="Replay speed" title="Replay speed"><option value="1">1×</option><option value="3">3×</option><option value="8">8×</option></select>
    <input class="tl-sel" type="date" data-k="date" aria-label="Go to date" title="Go to date">
  </div>
  <div class="tl-track" tabindex="0" role="slider" aria-label="Timeline. Arrow keys move the time, plus and minus zoom, End returns to live.">
    <canvas></canvas>
  </div>
  <p class="tl-help"><span class="tl-span"></span> visible · drag to pan · scroll to zoom · click to set the time</p>`;
  const $ = (s) => host.querySelector(s);
  const cv = $("canvas"), tr = $(".tl-track"), ctx = cv.getContext("2d");
  $('[data-k="trail"]').value = String(trail);
  const dateIn = $('[data-k="date"]');
  let W = 0, H = 0, dpr = 1, raf = 0, emitRaf = 0;

  // ---------- geometry ----------
  const x2t = (x) => st.v0 + (x / W) * (st.v1 - st.v0);
  const t2x = (t) => ((t - st.v0) / (st.v1 - st.v0)) * W;
  function setView(v0, v1) {
    const minSpan = 2 * HR, maxSpan = historyDays * DAY + 2 * DAY;
    let s = clamp(v1 - v0, minSpan, maxSpan);
    const mid = (v0 + v1) / 2; v0 = mid - s / 2; v1 = mid + s / 2;
    const L = lo() - s * 0.02, R = now() + s * 0.04;
    if (v0 < L) { v1 += L - v0; v0 = L; } if (v1 > R) { v0 -= v1 - R; v1 = R; }
    st.v0 = Math.max(v0, L); st.v1 = v1; draw();
  }
  function zoomAt(x, f) { const t = x2t(x); setView(t - (t - st.v0) * f, t + (st.v1 - t) * f); }
  function setSpan(s) {
    const anchor = st.live ? now() : st.t, frac = st.live ? 0.92 : 0.5;
    setView(anchor - s * frac, anchor + s * (1 - frac));
  }
  function keepVisible() {
    const s = st.v1 - st.v0;
    if (st.t > st.v1 - s * 0.06 || st.t < st.v0) setView(st.t - s * 0.75, st.t + s * 0.25);
  }

  // ---------- time ----------
  function setTime(t, { live = false, quiet = false } = {}) {
    const n = now();
    st.live = live || t >= n - 60e3; st.t = st.live ? n : clamp(t, lo(), n);
    keepVisible(); draw(); syncUI();
    if (!quiet) emit();
  }
  const step = () => stepFor(st.v1 - st.v0);
  function nudge(k) { const s = step(); const base = st.live ? now() : st.t; setTime(Math.round((base + k * s - OFF) / s) * s + OFF); }
  function trailMs() { return st.trail || st.v1 - st.v0; }
  function emit() {
    cancelAnimationFrame(emitRaf);
    emitRaf = requestAnimationFrame(() => onChange({ live: st.live, t: st.t, from: st.t - trailMs(), to: st.t, day: isoDayHST(st.t), utcDay: new Date(st.t).toISOString().slice(0, 10), trail: trailMs(), view: [st.v0, st.v1] }));
  }
  function syncUI() {
    $(".tl-now").textContent = (st.live ? "Live · " : "Replay · ") + fmtFull(st.t);
    const lb = $('[data-act="live"]'); lb.classList.toggle("on", st.live); lb.setAttribute("aria-pressed", st.live);
    const span = st.v1 - st.v0;
    host.querySelectorAll("[data-span]").forEach((b) => b.setAttribute("aria-pressed", Math.abs(+b.dataset.span - span) / span < 0.08));
    $(".tl-span").textContent = fmtSpan(span) + " (step " + fmtSpan(step()) + ")";
    tr.setAttribute("aria-valuemin", lo()); tr.setAttribute("aria-valuemax", now()); tr.setAttribute("aria-valuenow", st.t);
    tr.setAttribute("aria-valuetext", (st.live ? "Live, " : "") + fmtFull(st.t));
    dateIn.min = isoDayHST(lo()); dateIn.max = isoDayHST(now());
    if (document.activeElement !== dateIn) dateIn.value = isoDayHST(st.t);
  }

  // ---------- playback ----------
  function play() {
    if (st.playing) return stop();
    if (st.live) { const s = st.v1 - st.v0; setTime(now() - s * 0.8); }
    $(".tl-play").textContent = "❚❚"; $(".tl-play").setAttribute("aria-label", "Pause replay");
    st.playing = setInterval(() => { if (st.t + step() >= now()) { stop(); setTime(now(), { live: true }); } else setTime(st.t + step()); }, 650 / st.speed);
  }
  function stop() { clearInterval(st.playing); st.playing = null; $(".tl-play").textContent = "▶"; $(".tl-play").setAttribute("aria-label", "Play replay"); }

  // ---------- drawing ----------
  const css = (n, d) => getComputedStyle(host).getPropertyValue(n).trim() || d;
  function draw() { cancelAnimationFrame(raf); raf = requestAnimationFrame(paint); }
  function paint() {
    if (!W || !H) return;
    const C = { fg: css("--cream", "#f3ead6"), dim: "rgba(243,234,214,.55)", faint: "rgba(243,234,214,.16)", red: css("--red", "#e4572e"), bg: "rgba(3,8,18,.0)" };
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.font = "500 10.5px " + (css("--mono", "monospace") || "monospace"); ctx.textBaseline = "middle";
    const n = now(), xNow = t2x(n), xLo = t2x(lo());
    // outside the history window: hatched
    ctx.fillStyle = "rgba(243,234,214,.05)";
    if (xNow < W) ctx.fillRect(xNow, 0, W - xNow, H);
    if (xLo > 0) ctx.fillRect(0, 0, xLo, H);
    // ruler
    const tk = ticks(st.v0, st.v1, W);
    ctx.fillStyle = "rgba(243,234,214,.04)"; ctx.fillRect(0, 0, W, RULER);
    ctx.strokeStyle = C.faint; ctx.lineWidth = 1;
    ctx.beginPath(); for (const t of tk.minor) { const x = Math.round(t2x(t)) + 0.5; ctx.moveTo(x, RULER - 5); ctx.lineTo(x, RULER); } ctx.stroke();
    ctx.beginPath(); for (const t of tk.major) { const x = Math.round(t2x(t)) + 0.5; ctx.moveTo(x, 0); ctx.lineTo(x, H); } ctx.strokeStyle = "rgba(243,234,214,.09)"; ctx.stroke();
    ctx.fillStyle = C.dim; ctx.textAlign = "left";
    for (const t of tk.major) ctx.fillText(label(t, tk.unit), Math.round(t2x(t)) + 5, RULER / 2);
    ctx.fillStyle = C.faint; ctx.fillRect(0, RULER - 1, W, 1);
    // trail band
    const tx1 = t2x(st.t), tx0 = t2x(st.t - trailMs());
    ctx.fillStyle = "rgba(228,87,46,.10)"; ctx.fillRect(Math.max(0, tx0), RULER, Math.max(0, tx1 - Math.max(0, tx0)), H - RULER);
    // lanes
    st.marks = [];
    const lanes = st.lanes, lh = lanes.length ? (H - RULER) / lanes.length : 0;
    lanes.forEach((ln, i) => {
      const y0 = RULER + i * lh, mid = y0 + lh / 2;
      if (i) { ctx.fillStyle = C.faint; ctx.fillRect(0, y0, W, 1); }
      if (ln.events?.length) {
        const B = Math.max(40, Math.floor(W / 3)), bw = W / B, cnt = new Float32Array(B);
        for (const e of ln.events) { if (e.t < st.v0 || e.t > st.v1) continue; cnt[Math.min(B - 1, Math.floor(((e.t - st.v0) / (st.v1 - st.v0)) * B))]++; }
        let mx = 0; for (const c of cnt) mx = Math.max(mx, c);
        ctx.fillStyle = ln.color + "99";
        for (let b = 0; b < B; b++) if (cnt[b]) { const h = Math.max(2, Math.sqrt(cnt[b] / mx) * (lh - 10)); ctx.fillRect(b * bw, y0 + lh - 3 - h, Math.max(1, bw - 0.5), h); }
        for (const e of ln.events) {
          if (e.v < (ln.markMin ?? Infinity) || e.t < st.v0 || e.t > st.v1) continue;
          const x = t2x(e.t), r = clamp((e.v - 3) * 2.2, 2.5, 9);
          ctx.beginPath(); ctx.arc(x, mid - 2, r, 0, 7); ctx.fillStyle = ln.color; ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.stroke();
          st.marks.push({ x, y: mid - 2, r: r + 3, t: e.t, label: e.label });
        }
      }
      if (ln.spans?.length) {
        ln.spans.forEach((s, k) => {
          const a = Math.max(0, t2x(s.t0)), b = Math.min(W, t2x(s.t1 || n)); if (b < 0 || a > W) return;
          const yy = y0 + 6 + (k % 3) * Math.max(5, (lh - 14) / 3);
          ctx.fillStyle = (s.color || ln.color) + "cc"; ctx.fillRect(a, yy, Math.max(3, b - a), Math.max(4, (lh - 14) / 3 - 2));
          st.marks.push({ x: a + 2, y: yy + 3, r: 7, t: s.t0, label: s.label });
        });
      }
      // lane label on a dark chip so bars never hide it
      const txt = ln.label + (ln.note ? " · " + ln.note : "");
      ctx.font = "500 10px " + (css("--mono", "monospace") || "monospace");
      const w = ctx.measureText(txt).width + 10;
      ctx.fillStyle = "rgba(7,16,31,.85)"; ctx.fillRect(4, y0 + 3, w, 15);
      ctx.fillStyle = ln.color; ctx.fillRect(4, y0 + 3, 2, 15);
      ctx.fillStyle = C.dim; ctx.textAlign = "left"; ctx.fillText(txt, 10, y0 + 10.5);
    });
    // now line
    if (xNow >= 0 && xNow <= W) { ctx.fillStyle = "rgba(111,207,151,.7)"; ctx.fillRect(Math.round(xNow), 0, 1, H); }
    // playhead
    if (tx1 >= -2 && tx1 <= W + 2) {
      const x = Math.round(tx1) + 0.5, col = st.live ? "#ff6b57" : C.red;
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, RULER - 2); ctx.lineTo(x, H); ctx.stroke();
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x - 6, 0); ctx.lineTo(x + 6, 0); ctx.lineTo(x + 6, RULER - 8); ctx.lineTo(x, RULER - 2); ctx.lineTo(x - 6, RULER - 8); ctx.closePath(); ctx.fill();
    }
  }
  function resize() {
    const r = tr.getBoundingClientRect(); dpr = Math.min(devicePixelRatio || 1, 2);
    W = Math.max(0, r.width); H = Math.max(0, r.height);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + "px"; cv.style.height = H + "px";
    paint(); syncUI();
  }
  new ResizeObserver(resize).observe(tr);

  // ---------- pointer ----------
  let pd = null;
  tr.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return; tr.focus({ preventScroll: true });
    const r = tr.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const scrub = y < RULER || Math.abs(x - t2x(st.t)) < 7;
    pd = { x0: e.clientX, v0: st.v0, v1: st.v1, scrub, moved: false, id: e.pointerId };
    tr.setPointerCapture(e.pointerId);
    if (scrub) { stop(); setTime(x2t(x)); }
  });
  tr.addEventListener("pointermove", (e) => {
    const r = tr.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    if (!pd) { const m = st.marks.find((m) => Math.hypot(m.x - x, m.y - y) < m.r); tr.title = m ? m.label + " · " + fmtFull(m.t) : ""; tr.style.cursor = y < RULER ? "ew-resize" : m ? "pointer" : "grab"; return; }
    const dx = e.clientX - pd.x0; if (Math.abs(dx) > 3) pd.moved = true;
    if (pd.scrub) setTime(x2t(x));
    else if (pd.moved) { const dt = (dx / W) * (pd.v1 - pd.v0); setView(pd.v0 - dt, pd.v1 - dt); syncUI(); tr.style.cursor = "grabbing"; }
  });
  tr.addEventListener("pointerup", (e) => {
    if (!pd) return; const r = tr.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    if (!pd.scrub && !pd.moved) { stop(); const m = st.marks.find((m) => Math.hypot(m.x - x, m.y - y) < m.r); setTime(m ? m.t : x2t(x)); }
    pd = null; tr.style.cursor = "grab";
  });
  tr.addEventListener("dblclick", (e) => { const r = tr.getBoundingClientRect(); zoomAt(e.clientX - r.left, 0.5); syncUI(); });
  tr.addEventListener("wheel", (e) => {
    e.preventDefault(); const r = tr.getBoundingClientRect(), x = e.clientX - r.left;
    if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) { const d = (e.shiftKey ? e.deltaY : e.deltaX) / W * (st.v1 - st.v0); setView(st.v0 + d, st.v1 + d); }
    else zoomAt(x, Math.exp(clamp(e.deltaY, -120, 120) * (e.ctrlKey ? 0.01 : 0.0025)));
    syncUI();
  }, { passive: false });
  tr.addEventListener("keydown", (e) => {
    const s = st.v1 - st.v0, k = e.key;
    if (k === "ArrowRight" || k === "ArrowLeft") { e.preventDefault(); stop(); nudge((k === "ArrowRight" ? 1 : -1) * (e.shiftKey ? 10 : 1)); }
    else if (k === "+" || k === "=") { e.preventDefault(); zoomAt(t2x(st.t), 0.6); syncUI(); }
    else if (k === "-" || k === "_") { e.preventDefault(); zoomAt(t2x(st.t), 1 / 0.6); syncUI(); }
    else if (k === "PageUp" || k === "PageDown") { e.preventDefault(); const d = (k === "PageUp" ? -0.8 : 0.8) * s; setView(st.v0 + d, st.v1 + d); syncUI(); }
    else if (k === "Home") { e.preventDefault(); stop(); setSpan(s); setTime(lo()); }
    else if (k === "End") { e.preventDefault(); stop(); setTime(now(), { live: true }); }
    else if (k === " ") { e.preventDefault(); play(); }
  });

  // ---------- toolbar ----------
  host.querySelector(".tl-bar").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.span) { setSpan(+b.dataset.span); syncUI(); return; }
    const a = b.dataset.act;
    if (a === "play") play(); else if (a === "back") { stop(); nudge(-1); } else if (a === "fwd") { stop(); nudge(1); }
    else if (a === "live") { stop(); setTime(now(), { live: true }); const s = st.v1 - st.v0; setView(now() - s * 0.92, now() + s * 0.08); }
  });
  host.querySelector(".tl-bar").addEventListener("change", (e) => {
    const k = e.target.dataset.k;
    if (k === "trail") { st.trail = +e.target.value; draw(); emit(); }
    else if (k === "speed") { st.speed = +e.target.value; if (st.playing) { stop(); play(); } }
    else if (k === "date" && e.target.value) { stop(); const [y, m, d] = e.target.value.split("-").map(Number); const t = Date.UTC(y, m - 1, d, 12) - OFF; const s = Math.max(st.v1 - st.v0, DAY); setTime(t); setView(t - s / 2, t + s / 2); syncUI(); }
  });

  // live mode follows the clock
  setInterval(() => {
    if (!st.live) return;
    const was = st.t; st.t = now();
    if (was >= st.v0 && was <= st.v1) { st.v0 += st.t - was; st.v1 += st.t - was; } // slide the view if "now" was on screen
    syncUI(); draw(); if (isoDayHST(was) !== isoDayHST(st.t)) emit();
  }, 30e3);

  resize();
  return {
    setLanes(l) { st.lanes = l; draw(); },
    setTime, goLive: () => setTime(now(), { live: true }), stop,
    get state() { return { live: st.live, t: st.t, from: st.t - trailMs(), to: st.t, view: [st.v0, st.v1] }; },
    redraw: () => { resize(); },
  };
}
