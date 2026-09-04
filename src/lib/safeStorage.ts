/**
 * safeStorage.ts
 * Polyfills window.localStorage and window.sessionStorage with a robust in-memory
 * fallback if they are disabled, throw SecurityError (Safari Private Browsing, iOS WebViews),
 * or encounter quota restrictions.
 */

function createMemoryStorage(): Storage {
  let store: Record<string, string> = {};
  return {
    getItem(key: string): string | null {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key: string, value: string): void {
      store[key] = String(value);
    },
    removeItem(key: string): void {
      delete store[key];
    },
    clear(): void {
      store = {};
    },
    key(index: number): string | null {
      const keys = Object.keys(store);
      return keys[index] || null;
    },
    get length(): number {
      return Object.keys(store).length;
    }
  };
}

export function initSafeStorage(): void {
  if (typeof window === 'undefined') return;

  // 1. Test and safeguard localStorage
  let localStorageWorks = false;
  try {
    const testKey = '__eye_ls_probe__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    localStorageWorks = true;
  } catch {
    localStorageWorks = false;
  }

  if (!localStorageWorks) {
    try {
      const memoryStorage = createMemoryStorage();
      Object.defineProperty(window, 'localStorage', {
        value: memoryStorage,
        configurable: true,
        writable: true,
      });
    } catch {
      // Fallback in case Object.defineProperty fails
    }
  }

  // 2. Test and safeguard sessionStorage
  let sessionStorageWorks = false;
  try {
    const testKey = '__eye_ss_probe__';
    window.sessionStorage.setItem(testKey, '1');
    window.sessionStorage.removeItem(testKey);
    sessionStorageWorks = true;
  } catch {
    sessionStorageWorks = false;
  }

  if (!sessionStorageWorks) {
    try {
      const memoryStorage = createMemoryStorage();
      Object.defineProperty(window, 'sessionStorage', {
        value: memoryStorage,
        configurable: true,
        writable: true,
      });
    } catch {
      // Fallback in case Object.defineProperty fails
    }
  }
}

// Auto-run on import
initSafeStorage();
