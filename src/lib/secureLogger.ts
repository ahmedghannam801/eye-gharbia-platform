/**
 * secureLogger.ts
 * Safe logger that prevents sensitive leakages in production while keeping error handling intact.
 */

export function initSecureLogger(): void {
  if (typeof window === 'undefined') return;
  if (import.meta.env.DEV) return;

  try {
    const noop = () => {};
    console.log = noop;
    console.info = noop;
    console.debug = noop;
    // Keep console.error & console.warn intact for React error boundaries and fatal tracking
  } catch {
    // Silently ignore
  }
}
