// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/org/departments
//              POST /api/v1/org/departments
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import {
  departmentSearchSchema,
  departmentCreateSchema,
} from '@/lib/schemas/org'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/org/departments ──────────────────────────

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = departmentSearchSchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { page, limit, search, companyId, parentId, isActive } = parsed.data

    const companyFilter =
      user.role === 'SUPER_ADMIN'
        ? companyId
          ? { companyId }
          : {}
        : { companyId: user.companyId }

    const where = {
      deletedAt: null,
      ...companyFilter,
      ...(parentId !== undefined ? { parentId } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { code: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    }

    try {
      const [departments, total] = await Promise.all([
        prisma.department.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }],
        }),
        prisma.department.count({ where }),
      ])

      return apiPaginated(departments, buildPagination(page, limit, total))
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.ORG, ACTION.VIEW),
)

// ─── POST /api/v1/org/departments ─────────────────────────

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = departmentCreateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    // Non-SUPER_ADMIN: silently force companyId to their own company
    const effectiveCompanyId =
      user.role === 'SUPER_ADMIN' ? parsed.data.companyId : user.companyId

    try {
      const department = await prisma.department.create({
        data: { ...parsed.data, companyId: effectiveCompanyId },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'org.department.create',
        resourceType: 'department',
        resourceId: department.id,
        companyId: department.companyId,
        ip,
        userAgent,
      })

      return apiSuccess(department, 201)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.ORG, ACTION.CREATE),
)
