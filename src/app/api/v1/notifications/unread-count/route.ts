// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/notifications/unread-count
// 미읽음 수 (헤더 뱃지용)
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

    const count = await prisma.notification.count({
      where: {
        employeeId: user.employeeId,
        isRead: false,
      },
    })

    return apiSuccess({ count })
  } catch (error) {
    return apiError(error)
  }
}
