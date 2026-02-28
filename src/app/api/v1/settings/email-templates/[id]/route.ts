// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Email Template Detail API
// GET: 단건 조회 / PUT: 수정 / DELETE: 삭제
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { badRequest, notFound, isAppError, handlePrismaError } from '@/lib/errors'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { emailTemplateUpdateSchema } from '@/lib/schemas/settings'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (_req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params

    const template = await prisma.emailTemplate.findFirst({
      where: { id, companyId: user.companyId },
    })
    if (!template) throw notFound('이메일 템플릿을 찾을 수 없습니다.')

    return apiSuccess(template)
  },
  perm(MODULE.SETTINGS, ACTION.VIEW),
)

export const PUT = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const body: unknown = await req.json()
    const parsed = emailTemplateUpdateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    try {
      const existing = await prisma.emailTemplate.findFirst({
        where: { id, companyId: user.companyId },
      })
      if (!existing) throw notFound('이메일 템플릿을 찾을 수 없습니다.')
      if (existing.isSystem) throw badRequest('시스템 템플릿은 수정할 수 없습니다.')

      const data = parsed.data
      const result = await prisma.emailTemplate.update({
        where: { id },
        data: {
          ...(data.subject !== undefined && { subject: data.subject }),
          ...(data.body !== undefined && { body: data.body }),
          ...(data.variables !== undefined && { variables: data.variables }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'settings.email_template.update',
        resourceType: 'emailTemplate',
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
      const existing = await prisma.emailTemplate.findFirst({
        where: { id, companyId: user.companyId },
      })
      if (!existing) throw notFound('이메일 템플릿을 찾을 수 없습니다.')
      if (existing.isSystem) throw badRequest('시스템 템플릿은 삭제할 수 없습니다.')

      await prisma.emailTemplate.delete({ where: { id } })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'settings.email_template.delete',
        resourceType: 'emailTemplate',
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
