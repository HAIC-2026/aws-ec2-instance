/* AllReady — production server. MIT licensed. No dependencies (Node 20.12+).
   Serves the built app from dist/ and the AI endpoint from /api/*, with security headers.
     npm run build && npm start        → http://localhost:8080
   Reads .env if present (LLM_BASE_URL, LLM_MODEL, LLM_API_KEY, PORT, ALLOWED_ORIGINS, TRUST_PROXY). */

import http from "node:http";
import { fileURLToPath } from "node:url";
import { handleApi, config } from "./llm.js";
import { serveStatic } from "./static.js";
import { SECURITY_HEADERS } from "./security.js";

try { process.loadEnvFile?.(); } catch { /* no .env file: fine, use the environment */ }

/** The whole server as one handler, so tests can mount it on any port and directory. */
export function createHandler(dir) {
  const files = serveStatic(dir);
  return async (req, res) => {
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
    try {
      if (await handleApi(req, res)) return;
      await files(req, res);
    } catch (e) {
      console.error(e);
      if (!res.headersSent) res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Server error"); // never the stack trace
    }
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const PORT = Number(process.env.PORT || 8080);
  const server = http.createServer(createHandler(fileURLToPath(new URL("../dist", import.meta.url))));
  server.requestTimeout = 120000;
  server.headersTimeout = 15000; // slow-header (slowloris) guard
  server.maxHeadersCount = 60;
  server.listen(PORT, () => {
    const c = config();
    console.log(`AllReady on http://localhost:${PORT}  ·  assistant model: ${c.model} @ ${c.local ? "local" : new URL(c.base).hostname}${c.key ? "" : c.local ? "" : "  (no LLM_API_KEY set!)"}`);
  });
}
