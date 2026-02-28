// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Enum Option API
// GET: ENUM 옵션 목록 / POST: ENUM 옵션 생성
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiPaginated, buildPagination, apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { enumOptionSearchSchema, enumOptionCreateSchema } from '@/lib/schemas/settings'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = enumOptionSearchSchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { page, limit, enumGroup } = parsed.data
    const where = {
      companyId: user.companyId,
      ...(enumGroup ? { enumGroup } : {}),
    }

    const [items, total] = await Promise.all([
      prisma.tenantEnumOption.findMany({
        where,
        orderBy: [{ enumGroup: 'asc' }, { sortOrder: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.tenantEnumOption.count({ where }),
    ])

    return apiPaginated(items, buildPagination(page, limit, total))
  },
  perm(MODULE.SETTINGS, ACTION.VIEW),
)

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = enumOptionCreateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    try {
      const result = await prisma.tenantEnumOption.create({
        data: {
          companyId: user.companyId,
          enumGroup: parsed.data.enumGroup,
          optionKey: parsed.data.optionKey,
          label: parsed.data.label,
          color: parsed.data.color,
          icon: parsed.data.icon,
          sortOrder: parsed.data.sortOrder,
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'settings.enum_option.create',
        resourceType: 'tenantEnumOption',
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
