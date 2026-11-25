import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/** Start downloading Gaegu (18 KB, used for Latin in almost every language)
    in parallel with the JS and CSS bundles instead of waiting for mount. */
function preloadGaegu(): Plugin {
  return {
    name: 'preload-gaegu',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const asset = Object.keys(ctx.bundle ?? {}).find((k) => /gaegu-latin-300-normal.*\.woff2$/.test(k));
        if (!asset) return [];
        return [{ tag: 'link', attrs: { rel: 'preload', href: `/${asset}`, as: 'font', type: 'font/woff2', crossorigin: '' }, injectTo: 'head' }];
      },
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    preloadGaegu(),
    // The launcher this page replaced was an installable PWA whose service
    // worker cached the whole site. This ships a worker at the same URL that
    // unregisters itself and clears those caches, so returning visitors get
    // the new page instead of the copy they have stored.
    VitePWA({ selfDestroying: true, manifest: false, injectRegister: null }),
  ],
});
