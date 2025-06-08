import '@testing-library/jest-dom';
import { beforeAll, afterEach, afterAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

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
