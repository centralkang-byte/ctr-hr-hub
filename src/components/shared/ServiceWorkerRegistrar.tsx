'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Service Worker Registration + Update Detection
// Detects new SW builds and prompts the user to reload. The reload only
// fires in the tab that explicitly accepted the update (one-shot listener),
// so other tabs that share the SW keep unsaved in-memory state when the
// new worker activates cross-tab.
// ═══════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { ToastAction } from '@/components/ui/toast'
import { useToast } from '@/hooks/use-toast'

// ─── Constants ──────────────────────────────────────────────

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000 // 1 hour
const UPDATE_TOAST_DURATION_MS = 24 * 60 * 60 * 1000 // 24 hours (sticky)

// ─── Helpers ────────────────────────────────────────────────

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
    const res = await fetch('/api/v1/push/vapid-key')
    if (!res.ok) return
    const { data } = await res.json()
    if (!data?.vapidPublicKey) return

    const existing = await registration.pushManager.getSubscription()
    if (existing) return // Already subscribed

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.vapidPublicKey).buffer as ArrayBuffer,
    })

    const keys = subscription.toJSON().keys
    if (!keys) return

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

// ─── Component ──────────────────────────────────────────────

export function ServiceWorkerRegistrar() {
  const { toast, toasts } = useToast()
  const { status } = useSession()
  // Worker that the *currently visible* toast targets.
  const promptedWorkerRef = useRef<ServiceWorker | null>(null)
  const promptedToastIdRef = useRef<string | null>(null)
  // Surface registration to the push-subscription effect once it resolves,
  // avoiding a getRegistration() race when status flips to authenticated
  // before register() resolves.
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)

  // ── SW registration + update detection ──
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    let updateInterval: ReturnType<typeof setInterval> | null = null
    const cleanups: Array<() => void> = []

    const acceptUpdate = (worker: ServiceWorker) => {
      // If another tab already activated this worker, controllerchange will
      // not fire here again — reload directly.
      if (worker.state === 'activated' || navigator.serviceWorker.controller === worker) {
        window.location.reload()
        return
      }
      // Per-tab one-shot: reload ONLY this tab once activation completes.
      // Other tabs sharing the SW keep their in-memory state.
      const onChange = () => {
        navigator.serviceWorker.removeEventListener('controllerchange', onChange)
        window.location.reload()
      }
      navigator.serviceWorker.addEventListener('controllerchange', onChange)
      worker.postMessage({ type: 'SKIP_WAITING' })
    }

    const promptReload = (worker: ServiceWorker) => {
      if (promptedWorkerRef.current === worker) return
      promptedWorkerRef.current = worker
      // shadcn `toast()` overrides any caller-supplied `onOpenChange`, so
      // dismissal is observed via the `toasts` array effect below.
      const handle = toast({
        title: '새 버전이 있습니다',
        description: '새로고침하면 최신 화면으로 업데이트됩니다.',
        duration: UPDATE_TOAST_DURATION_MS,
        action: (
          <ToastAction altText="새로고침" onClick={() => acceptUpdate(worker)}>
            새로고침
          </ToastAction>
        ),
      })
      promptedToastIdRef.current = handle.id
    }

    const checkWaiting = (reg: ServiceWorkerRegistration) => {
      // Only prompt for *real* updates (existing controller present). A
      // fresh first install also produces a waiting worker briefly, but
      // there's nothing for the user to refresh from.
      if (reg.waiting && navigator.serviceWorker.controller) {
        promptReload(reg.waiting)
      }
    }

    const trackInstalling = (worker: ServiceWorker, reg: ServiceWorkerRegistration) => {
      const onState = () => {
        if (worker.state === 'installed') checkWaiting(reg)
      }
      worker.addEventListener('statechange', onState)
      cleanups.push(() => worker.removeEventListener('statechange', onState))
    }

    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        setRegistration(reg)

        // Case 1: a new SW finished installing in a previous session.
        checkWaiting(reg)

        // Case 2: install in flight at page load.
        if (reg.installing) trackInstalling(reg.installing, reg)

        // Case 3: a new update discovered while the page is open.
        const onUpdateFound = () => {
          if (reg.installing) trackInstalling(reg.installing, reg)
        }
        reg.addEventListener('updatefound', onUpdateFound)
        cleanups.push(() => reg.removeEventListener('updatefound', onUpdateFound))

        // Periodic + visibility-driven re-checks.
        const recheck = () => {
          reg.update().catch(() => {})
          checkWaiting(reg)
        }
        updateInterval = setInterval(recheck, UPDATE_CHECK_INTERVAL_MS)
        const onVisibility = () => {
          if (document.visibilityState === 'visible') recheck()
        }
        document.addEventListener('visibilitychange', onVisibility)
        cleanups.push(() => document.removeEventListener('visibilitychange', onVisibility))
      })
      .catch(() => {
        // SW registration failed — non-critical
      })

    return () => {
      if (updateInterval) clearInterval(updateInterval)
      for (const fn of cleanups) fn()
    }
  }, [toast])

  // ── Toast dismissal observer ──
  // shadcn replaces `onOpenChange` with its internal dismiss handler, so we
  // detect dismissal by watching the toasts array. When our toast is gone,
  // unlock the worker ref so a periodic recheck can re-prompt for the same
  // still-waiting worker (e.g., user dismissed the toast accidentally).
  useEffect(() => {
    const id = promptedToastIdRef.current
    if (!id) return
    const ours = toasts.find((t) => t.id === id)
    if (!ours || ours.open === false) {
      promptedWorkerRef.current = null
      promptedToastIdRef.current = null
    }
  }, [toasts])

  // ── Push subscription (authenticated sessions only) ──
  // The push endpoints are withAuth-protected, so calling them on public
  // routes (/login, /pre-hire, /offline) would 401. Wait for both an
  // authenticated session AND a resolved SW registration.
  useEffect(() => {
    if (status !== 'authenticated') return
    if (!registration) return
    if (typeof window === 'undefined') return
    if (Notification.permission !== 'granted') return
    subscribeToPush(registration)
  }, [status, registration])

  return null
}
