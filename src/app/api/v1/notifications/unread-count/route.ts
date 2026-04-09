// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/notifications/unread-count
// 미읽음 수 (헤더 뱃지용)
// D-3: Nudge engine lazy trigger — 폴링 시마다 평가
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withAuth } from '@/lib/permissions'
import { checkNudgesForUser } from '@/lib/nudge'

export const GET = withAuth(async (_req: NextRequest, _context, user) => {
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
})

