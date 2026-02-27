// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/search/employees
// ═══════════════════════════════════════════════════════════

import { z } from 'zod'
import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

const searchQuerySchema = z.object({
  search: z.string().optional(),
  company_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(20).default(10),
})

// ─── GET /api/v1/search/employees ────────────────────────

export const GET = withPermission(
  async (
    req: NextRequest,
    _context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const rawParams = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = searchQuerySchema.safeParse(rawParams)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { search, company_id, limit } = parsed.data

    // Company scope: SUPER_ADMIN can filter by company_id or see all,
    // others only see their own company
    const companyFilter =
      user.role === 'SUPER_ADMIN'
        ? company_id
          ? { companyId: company_id }
          : {}
        : { companyId: user.companyId }

    const searchConditions = search
      ? [
          { name: { contains: search, mode: 'insensitive' as const } },
          { nameEn: { contains: search, mode: 'insensitive' as const } },
          { employeeNo: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
        ]
      : []

    const where = {
      deletedAt: null,
      ...companyFilter,
      ...(searchConditions.length > 0 ? { OR: searchConditions } : {}),
    }

    const results = await prisma.employee.findMany({
      where,
      take: limit,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        nameEn: true,
        employeeNo: true,
        email: true,
        photoUrl: true,
        department: { select: { name: true } },
        jobGrade: { select: { name: true } },
      },
    })

    return apiSuccess(results)
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)
