import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    watch: {
      // The dev container bind-mounts the host checkout at /app. Filesystem
      // events do not cross that boundary, so Vite's watcher never fires and
      // it keeps serving the transform it cached at startup: edits to an
      // existing file are invisible until the container restarts, while newly
      // added files load fine (cache miss reads from disk). Polling is the
      // only reliable watch inside the container, and it is off by default
      // because it costs CPU and native `npm run dev` does not need it.
      usePolling: process.env.VITE_USE_POLLING === 'true',
      interval: 300,
    },
  },
});
