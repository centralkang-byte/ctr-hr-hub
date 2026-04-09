// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/push/vapid-key
// VAPID public key 반환 (클라이언트 Push 구독용)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { env } from '@/lib/env'
import { apiSuccess } from '@/lib/api'
import { withAuth } from '@/lib/permissions'

export const GET = withAuth(async (_req: NextRequest, _context, _user) => {
  return apiSuccess({ vapidPublicKey: env.VAPID_PUBLIC_KEY || null })
})
