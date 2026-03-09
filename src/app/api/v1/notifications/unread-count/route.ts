// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/notifications/unread-count
// 미읽음 수 (헤더 뱃지용)
// D-3: Nudge engine lazy trigger — 폴링 시마다 평가
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'
import { unauthorized } from '@/lib/errors'
import type { SessionUser } from '@/types'
import { checkNudgesForUser } from '@/lib/nudge'

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

    // D-3: Lazy nudge evaluation — fire-and-forget
    // 처리 지연 태스크가 있으면 알림 발송 (다음 폴링에서 count 증가로 표시됨)
    void checkNudgesForUser(user.companyId, user.employeeId)

    return apiSuccess({ count })
  } catch (error) {
    return apiError(error)
  }
}

