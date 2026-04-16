// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET/PUT /api/v1/notifications/preferences
// 사용자 알림 수신 설정 조회/저장
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withAuth } from '@/lib/permissions'

export const GET = withAuth(async (_req: NextRequest, _context, user) => {
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
})

export const PUT = withAuth(async (req: NextRequest, _context, user) => {
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
})
