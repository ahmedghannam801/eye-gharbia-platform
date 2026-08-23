/**
 * devtoolsGuard.ts
 * ─────────────────────────────────────────────────────────
 * Production-only guard that makes it harder for casual users
 * to inspect the app via F12 / right-click / DevTools.
 *
 * NOTE: This is NOT a replacement for proper server-side security
 * (RLS policies). Any determined developer can bypass these measures.
 * This is a deterrent layer for non-technical users.
 * ─────────────────────────────────────────────────────────
 */

export function initDevToolsGuard(): void {
  // Only activate in production
  if (import.meta.env.DEV) return;

  // 1. Block right-click context menu
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  // 2. Block common DevTools keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // F12
    if (e.key === 'F12') {
      e.preventDefault();
      return;
    }
    // Ctrl+Shift+I (DevTools)
    if (e.ctrlKey && e.shiftKey && e.key === 'I') {
      e.preventDefault();
      return;
    }
    // Ctrl+Shift+J (Console)
    if (e.ctrlKey && e.shiftKey && e.key === 'J') {
      e.preventDefault();
      return;
    }
    // Ctrl+Shift+C (Inspect Element)
    if (e.ctrlKey && e.shiftKey && e.key === 'C') {
      e.preventDefault();
      return;
    }
    // Ctrl+U (View Source)
    if (e.ctrlKey && e.key === 'u') {
      e.preventDefault();
      return;
    }
  });

  // 3. Periodically clear the console so even if someone opens it,
  //    they see nothing useful
  setInterval(() => {
    try {
      console.clear();
    } catch {
      // ignore
    }
  }, 1000);

  // 4. DevTools detection via debugger timing
  //    If DevTools is open, the debugger statement causes a measurable delay
  const detectDevTools = () => {
    const threshold = 100;
    const start = performance.now();
    // eslint-disable-next-line no-debugger
    debugger;
    const end = performance.now();
    if (end - start > threshold) {
      // DevTools detected — show warning overlay
      showWarningOverlay();
    }
  };

  // Run detection every 3 seconds (light footprint)
  setInterval(detectDevTools, 3000);
}

function showWarningOverlay(): void {
  // Avoid duplicate overlays
  if (document.getElementById('devtools-warning-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'devtools-warning-overlay';
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 999999;
    background: rgba(0,0,0,0.95);
    display: flex; align-items: center; justify-content: center;
    font-family: system-ui, sans-serif; direction: rtl;
  `;
  overlay.innerHTML = `
    <div style="text-align:center; color:white; max-width:500px; padding:40px;">
      <div style="font-size:64px; margin-bottom:20px;">🚫</div>
      <h1 style="font-size:24px; font-weight:900; margin-bottom:12px; color:#ef4444;">
        ⚠️ تحذير أمني
      </h1>
      <p style="font-size:14px; color:#94a3b8; line-height:1.8; margin-bottom:24px;">
        تم اكتشاف محاولة فحص الكود. هذا الإجراء مخالف لسياسة الأمان.<br/>
        أغلق أدوات المطور فوراً.
      </p>
      <p style="font-size:11px; color:#475569;">
        Security Warning: Developer tools detected. Close them immediately.
      </p>
    </div>
  `;

  // Remove overlay if user closes DevTools (detected by resize or focus)
  const removeOverlay = () => {
    const el = document.getElementById('devtools-warning-overlay');
    if (el) el.remove();
  };

  // Auto-remove after 5 seconds to avoid permanent lock
  setTimeout(removeOverlay, 5000);

  document.body.appendChild(overlay);
}
