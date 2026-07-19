// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/contracts/expiring
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, forbidden } from '@/lib/errors'
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
    // 전사 계약만료 명단은 HR 권한자 전용 — EMPLOYEES VIEW(전 롤 보유)로는 과다 노출
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'HR_ADMIN') {
      throw forbidden('접근 권한이 없습니다.')
    }

    const rawParams = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = expiringQuerySchema.safeParse(rawParams)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { days, companyId } = parsed.data

    const now = new Date()
    const today = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    ))
    const futureDate = new Date(today)
    futureDate.setUTCDate(futureDate.getUTCDate() + days)

    // Company scope enforcement via assignments
    const assignmentCompanyFilter =
      user.role === 'SUPER_ADMIN'
        ? companyId
          ? { companyId }
          : {}
        : { companyId: user.companyId }
    const assignmentFence = {
      ...assignmentCompanyFilter,
      isPrimary: true,
      employmentType: 'CONTRACT' as const,
      status: 'ACTIVE' as const,
      effectiveDate: { lte: today },
      OR: [{ endDate: null }, { endDate: { gt: today } }],
    }

    const employees = await prisma.employee.findMany({
      where: {
        deletedAt: null,
        contractEndDate: {
          gte: today,
          lte: futureDate,
        },
        assignments: {
          some: assignmentFence,
        },
      },
      select: {
        id: true,
        name: true,
        employeeNo: true,
        email: true,
        contractNumber: true,
        contractStartDate: true,
        contractEndDate: true,
        assignments: {
          where: assignmentFence,
          orderBy: { effectiveDate: 'desc' },
          take: 1,
          select: {
            companyId: true,
            contractType: true,
            department: { select: { id: true, name: true } },
            jobGrade: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { contractEndDate: 'asc' },
    })

    return apiSuccess(employees)
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)
