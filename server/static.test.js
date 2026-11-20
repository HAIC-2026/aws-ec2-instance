// node --test server/   — the static server: headers on every response, no way out of dist/.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

let dir, server, base;
before(async () => {
  dir = await mkdtemp(join(tmpdir(), "allready-"));
  await mkdir(join(dir, "site"));
  await writeFile(join(dir, "site", "home.html"), "<!doctype html><title>home</title>");
  await writeFile(join(dir, "secret.txt"), "outside the web root");
  await writeFile(join(dir, "site", ".env"), "LLM_API_KEY=should-never-be-served");
  await mkdir(join(dir, "site", ".well-known"));
  await writeFile(join(dir, "site", ".well-known", "security.txt"), "Contact: https://example.invalid");
  process.env.LLM_BASE_URL = "http://127.0.0.1:9/v1"; // nothing listens here; these tests never reach a model
  const { createHandler } = await import("./index.js");
  server = http.createServer(createHandler(join(dir, "site")));
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server.close(); await rm(dir, { recursive: true, force: true }); });

// fetch() normalises "../" away, so traversal has to be sent as a raw request line
const raw = (path, method = "GET") => new Promise((res, rej) => {
  const r = http.request({ host: "127.0.0.1", port: server.address().port, path, method }, (m) => { let b = ""; m.on("data", (c) => (b += c)); m.on("end", () => res({ status: m.statusCode, body: b, headers: m.headers })); });
  r.on("error", rej); r.end();
});

test("serves the home page at / with every security header", async () => {
  const r = await fetch(base + "/");
  assert.equal(r.status, 200);
  assert.match(await r.text(), /<title>home/);
  const csp = r.headers.get("content-security-policy");
  assert.match(csp, /default-src 'self'/); assert.match(csp, /frame-ancestors 'none'/); assert.match(csp, /object-src 'none'/);
  assert.ok(!/script-src[^;]*'unsafe-(inline|eval)'/.test(csp), "scripts may never be inline or eval");
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  assert.equal(r.headers.get("x-frame-options"), "DENY");
  assert.match(r.headers.get("strict-transport-security"), /max-age=\d+/);
  assert.equal(r.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
});
test("refuses path traversal, encoded traversal, NUL bytes and malformed escapes", async () => {
  for (const p of ["/../secret.txt", "/..%2fsecret.txt", "/%2e%2e/secret.txt", "/site/../../secret.txt"]) {
    const r = await raw(p);
    assert.ok([403, 404].includes(r.status), `${p} → ${r.status}`);
    assert.ok(!r.body.includes("outside the web root"), p);
  }
  assert.equal((await raw("/home.html%00.png")).status, 400);
  assert.equal((await raw("/%E0%A4%A")).status, 400);
});
test("is read-only: no POST, PUT or DELETE on files", async () => {
  for (const m of ["POST", "PUT", "DELETE"]) assert.equal((await raw("/home.html", m)).status, 405);
});
test("errors carry the security headers too and never a stack trace", async () => {
  const r = await fetch(base + "/nope.html");
  assert.equal(r.status, 404);
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  assert.equal(await r.text(), "Not found");
});

test("never serves hidden files, but does serve /.well-known/security.txt", async () => {
  for (const p of ["/.env", "/%2Eenv", "/x/../.env", "/.git/config"]) {
    const r = await raw(p);
    assert.notEqual(r.status, 200, p);
    assert.ok(!r.body.includes("should-never-be-served"), p);
  }
  const ok = await fetch(base + "/.well-known/security.txt");
  assert.equal(ok.status, 200);
});
