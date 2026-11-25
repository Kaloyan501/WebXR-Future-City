import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // Relative asset paths so the build works on GitHub Pages sub-paths.
  base: './',
  build: {
    // three.js alone is ~700 kB minified.
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      // Two pages: the VR city (root) and the Град 2100 website (/city2100/).
      input: {
        main: fileURLToPath(new URL('index.html', import.meta.url)),
        city2100: fileURLToPath(new URL('city2100/index.html', import.meta.url)),
      },
    },
  },
});
