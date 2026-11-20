/* AllReady — dated snapshot of every county's public shelter list. MIT licensed.
   node scripts/snapshot-shelters.mjs

   The app reads shelters live. This snapshot is the last line of fallback, used only when a
   county's feed does not answer AND this browser has no copy of its own: the page then shows
   the snapshot with its date instead of an empty county. Facility records only — the same
   whitelisted fields the live loader requests; FEMA's point-of-contact fields are never read. */
import { writeFile } from "node:fs/promises";
import { COUNTIES } from "../src/shelters.js";

const out = { generated: new Date().toISOString(), note: "Public facility records from each county's feed (FEMA National Shelter System for Maui). Fallback only; the app reads live first.", counties: {} };
for (const c of COUNTIES) {
  try { const rows = await c.load(); out.counties[c.fips] = rows; console.log(c.short, rows.length, "sites"); }
  catch (e) { console.log(c.short, "FAILED:", e.message); }
}
await writeFile(new URL("../public/data/shelters-snapshot.json", import.meta.url), JSON.stringify(out) + "\n");
console.log("wrote public/data/shelters-snapshot.json");
