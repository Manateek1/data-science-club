import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Both public pages are served from the domain root, including /judge.
export default defineConfig({
  base: '/',
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        judge: fileURLToPath(new URL('./judge.html', import.meta.url)),
      },
    },
  },
});
