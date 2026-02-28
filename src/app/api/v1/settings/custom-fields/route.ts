// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Custom Field API
// GET: 커스텀 필드 목록 / POST: 커스텀 필드 생성
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiPaginated, buildPagination, apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { customFieldSearchSchema, customFieldCreateSchema } from '@/lib/schemas/settings'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = customFieldSearchSchema.safeParse(params)
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
      prisma.customField.findMany({
        where,
        orderBy: [{ entityType: 'asc' }, { sortOrder: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.customField.count({ where }),
    ])

    return apiPaginated(items, buildPagination(page, limit, total))
  },
  perm(MODULE.SETTINGS, ACTION.VIEW),
)

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = customFieldCreateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    try {
      const result = await prisma.customField.create({
        data: {
          companyId: user.companyId,
          entityType: parsed.data.entityType,
          fieldKey: parsed.data.fieldKey,
          fieldLabel: parsed.data.fieldLabel,
          fieldType: parsed.data.fieldType,
          options: parsed.data.options ?? undefined,
          isRequired: parsed.data.isRequired,
          isSearchable: parsed.data.isSearchable,
          isVisibleToEmployee: parsed.data.isVisibleToEmployee,
          sortOrder: parsed.data.sortOrder,
          ...(parsed.data.sectionLabel ? { sectionLabel: parsed.data.sectionLabel } : {}),
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'settings.custom_field.create',
        resourceType: 'customField',
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
