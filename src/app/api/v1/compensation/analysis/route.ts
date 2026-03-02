// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Compensation Analysis (Compa-Ratio Distribution)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { analysisSearchSchema } from '@/lib/schemas/compensation'
import {
  calculateCompaRatio,
  getCompaRatioBand,
  type CompaRatioBand,
} from '@/lib/compensation'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/compensation/analysis ───────────────────
// Returns compa-ratio distribution data for active employees

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = analysisSearchSchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { departmentId, jobGradeId } = parsed.data
    const companyId = user.companyId

    try {
      // 1. Fetch all active employees (with optional filters)
      const employees = await prisma.employee.findMany({
        where: {
          assignments: {
            some: {
              companyId,
              status: 'ACTIVE',
              isPrimary: true,
              endDate: null,
              ...(departmentId ? { departmentId } : {}),
              ...(jobGradeId ? { jobGradeId } : {}),
            },
          },
        },
        select: {
          id: true,
          name: true,
          assignments: {
            where: { isPrimary: true, endDate: null },
            take: 1,
            select: {
              jobGradeId: true,
              department: { select: { name: true } },
              jobGrade: { select: { name: true } },
            },
          },
        },
      })

      // 2. Calculate compa-ratio for each employee
      const employeeRatios: Array<{
        id: string
        name: string
        department: string | null
        jobGrade: string | null
        currentSalary: number
        midSalary: number
        compaRatio: number
        band: CompaRatioBand
      }> = []

      for (const emp of employees) {
        const assignment = emp.assignments?.[0]
        const empJobGradeId = assignment?.jobGradeId

        // Latest CompensationHistory
        const latestComp = await prisma.compensationHistory.findFirst({
          where: { employeeId: emp.id, companyId },
          orderBy: { effectiveDate: 'desc' },
        })
        const currentSalary = latestComp
          ? Number(latestComp.newBaseSalary)
          : 0

        // Matching SalaryBand
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

        // Skip employees without salary band data
        if (midSalary <= 0) continue

        const compaRatio = calculateCompaRatio(currentSalary, midSalary)
        const band = getCompaRatioBand(compaRatio)

        employeeRatios.push({
          id: emp.id,
          name: emp.name,
          department: (assignment as any)?.department?.name ?? null, // eslint-disable-line @typescript-eslint/no-explicit-any
          jobGrade: (assignment as any)?.jobGrade?.name ?? null, // eslint-disable-line @typescript-eslint/no-explicit-any
          currentSalary,
          midSalary,
          compaRatio,
          band,
        })
      }

      // 3. Group into 5 bands
      const bandOrder: CompaRatioBand[] = [
        'VERY_LOW',
        'LOW',
        'AT_RANGE',
        'HIGH',
        'VERY_HIGH',
      ]
      const totalCount = employeeRatios.length

      const distribution = bandOrder.map((band) => {
        const count = employeeRatios.filter((e) => e.band === band).length
        return {
          band,
          count,
          percentage:
            totalCount > 0
              ? Math.round((count / totalCount) * 10000) / 100
              : 0,
        }
      })

      // 4. Average compa-ratio
      const averageCompaRatio =
        totalCount > 0
          ? Math.round(
              (employeeRatios.reduce((sum, e) => sum + e.compaRatio, 0) /
                totalCount) *
                100,
            ) / 100
          : 0

      // 5. Top 10 lowest compa-ratio employees
      const lowCompaEmployees = [...employeeRatios]
        .sort((a, b) => a.compaRatio - b.compaRatio)
        .slice(0, 10)
        .map((e) => ({
          id: e.id,
          name: e.name,
          department: e.department,
          jobGrade: e.jobGrade,
          currentSalary: e.currentSalary,
          midSalary: e.midSalary,
          compaRatio: e.compaRatio,
          band: e.band,
        }))

      return apiSuccess({
        distribution,
        averageCompaRatio,
        lowCompaEmployees,
      })
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.COMPENSATION, ACTION.VIEW),
)
