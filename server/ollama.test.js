// node --test server/   — a local Ollama is detected and spoken to on its own protocol.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mockLLM } from "./mock-llm.mjs";

let mock, server, base;
before(async () => {
  mock = await mockLLM(0, { ollama: true });
  process.env.LLM_BASE_URL = mock.url; process.env.LLM_MODEL = "mock"; process.env.LLM_API_KEY = ""; process.env.LLM_NUM_CTX = "4096";
  const { handleApi } = await import("./llm.js");
  server = http.createServer((req, res) => handleApi(req, res).then((d) => { if (!d) { res.writeHead(404); res.end(); } }));
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.close(); mock.srv.close(); });

test("health names Ollama and confirms the model is pulled", async () => {
  const j = await (await fetch(base + "/api/health")).json();
  assert.equal(j.ai, true); assert.match(j.provider, /Ollama/);
});
test("chat uses /api/chat with the requested context window and carries the snapshot", async () => {
  const r = await fetch(base + "/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: "summarise" }], context: { needs: { inPublicShelter: 77 } } }) });
  assert.equal(r.status, 200);
  const t = await r.text();
  assert.match(t, /OLLAMA/); assert.match(t, /ctx=4096/); assert.match(t, /In shelter: 77/);
});
