// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/push/vapid-key
// VAPID public key 반환 (클라이언트 Push 구독용)
// ═══════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { env } from '@/lib/env'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: '인증 필요' }, { status: 401 })
  }

  return NextResponse.json({
    data: {
      vapidPublicKey: env.VAPID_PUBLIC_KEY || null,
    },
  })
}
