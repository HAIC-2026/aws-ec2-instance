/* AllReady — one way to reach an outside service. MIT licensed.

   Public feeds fail in two ways: they answer with an error, or they never answer. The second
   is the dangerous one — a hung request leaves a page saying "Loading…" forever and blocks
   every figure that waits on it. Every external request goes through here, so each one gives
   up after a bounded time and the page marks that source unavailable instead. No cookies or
   credentials are ever sent to another site. */

export const TIMEOUT_MS = 15000;

export function fetchT(url, opts = {}, ms = TIMEOUT_MS) {
  const t = AbortSignal.timeout(ms);
  const signal = opts.signal ? (AbortSignal.any ? AbortSignal.any([opts.signal, t]) : opts.signal) : t;
  return fetch(url, { credentials: "omit", ...opts, signal });
}
