import './lib/safeStorage';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { LanguageProvider } from './lib/LanguageContext.tsx';
import { ThemeProvider } from './lib/ThemeContext.tsx';
import { initSecureLogger } from './lib/secureLogger';
import { initDevToolsGuard } from './lib/devtoolsGuard';
import { ErrorBoundary } from './components/ErrorBoundary';

// 🔒 Security: Suppress console output + block DevTools in production
initSecureLogger();
initDevToolsGuard();

// Google Translate / Translation extensions crash fix (Hardened for iOS Safari & Mobile AutoFill)
if (typeof window !== 'undefined' && typeof Node !== 'undefined') {
  try {
    const originalRemoveChild = Node.prototype.removeChild;
    Node.prototype.removeChild = function <T extends Node>(child: T): T {
      if (!child || child.parentNode !== this) {
        return child;
      }
      return originalRemoveChild.call(this, child) as T;
    };

    const originalInsertBefore = Node.prototype.insertBefore;
    Node.prototype.insertBefore = function <T extends Node>(newChild: T, refChild: Node | null): T {
      if (!newChild) return newChild;
      if (refChild && refChild.parentNode !== this) {
        return newChild;
      }
      return originalInsertBefore.call(this, newChild, refChild) as T;
    };
  } catch {
    // Silently ignore if browser restricts prototype patching
  }
}

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <ErrorBoundary isRoot={true}>
        <LanguageProvider>
          <ThemeProvider>
            <App />
          </ThemeProvider>
        </LanguageProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
}
