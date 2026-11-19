import { defineConfig } from "vite";
import { resolve } from "node:path";
import { handleApi } from "./server/llm.js";
import { CSP } from "./server/security.js";

try { process.loadEnvFile?.(); } catch { /* no .env: the assistant falls back to local Ollama */ }

// The same /api handler the production server uses, mounted on the dev server.
const api = () => ({
  name: "allready-api",
  configureServer(server) { server.middlewares.use((req, res, next) => { handleApi(req, res).then((done) => done || next(), next); }); },
  configurePreviewServer(server) { server.middlewares.use((req, res, next) => { handleApi(req, res).then((done) => done || next(), next); }); },
});
// Built pages carry the CSP as a <meta> too, so it still applies on static hosting
// (GitHub Pages) where we cannot set response headers.
const csp = () => ({
  name: "allready-csp", apply: "build",
  transformIndexHtml: (html) => html.replace("<head>", `<head>\n<meta http-equiv="Content-Security-Policy" content="${CSP}">`),
});

export default defineConfig({
  base: "./", // relative asset paths: works at a domain root and under /<repo>/ on GitHub Pages
  plugins: [api(), csp()],
  worker: { format: "es" },
  server: { open: "/home.html", port: 5173 },
  build: {
    chunkSizeWarningLimit: 2000, // MapLibre GL and Three.js are large by nature
    rollupOptions: {
      input: {
        app: resolve(__dirname, "index.html"),
        home: resolve(__dirname, "home.html"),
        insights: resolve(__dirname, "insights.html"),
        scenarios: resolve(__dirname, "scenarios.html"),
        roles: resolve(__dirname, "roles.html"),
        method: resolve(__dirname, "method.html"),
      },
    },
  },
});
