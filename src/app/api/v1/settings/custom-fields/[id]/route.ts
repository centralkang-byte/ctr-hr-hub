// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Custom Field Detail API
// GET: 단건 조회 / PUT: 수정 / DELETE: 소프트 삭제
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { badRequest, notFound, isAppError, handlePrismaError } from '@/lib/errors'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { customFieldUpdateSchema } from '@/lib/schemas/settings'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (_req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params

    const field = await prisma.customField.findFirst({
      where: { id, companyId: user.companyId, deletedAt: null },
    })
    if (!field) throw notFound('커스텀 필드를 찾을 수 없습니다.')

    return apiSuccess(field)
  },
  perm(MODULE.SETTINGS, ACTION.VIEW),
)

export const PUT = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const body: unknown = await req.json()
    const parsed = customFieldUpdateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    try {
      const existing = await prisma.customField.findFirst({
        where: { id, companyId: user.companyId, deletedAt: null },
      })
      if (!existing) throw notFound('커스텀 필드를 찾을 수 없습니다.')

      const data = parsed.data
      const result = await prisma.customField.update({
        where: { id },
        data: {
          ...(data.fieldLabel !== undefined && { fieldLabel: data.fieldLabel }),
          ...(data.fieldType !== undefined && { fieldType: data.fieldType }),
          ...(data.options !== undefined && { options: data.options }),
          ...(data.isRequired !== undefined && { isRequired: data.isRequired }),
          ...(data.isSearchable !== undefined && { isSearchable: data.isSearchable }),
          ...(data.isVisibleToEmployee !== undefined && { isVisibleToEmployee: data.isVisibleToEmployee }),
          ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
          ...(data.sectionLabel !== undefined && { sectionLabel: data.sectionLabel }),
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'settings.custom_field.update',
        resourceType: 'customField',
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
      const existing = await prisma.customField.findFirst({
        where: { id, companyId: user.companyId, deletedAt: null },
      })
      if (!existing) throw notFound('커스텀 필드를 찾을 수 없습니다.')

      await prisma.customField.update({
        where: { id },
        data: { deletedAt: new Date() },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'settings.custom_field.delete',
        resourceType: 'customField',
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
