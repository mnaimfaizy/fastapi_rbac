// Sets the theme on <html> before the first paint, so a person who chose
// dark (or whose device prefers dark) never sees a light frame while the
// app loads. ThemeProvider (next-themes) takes over once React mounts; this
// must use the same storage key, values and default (system).
// A same-origin file, not an inline script: the CSP allows script-src 'self'.
(function () {
  var theme = 'system';
  try {
    var stored = window.localStorage.getItem('fastapi-rbac-theme');
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      theme = stored;
    }
  } catch (error) {
    // Storage can be blocked; fall back to the system setting.
  }

  var dark =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  var root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(dark ? 'dark' : 'light');
  root.style.colorScheme = dark ? 'dark' : 'light';
})();
