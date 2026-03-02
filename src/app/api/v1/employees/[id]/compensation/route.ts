// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/employees/[id]/compensation
// 현재 유효 급여 + 법인 급여 밴드 정보 반환 (HR Admin only)
//
// Schema adjustments from template:
// - compensationHistories relation: confirmed exists on Employee
// - AllowanceRecord: does NOT have startDate/endDate/isTaxable fields;
//   uses yearMonth (String) for period. Fetched without date filtering.
// - SalaryBand: confirmed exists with minSalary/midSalary/maxSalary/effectiveFrom/effectiveTo/deletedAt
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id } = await context.params

    const scopeFilter =
      user.role === 'SUPER_ADMIN'
        ? {}
        : { assignments: { some: { companyId: user.companyId, isPrimary: true, endDate: null } } }

    const employee = await prisma.employee.findFirst({
      where: { id, deletedAt: null, ...scopeFilter },
      include: {
        assignments: {
          where: { isPrimary: true, endDate: null },
          take: 1,
          include: {
            jobGrade: { select: { id: true, name: true } },
          },
        },
        // compensationHistories: confirmed relation name from schema
        compensationHistories: {
          orderBy: { effectiveDate: 'desc' },
          take: 1,
          select: {
            id: true,
            newBaseSalary: true,
            currency: true,
            effectiveDate: true,
            changeType: true,
            compaRatio: true,
          },
        },
      },
    })
    if (!employee) throw notFound('직원을 찾을 수 없습니다.')

    const assignment = employee.assignments[0]
    // compensationHistories is a named relation ("CompensationEmployee") — Prisma resolves it as compensationHistories
    const latestComp = employee.compensationHistories?.[0] ?? null

    // 법인의 현재 유효 SalaryBand 조회 — model confirmed in schema
    let salaryBand = null
    if (assignment?.jobGradeId && assignment?.companyId) {
      salaryBand = await prisma.salaryBand.findFirst({
        where: {
          companyId: assignment.companyId,
          jobGradeId: assignment.jobGradeId,
          effectiveFrom: { lte: new Date() },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
          deletedAt: null,
        },
        select: {
          id: true,
          minSalary: true,
          midSalary: true,
          maxSalary: true,
          currency: true,
        },
        orderBy: { effectiveFrom: 'desc' },
      })
    }

    // AllowanceRecord: schema does NOT have startDate/endDate/isTaxable fields.
    // The model uses yearMonth (String e.g. "2025-03") for period tracking.
    // We fetch all active allowances ordered by yearMonth desc, take latest per type
    // by fetching most recent records (no date range filter available).
    let allowances: {
      id: string
      allowanceType: string
      amount: number
      currency: string
      yearMonth: string
    }[] = []
    try {
      const raw = await prisma.allowanceRecord.findMany({
        where: { employeeId: id },
        select: {
          id: true,
          allowanceType: true,
          amount: true,
          currency: true,
          yearMonth: true,
        },
        orderBy: { yearMonth: 'desc' },
        take: 20,
      })
      allowances = raw.map((a) => ({
        ...a,
        allowanceType: String(a.allowanceType),
        amount: Number(a.amount),
      }))
    } catch {
      // Fallback: AllowanceRecord query failed
      allowances = []
    }

    return apiSuccess({
      latestComp: latestComp
        ? {
            ...latestComp,
            newBaseSalary: Number(latestComp.newBaseSalary),
            compaRatio: latestComp.compaRatio !== null ? Number(latestComp.compaRatio) : null,
          }
        : null,
      salaryBand: salaryBand
        ? {
            id: salaryBand.id,
            currency: salaryBand.currency,
            minSalary: Number(salaryBand.minSalary),
            midSalary: Number(salaryBand.midSalary),
            maxSalary: Number(salaryBand.maxSalary),
          }
        : null,
      allowances,
      jobGrade: assignment?.jobGrade ?? null,
    })
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)
