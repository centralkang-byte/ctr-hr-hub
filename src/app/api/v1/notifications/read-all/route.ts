// ═══════════════════════════════════════════════════════════
// CTR HR Hub — PUT /api/v1/notifications/read-all
// 전체 읽음 처리
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'
import { unauthorized } from '@/lib/errors'
import type { SessionUser } from '@/types'

export async function PUT(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return apiError(unauthorized())
    const user = session.user as SessionUser

    const result = await prisma.notification.updateMany({
      where: {
        employeeId: user.employeeId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    })

    return apiSuccess({ updated: result.count })
  } catch (error) {
    return apiError(error)
  }
}
