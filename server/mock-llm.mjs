// Test double for an OpenAI-compatible provider (and, with { ollama: true }, for Ollama). Used by `npm test` and local verification:
// it echoes back facts from the snapshot so we can prove the map context reaches the model.
import http from "node:http";
export function mockLLM(port = 0, { ollama = false } = {}) {
  const srv = http.createServer(async (req, res) => {
    if (req.url.endsWith("/models")) { res.writeHead(200, { "Content-Type": "application/json" }); return res.end('{"data":[{"id":"mock"}]}'); }
    if (ollama && req.url === "/api/version") { res.writeHead(200, { "Content-Type": "application/json" }); return res.end('{"version":"0.0.0-mock"}'); }
    if (ollama && req.url === "/api/tags") { res.writeHead(200, { "Content-Type": "application/json" }); return res.end('{"models":[{"name":"mock:latest"}]}'); }
    if (req.method !== "POST") { res.writeHead(404); return res.end(); }
    let raw = ""; for await (const c of req) raw += c;
    let body = {}; try { body = JSON.parse(raw); } catch { res.writeHead(400); return res.end(); }
    if (req.url === "/api/generate") { res.writeHead(200); return res.end("{}"); }
    const sys = body.messages?.[0]?.content || "", at = sys.indexOf("MAP SNAPSHOT (JSON):\n");
    let ctx = {}; try { ctx = JSON.parse(sys.slice(at + 21)); } catch {}
    const marks = (ctx.markup || []).map((m) => `${m.type} “${m.title}”: ${m.footprint?.residents ?? "?"} residents, ${m.footprint?.shelters ?? "?"} shelters ${m.footprint?.basis ?? ""}`).join("; ");
    if (req.url === "/api/chat") { // Ollama's own protocol: newline-delimited JSON
      res.writeHead(200, { "Content-Type": "application/x-ndjson" });
      res.write(JSON.stringify({ message: { role: "assistant", content: `OLLAMA. ctx=${body.options?.num_ctx}. In shelter: ${ctx.needs?.inPublicShelter}.` }, done: false }) + "\n");
      return res.end(JSON.stringify({ message: { role: "assistant", content: "" }, done: true }) + "\n");
    }
    const text = `MOCK. Event: ${ctx.eventClock?.hazard} / ${ctx.eventClock?.phase}. In shelter: ${ctx.needs?.inPublicShelter}. Markup: ${marks || "none"}. Auth: ${req.headers.authorization ? "yes" : "no"}.`;
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    for (const w of text.match(/.{1,12}/gs)) res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: w } }] })}\n\n`);
    res.end("data: [DONE]\n\n");
  });
  return new Promise((r) => srv.listen(port, "127.0.0.1", () => r({ srv, url: `http://127.0.0.1:${srv.address().port}/v1` })));
}
if (process.argv[1] && process.argv[1].endsWith("mock-llm.mjs")) mockLLM(11999).then((m) => console.log("mock LLM at", m.url));
