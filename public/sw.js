// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Service Worker
// cache-first(static), network-first(API), push handler
// ═══════════════════════════════════════════════════════════

const CACHE_NAME = 'ctr-hr-hub-v1'
const STATIC_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
]

// ─── Install ────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

// ─── Activate ───────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

// ─── Fetch ──────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') return

  // API requests: network-first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful API responses briefly
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(() =>
          caches.match(request).then((cached) =>
            cached || new Response(JSON.stringify({ error: 'Offline' }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            })
          )
        )
    )
    return
  }

  // Static assets & pages: cache-first
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.json'
  ) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    )
    return
  }

  // Navigation: network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/offline').then((cached) =>
          cached || new Response('Offline', { status: 503 })
        )
      )
    )
    return
  }

  // Default: network with cache fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  )
})

// ─── Push ───────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return

  try {
    const payload = event.data.json()
    const options = {
      body: payload.body || '',
      icon: payload.icon || '/icons/icon-192x192.png',
      badge: payload.badge || '/icons/icon-192x192.png',
      data: { url: payload.url || '/' },
      vibrate: [200, 100, 200],
      tag: 'ctr-hr-hub',
      renotify: true,
    }

    event.waitUntil(
      self.registration.showNotification(payload.title || 'CTR HR Hub', options)
    )
  } catch {
    // Invalid push data
  }
})

// ─── Notification Click ─────────────────────────────────────

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        // Focus existing window if available
        for (const client of clients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(url)
            return client.focus()
          }
        }
        // Open new window
        return self.clients.openWindow(url)
      })
  )
})
