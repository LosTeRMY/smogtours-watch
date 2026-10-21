import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json' with { type: 'json' };

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    rollupOptions: {
      // library.html n'est pas déclaré dans le manifest (ouvert via chrome.windows.create) : on l'ajoute ici.
      input: { library: 'library.html' },
    },
  },
});
