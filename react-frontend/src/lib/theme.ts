import { useTheme } from 'next-themes';

/** The three choices a person can make. `system` follows the device. */
export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_PREFERENCES: readonly ThemePreference[] = [
  'light',
  'dark',
  'system',
];

/** localStorage key that remembers the choice per browser. */
export const THEME_STORAGE_KEY = 'fastapi-rbac-theme';

function isThemePreference(value: unknown): value is ThemePreference {
  return (
    typeof value === 'string' &&
    (THEME_PREFERENCES as readonly string[]).includes(value)
  );
}

/**
 * Read and change the theme. Must be used under `ThemeProvider`.
 *
 * `resolvedTheme` is what is on screen: `light` or `dark`, with `system`
 * already resolved against the device setting.
 */
export function useThemePreference() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const preference: ThemePreference = isThemePreference(theme)
    ? theme
    : 'system';
  return {
    preference,
    resolvedTheme:
      resolvedTheme === 'dark' || resolvedTheme === 'light'
        ? resolvedTheme
        : undefined,
    setPreference: (next: ThemePreference) => setTheme(next),
  };
}
