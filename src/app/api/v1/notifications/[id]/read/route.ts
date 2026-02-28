// ═══════════════════════════════════════════════════════════
// CTR HR Hub — PUT /api/v1/notifications/[id]/read
// 단건 읽음 처리
// ═══════════════════════════════════════════════════════════

import { type NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'
import { unauthorized, notFound, forbidden } from '@/lib/errors'
import type { SessionUser } from '@/types'

export async function PUT(
  _req: NextRequest,
  context: { params: Promise<Record<string, string>> },
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return apiError(unauthorized())
    const user = session.user as SessionUser

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
  } catch (error) {
    return apiError(error)
  }
}
