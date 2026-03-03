// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET/PUT /api/v1/notifications/preferences
// 사용자 알림 수신 설정 조회/저장
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'
import { unauthorized } from '@/lib/errors'
import type { SessionUser } from '@/types'

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return apiError(unauthorized())
    const user = session.user as SessionUser

    const prefs = await prisma.notificationPreference.findUnique({
      where: { employeeId: user.employeeId },
    })

    return apiSuccess(
      prefs ?? {
        employeeId: user.employeeId,
        preferences: {},
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
        timezone: 'Asia/Seoul',
      },
    )
  } catch (error) {
    return apiError(error)
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return apiError(unauthorized())
    const user = session.user as SessionUser

    const body = await req.json()
    const { preferences, quietHoursStart, quietHoursEnd, timezone } = body

    const updated = await prisma.notificationPreference.upsert({
      where: { employeeId: user.employeeId },
      create: {
        employeeId: user.employeeId,
        preferences: preferences ?? {},
        quietHoursStart: quietHoursStart ?? '22:00',
        quietHoursEnd: quietHoursEnd ?? '08:00',
        timezone: timezone ?? 'Asia/Seoul',
      },
      update: {
        ...(preferences !== undefined ? { preferences } : {}),
        ...(quietHoursStart !== undefined ? { quietHoursStart } : {}),
        ...(quietHoursEnd !== undefined ? { quietHoursEnd } : {}),
        ...(timezone !== undefined ? { timezone } : {}),
      },
    })

    return apiSuccess(updated)
  } catch (error) {
    return apiError(error)
  }
}
