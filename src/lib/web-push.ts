// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Web Push VAPID Wrapper
// ═══════════════════════════════════════════════════════════

import webPush from 'web-push'
import { env } from '@/lib/env'

let initialized = false

function ensureVapid() {
  if (initialized) return
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    throw new Error('VAPID 키가 설정되지 않았습니다.')
  }
  webPush.setVapidDetails(
    `mailto:${env.WEB_PUSH_EMAIL}`,
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY,
  )
  initialized = true
}

export interface PushPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  url?: string
}

export async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
): Promise<boolean> {
  try {
    ensureVapid()
    await webPush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      JSON.stringify(payload),
      { TTL: 3600 },
    )
    return true
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode
    if (statusCode === 410 || statusCode === 404) {
      // Subscription expired or invalid — caller should clean up
      return false
    }
    console.error('[WebPush] 발송 실패:', error)
    return false
  }
}
