import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@/components/common/ThemeProvider';
import { THEME_STORAGE_KEY, useThemePreference } from '@/lib/theme';

function ThemeHarness() {
  const { preference, resolvedTheme, setPreference } = useThemePreference();
  return (
    <div>
      <p>Preference: {preference}</p>
      <p>Showing: {resolvedTheme ?? 'unknown'}</p>
      <button type="button" onClick={() => setPreference('light')}>
        Light
      </button>
      <button type="button" onClick={() => setPreference('dark')}>
        Dark
      </button>
      <button type="button" onClick={() => setPreference('system')}>
        System
      </button>
    </div>
  );
}

function renderHarness() {
  return render(
    <ThemeProvider>
      <ThemeHarness />
    </ThemeProvider>
  );
}

const originalMatchMedia = window.matchMedia;

function prefersDark(dark: boolean) {
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

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('class');
    document.documentElement.removeAttribute('style');
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('follows the system setting by default', async () => {
    prefersDark(true);
    renderHarness();

    expect(screen.getByText('Preference: system')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText('Showing: dark')).toBeInTheDocument()
    );
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  it('shows the light theme when the system prefers light', async () => {
    prefersDark(false);
    renderHarness();

    await waitFor(() =>
      expect(screen.getByText('Showing: light')).toBeInTheDocument()
    );
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  it('switches between light and dark when the person picks one', async () => {
    prefersDark(false);
    const user = userEvent.setup();
    renderHarness();

    await user.click(screen.getByRole('button', { name: 'Dark' }));
    await waitFor(() =>
      expect(screen.getByText('Showing: dark')).toBeInTheDocument()
    );
    expect(document.documentElement.style.colorScheme).toBe('dark');

    await user.click(screen.getByRole('button', { name: 'Light' }));
    await waitFor(() =>
      expect(screen.getByText('Showing: light')).toBeInTheDocument()
    );
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  it('remembers the choice in this browser', async () => {
    prefersDark(false);
    const user = userEvent.setup();
    const { unmount } = renderHarness();

    await user.click(screen.getByRole('button', { name: 'Dark' }));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    unmount();

    renderHarness();
    expect(screen.getByText('Preference: dark')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText('Showing: dark')).toBeInTheDocument()
    );
  });
});
