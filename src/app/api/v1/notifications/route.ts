// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/notifications
// 내 알림 목록 (페이지네이션 + 필터)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiPaginated, apiError, buildPagination } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withAuth } from '@/lib/permissions'
import { notificationListSchema } from '@/lib/schemas/notification'
import type { Prisma } from '@/generated/prisma/client'

export const GET = withAuth(async (req: NextRequest, _context, user) => {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries())
  const parsed = notificationListSchema.safeParse(params)
  if (!parsed.success) {
    return apiError(badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues }))
  }

  const { page, limit, isRead, triggerType } = parsed.data

  const where: Prisma.NotificationWhereInput = {
    employeeId: user.employeeId,
    ...(isRead !== undefined ? { isRead } : {}),
    ...(triggerType ? { triggerType } : {}),
  }

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.notification.count({ where }),
  ])

  return apiPaginated(notifications, buildPagination(page, limit, total))
})
