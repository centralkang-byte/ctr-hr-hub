// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Compensation Simulation
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { simulationSearchSchema } from '@/lib/schemas/compensation'
import {
  calculateCompaRatio,
  calculateBudgetSummary,
} from '@/lib/compensation'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/compensation/simulation ─────────────────
// Enriched employee list with salary simulation data

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = simulationSearchSchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { cycleId, departmentId, page, limit } = parsed.data
    const companyId = user.companyId

    try {
      // 1. Fetch ACTIVE employees (optionally filtered by department)
      const assignmentFilter = {
        companyId,
        status: 'ACTIVE' as const,
        isPrimary: true,
        endDate: null,
        ...(departmentId ? { departmentId } : {}),
      }
      const employeeWhere = {
        assignments: { some: assignmentFilter },
      }

      const [employees, total] = await Promise.all([
        prisma.employee.findMany({
          where: employeeWhere,
          orderBy: [{ name: 'asc' }],
          skip: (page - 1) * limit,
          take: limit,
          include: {
            assignments: {
              where: { isPrimary: true, endDate: null },
              take: 1,
              select: {
                jobGradeId: true,
                department: { select: { id: true, name: true } },
                jobGrade: { select: { id: true, code: true, name: true } },
              },
            },
          },
        }),
        prisma.employee.count({ where: employeeWhere }),
      ])

      // 2. Fetch salary adjustment matrix entries for this cycle
      const matrixEntries = await prisma.salaryAdjustmentMatrix.findMany({
        where: { companyId, cycleId },
      })

      // 3. For each employee, gather compensation data
      const enrichedItems = await Promise.all(
        employees.map(async (emp) => {
          const empAssignment = emp.assignments?.[0]
          const empJobGradeId = empAssignment?.jobGradeId

          // Latest CompensationHistory to get current salary
          const latestComp = await prisma.compensationHistory.findFirst({
            where: { employeeId: emp.id, companyId },
            orderBy: { effectiveDate: 'desc' },
          })
          const currentSalary = latestComp
            ? Number(latestComp.newBaseSalary)
            : 0

          // Matching SalaryBand by jobGradeId
          const salaryBand = empJobGradeId
            ? await prisma.salaryBand.findFirst({
                where: {
                  companyId,
                  jobGradeId: empJobGradeId,
                  deletedAt: null,
                },
                orderBy: { effectiveFrom: 'desc' },
              })
            : null
          const midSalary = salaryBand ? Number(salaryBand.midSalary) : 0

          // PerformanceEvaluation for the cycle to get emsBlock
          const evaluation = await prisma.performanceEvaluation.findFirst({
            where: { employeeId: emp.id, cycleId },
          })
          const emsBlock = evaluation?.emsBlock ?? null

          // SalaryAdjustmentMatrix entry for this emsBlock
          const matrixEntry = emsBlock
            ? matrixEntries.find((m) => m.emsBlock === emsBlock)
            : null

          const compaRatio = calculateCompaRatio(currentSalary, midSalary)
          const recommendedPct = matrixEntry
            ? Number(matrixEntry.recommendedIncreasePct)
            : 0
          const minPct = matrixEntry
            ? Number(matrixEntry.minIncreasePct ?? 0)
            : 0
          const maxPct = matrixEntry
            ? Number(matrixEntry.maxIncreasePct ?? recommendedPct)
            : 0
          const recommendedNewSalary = Math.round(
            currentSalary * (1 + recommendedPct / 100),
          )

          return {
            id: emp.id,
            name: emp.name,
            department: (empAssignment as any)?.department?.name ?? null, // eslint-disable-line @typescript-eslint/no-explicit-any
            jobGrade: (empAssignment as any)?.jobGrade?.name ?? null, // eslint-disable-line @typescript-eslint/no-explicit-any
            currentSalary,
            emsBlock,
            compaRatio,
            recommendedPct,
            minPct,
            maxPct,
            recommendedNewSalary,
          }
        }),
      )

      // 4. Calculate budget summary
      const budgetSummary = calculateBudgetSummary(
        enrichedItems.map((item) => ({
          currentSalary: item.currentSalary,
          newSalary: item.recommendedNewSalary,
        })),
      )

      return apiSuccess({
        items: enrichedItems,
        pagination: buildPagination(page, limit, total),
        budgetSummary,
      })
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.COMPENSATION, ACTION.VIEW),
)
