/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'
import { RangeRequestsPlugin } from 'workbox-range-requests'
import { ExpirationPlugin } from 'workbox-expiration'

declare const self: ServiceWorkerGlobalScope

clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// Cache-first for audio files.
// RangeRequestsPlugin is required: browsers send Range headers for <audio>
// elements to support seeking/streaming; without it the SW returns a plain
// 200 response that Safari refuses to play.
registerRoute(
  ({ url }) => /\/audio\/[0-9a-f]{12}\.mp3$/.test(url.pathname),
  new CacheFirst({
    cacheName: 'audio-cache',
    plugins: [
      new RangeRequestsPlugin(),
      new ExpirationPlugin({ maxEntries: 500 }),
    ],
  }),
)

// Phase 6 update-banner posts SKIP_WAITING to trigger SW swap
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})
