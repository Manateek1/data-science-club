import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Public pages are served from the domain root.
export default defineConfig({
  base: '/',
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        judge: fileURLToPath(new URL('./judge.html', import.meta.url)),
        sponsor: fileURLToPath(new URL('./sponsor.html', import.meta.url)),
      },
    },
  },
});
