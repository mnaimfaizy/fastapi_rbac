import type { ReactNode } from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { THEME_STORAGE_KEY } from '@/lib/theme';

/**
 * Light, dark and system themes for the whole app.
 *
 * Toggles the `.dark` class on `<html>` that the tokens in `index.css`
 * key off, follows the device setting until the person picks a theme,
 * and remembers the choice in this browser.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey={THEME_STORAGE_KEY}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
