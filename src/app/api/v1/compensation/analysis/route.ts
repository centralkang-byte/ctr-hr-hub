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
          companyId,
          status: 'ACTIVE',
          ...(departmentId ? { departmentId } : {}),
          ...(jobGradeId ? { jobGradeId } : {}),
        },
        select: {
          id: true,
          name: true,
          jobGradeId: true,
          department: { select: { name: true } },
          jobGrade: { select: { name: true } },
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
        // Latest CompensationHistory
        const latestComp = await prisma.compensationHistory.findFirst({
          where: { employeeId: emp.id, companyId },
          orderBy: { effectiveDate: 'desc' },
        })
        const currentSalary = latestComp
          ? Number(latestComp.newBaseSalary)
          : 0

        // Matching SalaryBand
        const salaryBand = emp.jobGradeId
          ? await prisma.salaryBand.findFirst({
              where: {
                companyId,
                jobGradeId: emp.jobGradeId,
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
          department: emp.department?.name ?? null,
          jobGrade: emp.jobGrade?.name ?? null,
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
