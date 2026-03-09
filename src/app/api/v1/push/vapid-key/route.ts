// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/push/vapid-key
// VAPID public key 반환 (클라이언트 Push 구독용)
// ═══════════════════════════════════════════════════════════

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { env } from '@/lib/env'
import { apiSuccess, apiError } from '@/lib/api'
import { unauthorized } from '@/lib/errors'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return apiError(unauthorized('인증 필요'))
  }

  return apiSuccess({ vapidPublicKey: env.VAPID_PUBLIC_KEY || null })
}
