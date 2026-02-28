// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Term Override Detail API
// PUT: 용어 수정 / DELETE: 용어 삭제
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { badRequest, notFound, isAppError, handlePrismaError } from '@/lib/errors'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { termOverrideUpsertSchema } from '@/lib/schemas/settings'
import type { SessionUser } from '@/types'

export const PUT = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const body: unknown = await req.json()
    const parsed = termOverrideUpsertSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    try {
      const existing = await prisma.termOverride.findFirst({
        where: { id, companyId: user.companyId },
      })
      if (!existing) throw notFound('용어를 찾을 수 없습니다.')

      const result = await prisma.termOverride.update({
        where: { id },
        data: {
          termKey: parsed.data.termKey,
          labelKo: parsed.data.labelKo,
          labelEn: parsed.data.labelEn,
          labelLocal: parsed.data.labelLocal,
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'settings.term_override.update',
        resourceType: 'termOverride',
        resourceId: result.id,
        companyId: user.companyId,
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

export const DELETE = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params

    try {
      const existing = await prisma.termOverride.findFirst({
        where: { id, companyId: user.companyId },
      })
      if (!existing) throw notFound('용어를 찾을 수 없습니다.')

      await prisma.termOverride.delete({ where: { id } })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'settings.term_override.delete',
        resourceType: 'termOverride',
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
