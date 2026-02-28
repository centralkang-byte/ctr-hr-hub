// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Enum Option Detail API
// PUT: ENUM 옵션 수정 / DELETE: ENUM 옵션 삭제
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { badRequest, notFound, isAppError, handlePrismaError } from '@/lib/errors'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { enumOptionUpdateSchema } from '@/lib/schemas/settings'
import type { SessionUser } from '@/types'

export const PUT = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const body: unknown = await req.json()
    const parsed = enumOptionUpdateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    try {
      const existing = await prisma.tenantEnumOption.findFirst({
        where: { id, companyId: user.companyId },
      })
      if (!existing) throw notFound('ENUM 옵션을 찾을 수 없습니다.')
      if (existing.isSystem) throw badRequest('시스템 ENUM 옵션은 수정할 수 없습니다.')

      const data = parsed.data
      const result = await prisma.tenantEnumOption.update({
        where: { id },
        data: {
          ...(data.label !== undefined && { label: data.label }),
          ...(data.color !== undefined && { color: data.color }),
          ...(data.icon !== undefined && { icon: data.icon }),
          ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'settings.enum_option.update',
        resourceType: 'tenantEnumOption',
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
      const existing = await prisma.tenantEnumOption.findFirst({
        where: { id, companyId: user.companyId },
      })
      if (!existing) throw notFound('ENUM 옵션을 찾을 수 없습니다.')
      if (existing.isSystem) throw badRequest('시스템 ENUM 옵션은 삭제할 수 없습니다.')

      await prisma.tenantEnumOption.delete({ where: { id } })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'settings.enum_option.delete',
        resourceType: 'tenantEnumOption',
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
