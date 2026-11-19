import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { THEME_STORAGE_KEY } from '@/lib/theme';

// public/theme-init.js runs before the app bundle so the first paint is
// already in the right theme. It must agree with ThemeProvider.
const script = readFileSync(
  path.resolve(import.meta.dirname, '../../public/theme-init.js'),
  'utf-8'
);

const originalMatchMedia = window.matchMedia;

function systemPrefersDark(dark: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: dark && query.includes('dark'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

function runScript() {
  new Function(script)();
  return document.documentElement;
}

describe('theme-init.js', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('class');
    document.documentElement.removeAttribute('style');
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('reads the same storage key as the ThemeProvider', () => {
    expect(script).toContain(`'${THEME_STORAGE_KEY}'`);
  });

  it('follows the system setting when nothing is stored', () => {
    systemPrefersDark(true);
    const root = runScript();

    expect(root).toHaveClass('dark');
    expect(root.style.colorScheme).toBe('dark');
  });

  it('starts light when the system prefers light', () => {
    systemPrefersDark(false);
    const root = runScript();

    expect(root).not.toHaveClass('dark');
    expect(root.style.colorScheme).toBe('light');
  });

  it('uses the stored choice over the system setting', () => {
    systemPrefersDark(false);
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    expect(runScript()).toHaveClass('dark');

    systemPrefersDark(true);
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    const root = runScript();
    expect(root).not.toHaveClass('dark');
    expect(root.style.colorScheme).toBe('light');
  });

  it('falls back to the system setting when storage is unavailable', () => {
    systemPrefersDark(true);
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('blocked');
      },
    });
    try {
      expect(runScript()).toHaveClass('dark');
    } finally {
      if (original) {
        Object.defineProperty(window, 'localStorage', original);
      }
    }
  });
});
