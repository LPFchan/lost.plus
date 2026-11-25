import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    // The launcher this page replaced was an installable PWA whose service
    // worker cached the whole site. This ships a worker at the same URL that
    // unregisters itself and clears those caches, so returning visitors get
    // the new page instead of the copy they have stored.
    VitePWA({ selfDestroying: true, manifest: false, injectRegister: null }),
  ],
});
