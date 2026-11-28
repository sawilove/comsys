/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, precacheAndRoute, PrecacheFallbackPlugin } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkOnly } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: { url: string; revision: string | null }[] };

void self.skipWaiting();
clientsClaim();
// Navigation must match before the asset precache route (which also recognizes index.html).
registerRoute(({ request }) => request.mode === 'navigate', new NetworkOnly({
  fetchOptions: { cache: 'reload' },
  plugins: [new PrecacheFallbackPlugin({ fallbackURL: import.meta.env.BASE_URL + 'index.html' })],
}));
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
