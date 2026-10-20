const STATIC_CACHE = 'freeview-static-20261020-1'

self.addEventListener('install', event => event.waitUntil(self.skipWaiting()))
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter(key => key.startsWith('freeview-static-') && key !== STATIC_CACHE).map(key => caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', event => {
  const request = event.request
  const url = new URL(request.url)
  // API, auth, proxies and video keep their own network/cache behavior.
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.endsWith('.ashx')) return
  const isStatic = request.mode === 'navigate' || /\.(?:html|js|css|png|svg|jpg|jpeg|webp|ico|woff2?|webmanifest|json)$/i.test(url.pathname)
  if (!isStatic || /^\/(?:App_Data|tests)\//i.test(url.pathname)) return
  event.respondWith((async () => {
    let cache = null
    try { cache = await caches.open(STATIC_CACHE) } catch (error) {}
    try {
      // Revalidate so edits in the live folder appear immediately; unchanged assets can use 304 responses.
      const response = await fetch(request, { cache: 'no-cache' })
      if (cache && response.ok && response.type !== 'opaque') await cache.put(request, response.clone()).catch(() => {})
      if (cache && response.status >= 500) {
        const saved = await cache.match(request).catch(() => null)
        if (saved) return saved
      }
      return response
    } catch (error) {
      const saved = cache ? await cache.match(request).catch(() => null) : null
      if (saved) return saved
      return new Response('Unable to load this file while offline.', { status: 503, headers: { 'Content-Type': 'text/plain' } })
    }
  })())
})
