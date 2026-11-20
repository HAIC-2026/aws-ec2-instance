/* AllReady — static file handler. MIT licensed. No dependencies.
   Serves one directory, read-only. Refuses anything that is not GET/HEAD, anything that
   resolves outside the directory, and malformed or NUL-carrying paths. */

import { readFile, stat } from "node:fs/promises";
import { join, normalize, extname, resolve, sep } from "node:path";

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".woff2": "font/woff2", ".map": "application/json", ".txt": "text/plain; charset=utf-8" };

/** Returns an async (req, res) handler for the directory `dir`. */
export function serveStatic(dir, { index = "/home.html" } = {}) {
  const ROOT = resolve(dir);
  return async function handle(req, res) {
    if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405, { Allow: "GET, HEAD" }); return res.end(); }
    let path;
    try { path = decodeURIComponent((req.url || "/").split("?")[0]); } catch { res.writeHead(400); return res.end(); }
    if (path.includes("\0")) { res.writeHead(400); return res.end(); }
    if (path === "/") path = index;
    // Hidden files are never served (a stray .env or .git in the web root stays private);
    // the one exception is /.well-known/, where security.txt lives (RFC 9116).
    if (/(^|\/)\.(?!well-known\/)/.test(path)) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); return res.end("Not found"); }
    // normalise, then insist the result is still inside the directory — no path traversal
    const file = normalize(join(ROOT, path));
    if (file !== ROOT && !file.startsWith(ROOT + sep)) { res.writeHead(403); return res.end(); }
    const s = await stat(file).catch(() => null);
    if (!s || !s.isFile()) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); return res.end("Not found"); }
    const hashed = /\/assets\//.test(path); // Vite fingerprints these, so they can be cached for good
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream", "Cache-Control": hashed ? "public, max-age=31536000, immutable" : "no-cache" });
    if (req.method === "HEAD") return res.end();
    res.end(await readFile(file));
  };
}
