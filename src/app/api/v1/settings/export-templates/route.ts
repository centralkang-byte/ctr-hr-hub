// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Export Template API
// GET: 내보내기 템플릿 목록 / POST: 내보내기 템플릿 생성
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiPaginated, buildPagination, apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { exportTemplateSearchSchema, exportTemplateCreateSchema } from '@/lib/schemas/settings'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = exportTemplateSearchSchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { page, limit, entityType } = parsed.data
    const where = {
      companyId: user.companyId,
      deletedAt: null,
      ...(entityType ? { entityType } : {}),
    }

    const [items, total] = await Promise.all([
      prisma.exportTemplate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.exportTemplate.count({ where }),
    ])

    return apiPaginated(items, buildPagination(page, limit, total))
  },
  perm(MODULE.SETTINGS, ACTION.VIEW),
)

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = exportTemplateCreateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    try {
      const result = await prisma.exportTemplate.create({
        data: {
          companyId: user.companyId,
          entityType: parsed.data.entityType,
          name: parsed.data.name,
          columns: parsed.data.columns,
          fileFormat: parsed.data.fileFormat,
          isDefault: parsed.data.isDefault,
          createdBy: user.employeeId,
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'settings.export_template.create',
        resourceType: 'exportTemplate',
        resourceId: result.id,
        companyId: user.companyId,
        changes: parsed.data,
        ip,
        userAgent,
      })

      return apiSuccess(result, 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.SETTINGS, ACTION.CREATE),
)
