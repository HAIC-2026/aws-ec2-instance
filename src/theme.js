/* AllReady — light/dark theme. MIT licensed. Shared by the map page and the Insights page.

   Three states, not two: "system" follows the operating system and is the default, because
   a planner working a night shift and a planner in a sunlit EOC want different things and
   neither should have to ask. An explicit choice is remembered. */

const KEY = "allready.theme";
const MODES = ["system", "light", "dark"];
const mq = matchMedia("(prefers-color-scheme: dark)");
const subs = new Set();

let mode = "system";
try { const v = localStorage.getItem(KEY); if (MODES.includes(v)) mode = v; } catch {}

export const resolved = () => (mode === "system" ? (mq.matches ? "dark" : "light") : mode);
export const getMode = () => mode;

function paint() {
  const r = resolved();
  document.documentElement.setAttribute("data-theme", r);
  document.documentElement.style.colorScheme = r;
  subs.forEach((f) => f(r, mode));
}

export function setMode(m) {
  mode = MODES.includes(m) ? m : "system";
  try { localStorage.setItem(KEY, mode); } catch {}
  paint();
}

export const onTheme = (f) => { subs.add(f); return () => subs.delete(f); };

mq.addEventListener("change", () => { if (mode === "system") paint(); });
paint();

const SUN = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';
const MOON = '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/>';
const AUTO = '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" stroke="none"/>';

/**
 * Cycles system → light → dark → system. The icon shows what you would GET, and the
 * label says which of the three you are actually in, so "auto" never looks like a bug.
 */
export function mountThemeToggle(host) {
  if (!host) return;
  const b = document.createElement("button");
  b.type = "button";
  b.className = "ibtn";
  host.replaceWith(b);

  const draw = () => {
    const r = resolved();
    const icon = mode === "system" ? AUTO : r === "dark" ? MOON : SUN;
    b.innerHTML = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon}</svg>`;
    const label = mode === "system" ? `Theme: follows your system (${r})` : `Theme: ${mode}`;
    b.setAttribute("aria-label", label + ". Click to change.");
    b.title = label;
  };

  b.addEventListener("click", () => setMode(MODES[(MODES.indexOf(mode) + 1) % MODES.length]));
  onTheme(draw);
  draw();
  return b;
}
