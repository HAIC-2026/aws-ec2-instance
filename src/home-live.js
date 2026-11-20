/* AllReady — live figures for the home page. MIT licensed.
   The landing page states nothing it did not just read: island totals come from the census
   tracts whose centre falls on that island, shelters from the counties' live feeds, and the
   status line from National Weather Service alerts in force. */

import { fetchSVI, rankTracts } from "./svi.js";
import { loadShelters } from "./shelters.js";
import { loadLiveAlerts, liveEvent, stamp } from "./live.js";

// [west, south, east, north] — generous boxes around each island; none overlap.
const BOX = {
  niihau: [-160.35, 21.70, -159.98, 22.10], kauai: [-159.85, 21.80, -159.20, 22.30],
  oahu: [-158.35, 21.20, -157.60, 21.75], molokai: [-157.40, 21.02, -156.68, 21.25],
  lanai: [-157.10, 20.70, -156.78, 20.96], kahoolawe: [-156.74, 20.47, -156.50, 20.62],
  maui: [-156.72, 20.55, -155.95, 21.06], hawaii: [-156.15, 18.85, -154.75, 20.32],
};
const inBox = (b, x, y) => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3];
const fmt = (n) => Math.round(n).toLocaleString("en-US");

export async function loadHomeFigures() {
  const status = document.getElementById("liveStatus");
  const [tr, sh, al] = await Promise.allSettled([fetchSVI({ geometry: false }).then(rankTracts), loadShelters(), loadLiveAlerts()]);
  const tracts = tr.status === "fulfilled" ? tr.value : null;
  const shelters = sh.status === "fulfilled" ? sh.value.shelters : null;

  for (const sec of document.querySelectorAll("[data-island]")) {
    const b = BOX[sec.dataset.island];
    const set = (k, v) => { const n = sec.querySelector(`[data-f="${k}"]`); if (n) n.textContent = v; };
    const T = tracts ? tracts.filter((t) => t._centroid && inBox(b, t._centroid[0], t._centroid[1])) : null;
    const S = shelters ? shelters.filter((s) => inBox(b, s.lon, s.lat)) : null;
    const sum = (k) => T.reduce((a, t) => a + (t[k] || 0), 0);
    if (!T) ["pop", "dis", "a65", "lep", "nov"].forEach((k) => set(k, "unavailable"));
    else if (!T.length) { ["pop", "dis", "a65", "lep", "nov"].forEach((k) => set(k, "—")); set("note", "No census tract is centred on this island, so no separate resident figures are published for it."); }
    else { set("pop", fmt(sum("pop"))); set("dis", fmt(sum("disability"))); set("a65", fmt(sum("age_65_plus"))); set("lep", fmt(sum("limited_english"))); set("nov", fmt(sum("no_vehicle"))); }
    if (!S) ["shel", "open", "cap"].forEach((k) => set(k, "unavailable"));
    else {
      set("shel", fmt(S.length)); set("open", fmt(S.filter((x) => x.status === "open").length));
      set("cap", S.some((x) => x.capacity != null) ? fmt(S.reduce((a, x) => a + (x.capacity || 0), 0)) : S.length ? "not published" : "—");
      if (!S.length && T?.length && ["maui", "molokai", "lanai"].includes(sec.dataset.island)) set("note", "No shelter sites could be read for this island right now.");
    }
  }

  if (status) {
    const alerts = al.status === "fulfilled" ? al.value : null;
    const ev = alerts ? liveEvent(alerts) : null;
    const parts = [];
    parts.push(!alerts ? "NWS alerts unavailable" : ev ? `Live: ${ev.label} in force` : `Live: no hurricane, tsunami, flood or fire-weather alert in force${alerts.length ? ` (${alerts.length} other alert${alerts.length === 1 ? "" : "s"})` : ""}`);
    if (shelters) parts.push(`${fmt(shelters.length)} shelters on record, ${fmt(shelters.filter((x) => x.status === "open").length)} open now`);
    parts.push(`read ${stamp(Date.now())}`);
    status.textContent = parts.join(" · ");
    status.dataset.on = ev ? "event" : "ok";
  }
}
