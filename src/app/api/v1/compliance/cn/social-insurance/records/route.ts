// ═══════════════════════════════════════════════════════════
// CTR HR Hub — CN Social Insurance Records List
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiPaginated, buildPagination } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { socialInsuranceRecordSearchSchema } from '@/lib/schemas/compliance'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/compliance/cn/social-insurance/records ─
// List monthly social insurance records with filters

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = socialInsuranceRecordSearchSchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { page, limit, year, month, employeeId, insuranceType } = parsed.data
    const companyId = user.companyId

    const where = {
      companyId,
      year,
      month,
      ...(employeeId ? { employeeId } : {}),
      ...(insuranceType ? { insuranceType } : {}),
    }

    const [records, total] = await Promise.all([
      prisma.socialInsuranceRecord.findMany({
        where,
        orderBy: [{ insuranceType: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              employeeNo: true,
              department: { select: { name: true } },
            },
          },
        },
      }),
      prisma.socialInsuranceRecord.count({ where }),
    ])

    const serialized = records.map((r) => ({
      ...r,
      baseSalary: Number(r.baseSalary),
      employerAmount: Number(r.employerAmount),
      employeeAmount: Number(r.employeeAmount),
    }))

    return apiPaginated(serialized, buildPagination(page, limit, total))
  },
  perm(MODULE.COMPLIANCE, ACTION.VIEW),
)
