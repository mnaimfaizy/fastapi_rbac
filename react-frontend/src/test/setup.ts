import '@testing-library/jest-dom';
import { beforeAll, afterEach, afterAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Node 26 exposes localStorage and sessionStorage without a backing file.
// Reading either getter warns and returns undefined, which hides jsdom's
// Storage and makes the session-hint helpers fail. Install a memory store
// when the host one cannot set and get items.
function memoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      const value = store.get(String(key));
      return value === undefined ? null : value;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(String(key));
    },
    setItem(key: string, value: string) {
      store.set(String(key), String(value));
    },
  };
}

function storageWorks(storage: unknown): storage is Storage {
  return (
    typeof storage === 'object' &&
    storage !== null &&
    typeof (storage as Storage).getItem === 'function' &&
    typeof (storage as Storage).setItem === 'function'
  );
}

function readStorage(
  target: object,
  name: 'localStorage' | 'sessionStorage'
): Storage | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(target, name);
  // Node 26's experimental storage is a non-enumerable getter. Calling it
  // warns and returns undefined unless --localstorage-file is set.
  if (
    descriptor &&
    typeof descriptor.get === 'function' &&
    descriptor.enumerable === false
  ) {
    return undefined;
  }
  const storage = (target as unknown as Record<string, unknown>)[name];
  return storageWorks(storage) ? storage : undefined;
}

function installWebStorage(name: 'localStorage' | 'sessionStorage') {
  const onWindow =
    typeof window !== 'undefined' ? readStorage(window, name) : undefined;
  const storage = onWindow ?? readStorage(globalThis, name) ?? memoryStorage();
  for (const target of [
    globalThis,
    typeof window !== 'undefined' ? window : undefined,
  ]) {
    if (!target) {
      continue;
    }
    Object.defineProperty(target, name, {
      configurable: true,
      enumerable: true,
      writable: true,
      value: storage,
    });
  }
}

installWebStorage('localStorage');
installWebStorage('sessionStorage');

// Mock axios
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      patch: vi.fn(),
      interceptors: {
        request: {
          use: vi.fn(),
          eject: vi.fn(),
        },
        response: {
          use: vi.fn(),
          eject: vi.fn(),
        },
      },
    })),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    interceptors: {
      request: {
        use: vi.fn(),
        eject: vi.fn(),
      },
      response: {
        use: vi.fn(),
        eject: vi.fn(),
      },
    },
  },
}));

// Set default test timeout to prevent hanging tests
vi.setConfig({ testTimeout: 10000 });

// Setup for testing environment
beforeAll(() => {
  // Mock environment variables
  process.env.VITE_API_BASE_URL = 'http://localhost:8000';

  // Polyfill for HTMLFormElement.requestSubmit (JSDOM doesn't implement it)
  HTMLFormElement.prototype.requestSubmit = function (submitter) {
    if (submitter) {
      submitter.click();
    } else {
      this.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true })
      );
    }
  };

  // Polyfill for pointer capture methods (needed for Radix UI components)
  Element.prototype.hasPointerCapture = function () {
    return false;
  };
  Element.prototype.setPointerCapture = function () {};
  Element.prototype.releasePointerCapture = function () {};

  // Polyfill for scrollIntoView method (needed for Radix UI Select)
  Element.prototype.scrollIntoView = function () {};
  window.scrollTo = function () {};
});

// Cleanup after each test
afterEach(() => {
  cleanup();
  // Clear all mocks after each test
  vi.clearAllMocks();
  // Clear all timers
  vi.clearAllTimers();
});

// Global cleanup
afterAll(() => {
  // Any global cleanup if needed
});

// Mock matchMedia for components that use responsive hooks
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  root = null;
  rootMargin = '';
  thresholds = [];
  observe() {
    return null;
  }
  disconnect() {
    return null;
  }
  unobserve() {
    return null;
  }
  takeRecords() {
    return [];
  }
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  observe() {
    return null;
  }
  disconnect() {
    return null;
  }
  unobserve() {
    return null;
  }
};
