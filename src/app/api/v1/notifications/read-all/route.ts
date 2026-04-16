// ═══════════════════════════════════════════════════════════
// CTR HR Hub — PUT /api/v1/notifications/read-all
// 전체 읽음 처리
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withAuth } from '@/lib/permissions'

export const PUT = withAuth(async (_req: NextRequest, _context, user) => {
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
})
