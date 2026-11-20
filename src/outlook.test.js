/* Checks the warning-outlook model the browser runs: inputs, scoring, and the shipped weights. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { featureRow, score, level, FEATURES, OUTLOOK_HAZARDS } from "./outlook.js";

const model = JSON.parse(readFileSync(new URL("../public/data/outlook-model.json", import.meta.url)));
const day = (o) => ({ temperature_2m_max: 28, precipitation_sum: 0, precipitation_hours: 0, wind_speed_10m_max: 20, wind_gusts_10m_max: 35, relative_humidity_2m_min: 60, vapour_pressure_deficit_max: 1, ...o });
const history = (today, before = {}) => (d) => (d === "2026-08-08" ? [day(today), day(today)] : [day(before), day(before)]);

test("model file matches the inputs the browser computes", () => {
  assert.deepEqual(model.features.map((f) => f.k), FEATURES.map(([k]) => k));
  for (const hz of OUTLOOK_HAZARDS) {
    const m = model.models[hz.k];
    assert.ok(m, hz.k);
    assert.equal(m.coef.length, FEATURES.length);
    assert.ok(m.thresholds.elevated <= m.thresholds.high);
    assert.ok(m.test.auc > 0.5, `${hz.k} must beat a coin toss on held-out data`);
  }
});

test("featureRow needs 14 days of history and reads the worst point", () => {
  assert.equal(featureRow("2026-08-08", (d) => (d === "2026-08-08" ? [day()] : null)), null);
  const f = featureRow("2026-08-08", (d) => (d === "2026-08-08" ? [day({ wind_gusts_10m_max: 40 }), day({ wind_gusts_10m_max: 90 })] : [day()]));
  assert.equal(f.gust, 90);
});

test("scores are probabilities and respond to the weather in the right direction", () => {
  const calm = score(model, "15009", featureRow("2026-08-08", history({})));
  const storm = score(model, "15009", featureRow("2026-08-08", history({ precipitation_sum: 120, precipitation_hours: 10, relative_humidity_2m_min: 90 }, { precipitation_sum: 30 })));
  const fireDay = score(model, "15009", featureRow("2026-08-08", history({ wind_gusts_10m_max: 105, wind_speed_10m_max: 60, relative_humidity_2m_min: 30, vapour_pressure_deficit_max: 3 })));
  for (const s of [calm, storm, fireDay]) for (const k of Object.keys(s)) assert.ok(s[k].p > 0 && s[k].p < 1);
  assert.ok(storm.flood.p > calm.flood.p, "heavy rain raises the flood chance");
  assert.ok(fireDay.wildfire.p > calm.wildfire.p, "gusty, dry air raises the Red Flag chance");
  assert.ok(fireDay.wildfire.why.length > 0, "a high score explains itself");
});

test("levels are relative to the hazard's own thresholds", () => {
  const th = { elevated: 0.05, high: 0.2 };
  assert.equal(level(0.01, th), "low");
  assert.equal(level(0.06, th), "elevated");
  assert.equal(level(0.5, th), "high");
});
