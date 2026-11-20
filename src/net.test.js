/* A feed that never answers must not hang a page, and a county whose feed failed must read as
   missing, never as zero shelters. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { fetchT } from "./net.js";
import { readiness, COUNTIES } from "./shelters.js";

test("fetchT gives up on a server that never answers", async () => {
  const srv = createServer(() => { /* never responds */ });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const { port } = srv.address(), t0 = Date.now();
  await assert.rejects(fetchT(`http://127.0.0.1:${port}/`, {}, 300), (e) => e.name === "TimeoutError" || e.name === "AbortError");
  assert.ok(Date.now() - t0 < 3000, "gave up promptly");
  srv.closeAllConnections?.(); srv.close();
});

test("a county whose feed did not answer is reported as missing, not zero", () => {
  const c = COUNTIES[0];
  const down = readiness([], [{ county: c.short, msg: "timed out" }]).find((x) => x.fips === c.fips);
  assert.equal(down.feedDown, true);
  assert.equal(down.grade, "none");
  assert.match(down.feedNote, /missing from every figure, not zero/);
  const stale = readiness([], [{ county: c.short, stale: true, msg: "showing its last list" }]).find((x) => x.fips === c.fips);
  assert.equal(stale.feedDown, false);
  assert.match(stale.feedNote, /last list/);
  const ok = readiness([]).find((x) => x.fips === c.fips);
  assert.equal(ok.feedDown, false); assert.equal(ok.feedNote, "");
});
