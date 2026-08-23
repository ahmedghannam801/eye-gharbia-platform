/**
 * secureLogger.ts
 * ─────────────────────────────────────────────────────────
 * In PRODUCTION: silences all console.log / warn / error / info / debug
 * so no internal data, table names, or Supabase error messages leak
 * to anyone who opens F12.
 *
 * In DEVELOPMENT (import.meta.env.DEV): fully transparent — does nothing.
 * ─────────────────────────────────────────────────────────
 */

const noop = () => {};

export function initSecureLogger(): void {
  // Only suppress in production builds
  if (import.meta.env.DEV) return;

  try {
    console.log   = noop;
    console.warn  = noop;
    console.error = noop;
    console.info  = noop;
    console.debug = noop;
    console.table = noop;
    console.dir   = noop;
    console.group = noop;
    console.groupEnd = noop;
    console.groupCollapsed = noop;
  } catch {
    // Silently ignore — some browsers protect console methods
  }
}
