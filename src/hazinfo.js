/* AllReady — what a hazard zone means, in plain words. MIT licensed.

   The flood layer is a picture FEMA draws, so clicking it has to ask FEMA what is under the
   point. The answer comes back as a code ("AE", "X", "D"); planners should not need a FEMA
   manual to read it, so each code carries a one-line meaning and what it means for planning. */

const NFHL = "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query";

// FEMA Flood Insurance Rate Map zone designations (44 CFR 64.3 and FEMA's FIRM key)
export const FLOOD_ZONES = {
  A: ["High risk: 1% chance of flooding in any year (the “100-year” flood). No flood elevation was set.", true],
  AE: ["High risk: 1% chance of flooding in any year (the “100-year” flood), with a published flood elevation.", true],
  AH: ["High risk: 1% annual chance of shallow ponding, usually 1–3 feet deep.", true],
  AO: ["High risk: 1% annual chance of shallow sheet flow on a slope, usually 1–3 feet deep.", true],
  AR: ["High risk: flood protection is being restored, so the 1% annual chance applies for now.", true],
  A99: ["High risk: 1% annual chance, in an area a flood-control system under construction will protect.", true],
  V: ["Highest risk on the coast: 1% annual chance of flooding plus storm waves. No flood elevation was set.", true],
  VE: ["Highest risk on the coast: 1% annual chance of flooding plus storm waves of 3 feet or more.", true],
  X: ["Lower risk: outside the 1% annual chance flood area.", false],
  D: ["Not studied: flooding is possible here, but FEMA has not mapped the risk. Common on Hawaiʻi's slopes and less-developed land.", false],
};
export const FLOOD_LEGEND = [
  ["#a5d3f0", "1% annual chance (zones A, AE, AH, AO, V, VE)"],
  ["#e06666", "Regulatory floodway: the channel kept clear to carry floodwater"],
  ["#f2c14e", "0.2% annual chance (“500-year”, shaded zone X)"],
  ["#c9c9c9", "Zone D: possible but not studied"],
];

/** Ask FEMA what flood zone is under a point. Returns inspector rows, or [] if none. */
export async function floodRows(lat, lon, signal = AbortSignal.timeout(10000)) {
  const q = new URLSearchParams({ geometry: `${lon},${lat}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: "FLD_ZONE,ZONE_SUBTY,SFHA_TF,STATIC_BFE", returnGeometry: "false", f: "json" });
  const r = await fetch(`${NFHL}?${q}`, { signal, credentials: "omit" });
  if (!r.ok) throw new Error("FEMA " + r.status);
  const a = (await r.json()).features?.[0]?.attributes;
  if (!a) return [["Flood zone", "None mapped here"]];
  const zone = String(a.FLD_ZONE || "").trim(), sub = String(a.ZONE_SUBTY || "").toLowerCase();
  let [meaning, sfha] = FLOOD_ZONES[zone] || ["See the FEMA Flood Map Service Center for this zone.", a.SFHA_TF === "T"];
  if (zone === "X" && sub.includes("0.2")) meaning = "Moderate risk: 0.2% chance of flooding in any year (the “500-year” flood).";
  if (sub.includes("floodway")) meaning += " Inside the regulatory floodway, the channel that must stay clear to carry floodwater.";
  const rows = [["Flood zone", zone + (sub.includes("floodway") ? " (floodway)" : "")], ["What it means", meaning],
    ["In AllReady's flood count", sfha ? "Yes: residents here are counted in the flood scenario" : "No: counted only if another hazard zone covers them"]];
  if (a.STATIC_BFE > -9000) rows.push(["Base flood elevation", `${a.STATIC_BFE} ft`]);
  return rows;
}

export const TSUNAMI_ZONES = {
  "Tsunami Evacuation Zone": ["Leave this area for any tsunami warning, whether the tsunami starts near Hawaiʻi or far away.", "Counted in AllReady's tsunami scenario"],
  "Extreme Tsunami Evacuation Zone": ["Leave this area only when officials call for it in a very large tsunami, such as one from a great Aleutian earthquake. Most warnings will not reach it.", "Not counted: the tsunami scenario uses the standard evacuation zone"],
};
export function tsunamiRows(zoneType) {
  const [meaning, counted] = TSUNAMI_ZONES[zoneType] || ["Tsunami evacuation planning area.", "–"];
  return [["Zone", zoneType || "Tsunami zone"], ["What it means", meaning], ["In AllReady", counted]];
}
