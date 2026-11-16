/* AllReady — AI assistant (browser side). MIT licensed.

   A chat panel that can read the map. Every question is sent with a fresh snapshot of what
   is on screen — event clock, area, alerts, shelters, gaps, and the planner's own markup —
   so "summarise this" means this, now, not a paragraph somebody wrote last week.

   The model is reached through this app's own /api/chat endpoint (see server/llm.js), so no
   API key is ever in the browser. With no server or no model configured, the panel says so
   plainly instead of pretending.

   Output is rendered as text nodes only — never innerHTML — so nothing a model (or a note
   pasted into markup) says can inject markup into the page. */

const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };

let healthP = null;
/** { ai, model, provider } — cached for a minute so the UI can ask freely. */
export function health(force = false) {
  if (!healthP || force) {
    healthP = fetch("api/health", { headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : { ai: false, offline: true }))
      .catch(() => ({ ai: false, offline: true }));
    setTimeout(() => (healthP = null), 60000);
  }
  return healthP;
}

/** Ask the model. Streams text into onText; resolves with the full answer. */
export async function ask({ messages, context, onText = () => {}, signal }) {
  const r = await fetch("api/chat", {
    method: "POST", signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, context }),
  });
  if (!r.ok) {
    let msg = "The assistant is not available.";
    try { msg = (await r.json()).error || msg; } catch { /* static hosting returns HTML here */ }
    if (r.status === 404 || r.status === 405) msg = "No assistant server is running here. Start the app with “npm start” (or “npm run dev”) and a model configured — see the README.";
    throw new Error(msg);
  }
  const reader = r.body.getReader(), dec = new TextDecoder();
  let full = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const t = dec.decode(value, { stream: true });
    full += t; onText(t, full);
  }
  return full;
}

/**
 * Minimal, safe formatting: paragraphs, "- " bullets and **bold**. Built from text nodes.
 */
export function renderText(host, text) {
  host.textContent = "";
  let ul = null;
  const inline = (parent, s) => {
    s.split(/(\*\*[^*]+\*\*)/g).forEach((part) => {
      if (/^\*\*[^*]+\*\*$/.test(part)) parent.append(el("strong", null, part.slice(2, -2)));
      else if (part) parent.append(document.createTextNode(part));
    });
  };
  for (const raw of String(text).split("\n")) {
    const line = raw.trimEnd();
    const b = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (b) { if (!ul) { ul = el("ul"); host.append(ul); } const li = el("li"); inline(li, b[1]); ul.append(li); continue; }
    ul = null;
    if (!line.trim()) continue;
    const h = line.match(/^#{1,4}\s+(.*)$/);
    const p = el(h ? "h5" : "p"); inline(p, h ? h[1] : line); host.append(p);
  }
}

/**
 * The chat panel. getContext() must return the current snapshot (a plain object).
 * `prompts` are one-click starters; `intro` is the empty-state line.
 */
export function createAssistant(host, { getContext, prompts = [], intro = "" }) {
  host.classList.add("ai");
  host.textContent = "";
  const status = el("div", "ai-status");
  const log = el("div", "ai-log"); log.setAttribute("aria-live", "polite");
  const chips = el("div", "ai-chips");
  const form = el("form", "ai-form");
  const ta = el("textarea"); ta.rows = 2; ta.placeholder = "Ask about what is on the map…"; ta.setAttribute("aria-label", "Ask the assistant");
  const send = el("button", "btn", "Ask"); send.type = "submit";
  form.append(ta, send);
  host.append(status, log, chips, form);

  const history = []; // { role, content }
  let busy = null;

  function bubble(role, text) {
    const b = el("div", "ai-msg ai-" + role);
    if (role === "user") b.textContent = text; else renderText(b, text);
    log.append(b); log.scrollTop = log.scrollHeight;
    return b;
  }
  function empty() {
    if (history.length) return;
    log.textContent = "";
    log.append(el("p", "ai-empty", intro));
  }

  async function refreshStatus(force) {
    const h = await health(force);
    status.textContent = h.ai ? `Connected · ${h.model} · ${h.provider}` : h.hint ? h.hint : h.offline ? "Assistant offline — no server here. See README → “Turn on the assistant”." : `No model answering (${h.model} · ${h.provider}). Start Ollama or set LLM_API_KEY, then retry.`;
    status.dataset.on = h.ai ? "1" : "0";
    return h;
  }

  async function run(question) {
    if (busy || !question.trim()) return;
    if (!history.length) log.textContent = "";
    history.push({ role: "user", content: question.trim() });
    bubble("user", question.trim());
    const out = bubble("assistant", "…");
    out.classList.add("is-streaming");
    const ac = new AbortController(); busy = ac; send.textContent = "Stop";
    try {
      // A fresh snapshot per question: the map may have changed since the last one.
      const full = await ask({ messages: history.slice(-12), context: getContext(), signal: ac.signal, onText: (_, all) => { renderText(out, all); log.scrollTop = log.scrollHeight; } });
      history.push({ role: "assistant", content: full });
      if (!full.trim()) renderText(out, "The model returned nothing.");
    } catch (e) {
      history.pop();
      out.classList.add("is-error");
      out.textContent = e.name === "AbortError" ? "Stopped." : e.message;
      refreshStatus(true);
    } finally { out.classList.remove("is-streaming"); busy = null; send.textContent = "Ask"; }
  }

  form.addEventListener("submit", (e) => { e.preventDefault(); if (busy) { busy.abort(); return; } const q = ta.value; ta.value = ""; run(q); });
  ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
  for (const p of prompts) { const b = el("button", "ai-chip", p.label); b.type = "button"; b.onclick = () => run(p.q); chips.append(b); }
  const clear = el("button", "ai-chip ai-clear", "Clear"); clear.type = "button";
  clear.onclick = () => { if (busy) busy.abort(); history.length = 0; empty(); };
  chips.append(clear);

  empty(); refreshStatus();
  return { ask: run, refreshStatus, get busy() { return !!busy; } };
}
