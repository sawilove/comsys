import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// BASE_PATH=/comsys/ для GitHub Pages (адрес вида sawilove.github.io/comsys/).
const base = process.env.BASE_PATH || '/';
export default defineConfig(({ mode }) => {
  const native = mode === 'native' || process.env.TAURI_ENV_PLATFORM !== undefined;
  return {
  base,
  define: { __COMSYS_NATIVE__: JSON.stringify(native), __COMSYS_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.2.0') },
  plugins: [
    svelte(),
    !native && VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'COMSYS',
        short_name: 'COMSYS',
        description: 'Закрытый мессенджер для своих',
        lang: 'ru',
        theme_color: '#121218',
        background_color: '#121218',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
  };
});
