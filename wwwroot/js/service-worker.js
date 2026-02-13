// service-worker.js - LIVE STREAMING (Network Only) OPTIMIZED

// NOTE: The CACHE_NAME is now completely removed as we do not use Cache Storage API.

self.addEventListener('install', event => {
  // 1. Force the service worker to skip the waiting phase and activate immediately.
  event.waitUntil(self.skipWaiting())
  console.log('Service Worker installed and skipping waiting.')
})

self.addEventListener('activate', event => {
  // 2. Ensure the service worker takes control of all clients immediately.
  event.waitUntil(self.clients.claim())
  console.log('Service Worker activated and claimed clients.')
})

self.addEventListener('fetch', event => {
  // 3. CORE STRATEGY: Network Only.
  // All requests (HTML, JS, CSS, Streams, EPG) go straight to the network.
  // This ensures the freshest version of all files is always requested.

  event.respondWith(
    fetch(event.request)
      .then(response => response)
      .catch(error => {
        // If the network is down, this error will fire for every asset.
        console.error('Fetch failed (Network may be offline):', error)

        // Provide a meaningful (though ultimately useless for streams) network error.
        return new Response(
          'Cannot connect to network to load stream or files.',
          {
            status: 408,
            statusText: 'Network Unavailable'
          }
        )
      })
  )
})
