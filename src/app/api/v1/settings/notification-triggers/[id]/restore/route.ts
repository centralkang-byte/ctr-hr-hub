// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/settings/notification-triggers/[id]/restore
// 소프트 삭제된 알림 트리거 복구
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { notFound, conflict, isAppError, handlePrismaError } from '@/lib/errors'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import type { SessionUser } from '@/types'

export const POST = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params

    try {
      const existing = await prisma.notificationTrigger.findFirst({
        where: {
          id,
          deletedAt: { not: null },
          OR: [{ companyId: user.companyId }, { companyId: null }],
        },
      })
      if (!existing) throw notFound('삭제된 알림 트리거를 찾을 수 없습니다.')

      // unique constraint: eventType @unique
      const duplicate = await prisma.notificationTrigger.findFirst({
        where: { eventType: existing.eventType, deletedAt: null, id: { not: id } },
      })
      if (duplicate) throw conflict(`동일한 이벤트 타입의 트리거가 이미 존재합니다: "${existing.eventType}"`)

      const restored = await prisma.notificationTrigger.update({
        where: { id },
        data: { deletedAt: null },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'settings.notification_trigger.restore',
        resourceType: 'notification_trigger',
        resourceId: id,
        companyId: user.companyId,
        ip,
        userAgent,
      })

      return apiSuccess(restored)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.SETTINGS, ACTION.UPDATE),
)
