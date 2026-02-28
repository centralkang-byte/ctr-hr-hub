// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Compensation History List
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { historySearchSchema } from '@/lib/schemas/compensation'
import type { SessionUser } from '@/types'
import type { CompensationChangeType } from '@/generated/prisma/client'

// ─── GET /api/v1/compensation/history ────────────────────
// Paginated compensation history with filters

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = historySearchSchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { employeeId, departmentId, changeType, page, limit } = parsed.data
    const companyId = user.companyId

    try {
      const where = {
        companyId,
        ...(employeeId ? { employeeId } : {}),
        ...(departmentId
          ? { employee: { departmentId } }
          : {}),
        ...(changeType
          ? { changeType: changeType as CompensationChangeType }
          : {}),
      }

      const [records, total] = await Promise.all([
        prisma.compensationHistory.findMany({
          where,
          orderBy: { effectiveDate: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            employee: {
              select: {
                name: true,
                department: { select: { name: true } },
                jobGrade: { select: { name: true } },
              },
            },
            approver: {
              select: { name: true },
            },
          },
        }),
        prisma.compensationHistory.count({ where }),
      ])

      // Convert Decimal fields to numbers for JSON serialization
      const serialized = records.map((r) => ({
        ...r,
        previousBaseSalary: Number(r.previousBaseSalary),
        newBaseSalary: Number(r.newBaseSalary),
        changePct: r.changePct != null ? Number(r.changePct) : null,
        compaRatio: r.compaRatio != null ? Number(r.compaRatio) : null,
      }))

      return apiPaginated(serialized, buildPagination(page, limit, total))
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.COMPENSATION, ACTION.VIEW),
)
