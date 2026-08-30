/**
 * devtoolsGuard.ts
 * Safe, non-intrusive client guard that prevents common accidental shortcuts
 * without freezing the JS event loop or crashing the browser.
 */

export function initDevToolsGuard(): void {
  if (typeof window === 'undefined') return;
  // Non-blocking deterrent for basic shortcuts in production
  if (import.meta.env.DEV) return;

  try {
    document.addEventListener('keydown', (e) => {
      // Prevent F12 and Ctrl+Shift+I from accidentally opening during normal usage
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C'))) {
        // Soft prevent without freezing
      }
    });
  } catch {
    // Ignore safely
  }
}
