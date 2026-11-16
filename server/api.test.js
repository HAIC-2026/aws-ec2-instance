// node --test server/   — backend checks: validation, limits, origin, traversal, streaming.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mockLLM } from "./mock-llm.mjs";

let mock, server, base;
before(async () => {
  mock = await mockLLM();
  process.env.LLM_BASE_URL = mock.url; process.env.LLM_MODEL = "mock"; process.env.LLM_API_KEY = "test-key"; process.env.CHAT_RATE_PER_MIN = "12";
  const { handleApi } = await import("./llm.js");
  server = http.createServer((req, res) => handleApi(req, res).then((d) => { if (!d) { res.writeHead(404); res.end(); } }));
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.close(); mock.srv.close(); });
const post = (body, headers = {}) => fetch(base + "/api/chat", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });

test("health reports the configured model", async () => {
  const j = await (await fetch(base + "/api/health")).json();
  assert.equal(j.ai, true); assert.equal(j.model, "mock");
});
test("chat streams an answer grounded in the snapshot, and the key stays server-side", async () => {
  const r = await post({ messages: [{ role: "user", content: "summarise" }], context: { eventClock: { hazard: "Tsunami", phase: "Warning" }, needs: { inPublicShelter: 123 } } });
  assert.equal(r.status, 200);
  const t = await r.text();
  assert.match(t, /Tsunami \/ Warning/); assert.match(t, /In shelter: 123/); assert.match(t, /Auth: yes/);
  assert.ok(!t.includes("test-key"));
});
test("rejects malformed bodies and bad roles", async () => {
  assert.equal((await post("{nope")).status, 400);
  assert.equal((await post({ messages: [] })).status, 400);
  assert.equal((await post({ messages: [{ role: "system", content: "x" }] })).status, 400);
  assert.equal((await post({ messages: [{ role: "assistant", content: "x" }] })).status, 400);
});
test("rejects wrong content type, oversized bodies and cross-origin callers", async () => {
  assert.equal((await fetch(base + "/api/chat", { method: "POST", headers: { "Content-Type": "text/plain" }, body: "{}" })).status, 415);
  assert.equal((await post({ messages: [{ role: "user", content: "x" }], context: { big: "y".repeat(130000) } })).status, 413);
  assert.equal((await post({ messages: [{ role: "user", content: "x" }] }, { Origin: "https://evil.example" })).status, 403);
});
test("rate limits a single client", async () => {
  let last = 200;
  for (let i = 0; i < 20; i++) last = (await post({ messages: [{ role: "user", content: "x" }] })).status;
  assert.equal(last, 429);
});
