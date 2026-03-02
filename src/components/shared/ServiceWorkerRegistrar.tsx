'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Service Worker Registration + Push Subscribe
// ═══════════════════════════════════════════════════════════

import { useEffect } from 'react'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

async function subscribeToPush(registration: ServiceWorkerRegistration) {
  try {
    // Fetch VAPID key
    const res = await fetch('/api/v1/push/vapid-key')
    if (!res.ok) return
    const { data } = await res.json()
    if (!data?.vapidPublicKey) return

    // Check existing subscription
    const existing = await registration.pushManager.getSubscription()
    if (existing) return // Already subscribed

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.vapidPublicKey).buffer as ArrayBuffer,
    })

    const keys = subscription.toJSON().keys
    if (!keys) return

    // Register with server
    await fetch('/api/v1/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      }),
    })
  } catch {
    // Push subscription failed — non-critical
  }
}

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // Try Push subscription if permission granted
        if (Notification.permission === 'granted') {
          subscribeToPush(registration)
        }
      })
      .catch(() => {
        // SW registration failed — non-critical
      })
  }, [])

  return null
}
