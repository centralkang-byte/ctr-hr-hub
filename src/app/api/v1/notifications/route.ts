// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/notifications
// 내 알림 목록 (페이지네이션 + 필터)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiPaginated, apiError, buildPagination } from '@/lib/api'
import { badRequest, unauthorized } from '@/lib/errors'
import { notificationListSchema } from '@/lib/schemas/notification'
import type { SessionUser } from '@/types'
import type { Prisma } from '@/generated/prisma/client'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return apiError(unauthorized())
    const user = session.user as SessionUser

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
  } catch (error) {
    return apiError(error)
  }
}
