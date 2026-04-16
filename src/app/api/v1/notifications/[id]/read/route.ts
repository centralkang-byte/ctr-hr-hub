// ═══════════════════════════════════════════════════════════
// CTR HR Hub — PUT /api/v1/notifications/[id]/read
// 단건 읽음 처리
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'
import { notFound, forbidden } from '@/lib/errors'
import { withAuth } from '@/lib/permissions'

export const PUT = withAuth(async (
  _req: NextRequest,
  context,
  user,
) => {
  const { id } = await context.params

  const notification = await prisma.notification.findUnique({
    where: { id },
  })

  if (!notification) return apiError(notFound('알림을 찾을 수 없습니다.'))
  if (notification.employeeId !== user.employeeId) {
    return apiError(forbidden('본인의 알림만 읽음 처리할 수 있습니다.'))
  }

  const updated = await prisma.notification.update({
    where: { id },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  })

  return apiSuccess(updated)
})
