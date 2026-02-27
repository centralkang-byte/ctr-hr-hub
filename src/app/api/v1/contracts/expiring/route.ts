// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/contracts/expiring
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── Schema ───────────────────────────────────────────────

const expiringQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  companyId: z.string().uuid().optional(),
})

// ─── GET /api/v1/contracts/expiring ───────────────────────

export const GET = withPermission(
  async (
    req: NextRequest,
    _context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const rawParams = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = expiringQuerySchema.safeParse(rawParams)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { days, companyId } = parsed.data

    const now = new Date()
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + days)

    // Company scope enforcement
    const companyFilter =
      user.role === 'SUPER_ADMIN'
        ? companyId
          ? { companyId }
          : {}
        : { companyId: user.companyId }

    const employees = await prisma.employee.findMany({
      where: {
        deletedAt: null,
        contractEndDate: {
          gte: now,
          lte: futureDate,
        },
        ...companyFilter,
      },
      select: {
        id: true,
        name: true,
        employeeNo: true,
        email: true,
        companyId: true,
        contractType: true,
        contractNumber: true,
        contractStartDate: true,
        contractEndDate: true,
        department: { select: { id: true, name: true } },
        jobGrade: { select: { id: true, name: true } },
      },
      orderBy: { contractEndDate: 'asc' },
    })

    return apiSuccess(employees)
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)
