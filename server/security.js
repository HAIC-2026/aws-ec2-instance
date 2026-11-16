/* AllReady — security headers, shared by the production server and the build-time <meta> CSP.

   The policy in one breath: scripts only from this origin (no inline, no eval, no CDNs);
   data only over https; nobody may frame the app; no plugins; forms post nowhere else.
   connect-src has to stay "https:" because planners can add any public ArcGIS service by URL
   — the app refuses token-gated services and never sends credentials with those requests. */

// sha256 of the one inline script in home.html (adds the "js" class before first paint)
export const HOME_INLINE_HASH = "'sha256-WZRJfWvsnNCPcxzZwvyhovnZGqhZaC+8gPGPRbx6wTk='";

export const CSP = [
  "default-src 'self'",
  "script-src 'self' " + HOME_INLINE_HASH,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", // MapLibre and the dock position with inline styles
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https: data: blob:", // data:/blob: are images the app paints itself (weather grids, map sprites)
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "frame-src 'none'",
  "media-src 'self' https: blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

export const SECURITY_HEADERS = {
  "Content-Security-Policy": CSP + "; frame-ancestors 'none'",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), camera=(), microphone=(), payment=(), usb=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-Permitted-Cross-Domain-Policies": "none",
};
