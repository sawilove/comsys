import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// BASE_PATH=/comsys/ для GitHub Pages (адрес вида sawilove.github.io/comsys/).
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  base,
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'C-COMSYS',
        short_name: 'C-COMSYS',
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
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: `${base}index.html`,
        // Запросы к Supabase не кэшируем: свежесть данных обеспечивает синхронизация.
        runtimeCaching: [],
      },
    }),
  ],
});
