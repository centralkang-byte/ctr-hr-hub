// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/settings/email-templates/[id]/restore
// 소프트 삭제된 이메일 템플릿 복구
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
      const existing = await prisma.emailTemplate.findFirst({
        where: { id, companyId: user.companyId, deletedAt: { not: null } },
      })
      if (!existing) throw notFound('삭제된 이메일 템플릿을 찾을 수 없습니다.')

      // unique constraint: (companyId, eventType, channel, locale)
      const duplicate = await prisma.emailTemplate.findFirst({
        where: {
          companyId: user.companyId,
          eventType: existing.eventType,
          channel: existing.channel,
          locale: existing.locale,
          deletedAt: null,
          id: { not: id },
        },
      })
      if (duplicate) {
        throw conflict(
          `동일한 이벤트/채널/언어 조합의 템플릿이 이미 존재합니다 (${existing.eventType} / ${existing.channel} / ${existing.locale})`,
        )
      }

      const restored = await prisma.emailTemplate.update({
        where: { id },
        data: { deletedAt: null },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'settings.email_template.restore',
        resourceType: 'emailTemplate',
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
