// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Export Template Detail API
// GET: 단건 조회 / PUT: 수정 / DELETE: 소프트 삭제
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { badRequest, notFound, isAppError, handlePrismaError } from '@/lib/errors'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { exportTemplateUpdateSchema } from '@/lib/schemas/settings'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (_req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params

    const template = await prisma.exportTemplate.findFirst({
      where: { id, companyId: user.companyId, deletedAt: null },
    })
    if (!template) throw notFound('내보내기 템플릿을 찾을 수 없습니다.')

    return apiSuccess(template)
  },
  perm(MODULE.SETTINGS, ACTION.VIEW),
)

export const PUT = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const body: unknown = await req.json()
    const parsed = exportTemplateUpdateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    try {
      const existing = await prisma.exportTemplate.findFirst({
        where: { id, companyId: user.companyId, deletedAt: null },
      })
      if (!existing) throw notFound('내보내기 템플릿을 찾을 수 없습니다.')

      const data = parsed.data
      const result = await prisma.exportTemplate.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.columns !== undefined && { columns: data.columns }),
          ...(data.fileFormat !== undefined && { fileFormat: data.fileFormat }),
          ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'settings.export_template.update',
        resourceType: 'exportTemplate',
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
      const existing = await prisma.exportTemplate.findFirst({
        where: { id, companyId: user.companyId, deletedAt: null },
      })
      if (!existing) throw notFound('내보내기 템플릿을 찾을 수 없습니다.')

      await prisma.exportTemplate.update({
        where: { id },
        data: { deletedAt: new Date() },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'settings.export_template.delete',
        resourceType: 'exportTemplate',
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
