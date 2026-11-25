import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the build works on GitHub Pages sub-paths.
  base: './',
  build: {
    // three.js alone is ~700 kB minified.
    chunkSizeWarningLimit: 1500,
  },
});
