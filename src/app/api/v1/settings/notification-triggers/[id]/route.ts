// ═══════════════════════════════════════════════════════════
// CTR HR Hub — PUT/DELETE /api/v1/settings/notification-triggers/[id]
// 알림 트리거 수정/삭제
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'
import { badRequest, notFound, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { notificationTriggerUpdateSchema } from '@/lib/schemas/notification'
import type { SessionUser } from '@/types'

// ─── PUT — 트리거 수정 ───────────────────────────────────

export const PUT = withPermission(
  async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id } = await context.params
    const body: unknown = await req.json()
    const parsed = notificationTriggerUpdateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    try {
      const existing = await prisma.notificationTrigger.findFirst({
        where: {
          id,
          OR: [{ companyId: user.companyId }, { companyId: null }],
        },
      })
      if (!existing) throw notFound('알림 트리거를 찾을 수 없습니다.')

      const result = await prisma.notificationTrigger.update({
        where: { id },
        data: {
          ...(parsed.data.eventType !== undefined && { eventType: parsed.data.eventType }),
          ...(parsed.data.template !== undefined && { template: parsed.data.template }),
          ...(parsed.data.channels !== undefined && { channels: parsed.data.channels }),
          ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'settings.notification_trigger.update',
        resourceType: 'notification_trigger',
        resourceId: result.id,
        companyId: user.companyId,
        changes: parsed.data,
        ip,
        userAgent,
      })

      return apiSuccess(result)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.SETTINGS, ACTION.UPDATE),
)

// ─── DELETE — 트리거 삭제 ────────────────────────────────

export const DELETE = withPermission(
  async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id } = await context.params

    try {
      const existing = await prisma.notificationTrigger.findFirst({
        where: {
          id,
          OR: [{ companyId: user.companyId }, { companyId: null }],
        },
      })
      if (!existing) throw notFound('알림 트리거를 찾을 수 없습니다.')

      await prisma.notificationTrigger.delete({ where: { id } })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'settings.notification_trigger.delete',
        resourceType: 'notification_trigger',
        resourceId: id,
        companyId: user.companyId,
        ip,
        userAgent,
      })

      return apiSuccess({ id })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.SETTINGS, ACTION.DELETE),
)
