// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Gender Pay Gap Analytics API
// GET /api/v1/analytics/gender-pay-gap
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { genderPayGapQuerySchema } from '@/lib/schemas/gender-pay-gap'
import type { SessionUser } from '@/types'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'

// ─── Types ───────────────────────────────────────────────

interface BreakdownItem {
  group: string
  groupId: string
  maleCount: number
  femaleCount: number
  maleAvgSalary: number
  femaleAvgSalary: number
  gapPercent: number
  maleAvgCompaRatio: number | null
  femaleAvgCompaRatio: number | null
}

interface GenderPayGapResponse {
  summary: {
    totalEmployees: number
    totalMale: number
    totalFemale: number
    overallMaleAvg: number
    overallFemaleAvg: number
    overallGapPercent: number
  }
  breakdown: BreakdownItem[]
}

// ─── Helpers ─────────────────────────────────────────────

function avg(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function gapPercent(maleAvg: number, femaleAvg: number): number {
  if (maleAvg === 0) return 0
  return ((maleAvg - femaleAvg) / maleAvg) * 100
}

// ─── GET Handler ─────────────────────────────────────────

export const GET = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const { groupBy, year } = genderPayGapQuerySchema.parse({
      groupBy: searchParams.get('groupBy') ?? undefined,
      year: searchParams.get('year') ?? undefined,
    })

    const companyFilter =
      user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

    // 1. Fetch all ACTIVE employees with gender M or F
    const employees = await prisma.employee.findMany({
      where: {
        ...(Object.keys(companyFilter).length > 0
          ? { assignments: { some: { ...companyFilter, status: 'ACTIVE', isPrimary: true, endDate: null } } }
          : { assignments: { some: { status: 'ACTIVE', isPrimary: true, endDate: null } } }),
        gender: { in: ['M', 'F'] },
        deletedAt: null,
      },
      select: {
        id: true,
        gender: true,
        assignments: {
          where: { isPrimary: true, endDate: null },
          take: 1,
          select: {
            jobGradeId: true,
            jobCategoryId: true,
            departmentId: true,
            jobGrade: { select: { id: true, name: true } },
            jobCategory: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } },
          },
        },
      },
    })

    const employeeIds = employees.map((e) => e.id)

    // 2. Fetch latest CompensationHistory per employee
    //    Use a raw approach with Prisma: fetch all records, then pick the latest per employee
    const compensationRecords = await prisma.compensationHistory.findMany({
      where: {
        employeeId: { in: employeeIds },
        ...companyFilter,
        ...(year
          ? {
              effectiveDate: {
                gte: new Date(`${year}-01-01`),
                lt: new Date(`${year + 1}-01-01`),
              },
            }
          : {}),
      },
      orderBy: { effectiveDate: 'desc' },
      select: {
        employeeId: true,
        newBaseSalary: true,
        compaRatio: true,
        effectiveDate: true,
      },
    })

    // Pick latest record per employee
    const latestCompMap = new Map<
      string,
      { baseSalary: number; compaRatio: number | null }
    >()
    for (const rec of compensationRecords) {
      if (!latestCompMap.has(rec.employeeId)) {
        latestCompMap.set(rec.employeeId, {
          baseSalary: Number(rec.newBaseSalary),
          compaRatio: rec.compaRatio != null ? Number(rec.compaRatio) : null,
        })
      }
    }

    // 3. Fetch SalaryBand midPoints for compa-ratio fallback
    const salaryBands = await prisma.salaryBand.findMany({
      where: {
        ...companyFilter,
        deletedAt: null,
        effectiveTo: null, // current bands only
      },
      select: {
        jobGradeId: true,
        jobCategoryId: true,
        midSalary: true,
      },
    })

    // Build midSalary lookup: jobGradeId -> midSalary (use first match)
    const midSalaryMap = new Map<string, number>()
    for (const band of salaryBands) {
      if (!midSalaryMap.has(band.jobGradeId)) {
        midSalaryMap.set(band.jobGradeId, Number(band.midSalary))
      }
    }

    // 4. Build employee data with salary info
    type EmployeeData = {
      gender: 'M' | 'F'
      groupId: string
      groupName: string
      baseSalary: number
      compaRatio: number | null
    }

    const employeeData: EmployeeData[] = []

    for (const emp of employees) {
      const comp = latestCompMap.get(emp.id)
      if (!comp) continue // skip employees with no compensation data

      const a = extractPrimaryAssignment(emp.assignments ?? []) as Record<string, any>

      // Determine group
      let groupId: string
      let groupName: string

      switch (groupBy) {
        case 'jobGrade':
          groupId = (a?.jobGradeId as string) ?? ''
          groupName = (a?.jobGrade?.name as string) ?? ''
          break
        case 'jobCategory':
          groupId = (a?.jobCategoryId as string) ?? ''
          groupName = (a?.jobCategory?.name as string) ?? ''
          break
        case 'department':
          groupId = (a?.departmentId as string) ?? ''
          groupName = (a?.department?.name as string) ?? ''
          break
      }

      if (!groupId!) continue

      // Calculate compa-ratio: use stored value or compute from salary band
      let compaRatio = comp.compaRatio
      if (compaRatio == null) {
        const midSalary = midSalaryMap.get((a?.jobGradeId as string) ?? '')
        if (midSalary && midSalary > 0) {
          compaRatio = comp.baseSalary / midSalary
        }
      }

      employeeData.push({
        gender: emp.gender as 'M' | 'F',
        groupId,
        groupName,
        baseSalary: comp.baseSalary,
        compaRatio,
      })
    }

    // 5. Group and calculate
    const groups = new Map<
      string,
      {
        groupName: string
        males: { salary: number; compaRatio: number | null }[]
        females: { salary: number; compaRatio: number | null }[]
      }
    >()

    for (const ed of employeeData) {
      if (!groups.has(ed.groupId)) {
        groups.set(ed.groupId, {
          groupName: ed.groupName,
          males: [],
          females: [],
        })
      }
      const g = groups.get(ed.groupId)!
      const entry = { salary: ed.baseSalary, compaRatio: ed.compaRatio }
      if (ed.gender === 'M') {
        g.males.push(entry)
      } else {
        g.females.push(entry)
      }
    }

    // 6. Build breakdown
    const breakdown: BreakdownItem[] = []

    for (const [groupId, g] of groups) {
      const maleAvgSalary = avg(g.males.map((m) => m.salary))
      const femaleAvgSalary = avg(g.females.map((f) => f.salary))

      const maleCompaRatios = g.males
        .map((m) => m.compaRatio)
        .filter((v): v is number => v != null)
      const femaleCompaRatios = g.females
        .map((f) => f.compaRatio)
        .filter((v): v is number => v != null)

      breakdown.push({
        group: g.groupName,
        groupId,
        maleCount: g.males.length,
        femaleCount: g.females.length,
        maleAvgSalary: Math.round(maleAvgSalary),
        femaleAvgSalary: Math.round(femaleAvgSalary),
        gapPercent: Math.round(gapPercent(maleAvgSalary, femaleAvgSalary) * 100) / 100,
        maleAvgCompaRatio:
          maleCompaRatios.length > 0
            ? Math.round(avg(maleCompaRatios) * 100) / 100
            : null,
        femaleAvgCompaRatio:
          femaleCompaRatios.length > 0
            ? Math.round(avg(femaleCompaRatios) * 100) / 100
            : null,
      })
    }

    // 7. Overall summary
    const allMaleSalaries = employeeData
      .filter((e) => e.gender === 'M')
      .map((e) => e.baseSalary)
    const allFemaleSalaries = employeeData
      .filter((e) => e.gender === 'F')
      .map((e) => e.baseSalary)

    const overallMaleAvg = avg(allMaleSalaries)
    const overallFemaleAvg = avg(allFemaleSalaries)

    const response: GenderPayGapResponse = {
      summary: {
        totalEmployees: employeeData.length,
        totalMale: allMaleSalaries.length,
        totalFemale: allFemaleSalaries.length,
        overallMaleAvg: Math.round(overallMaleAvg),
        overallFemaleAvg: Math.round(overallFemaleAvg),
        overallGapPercent:
          Math.round(gapPercent(overallMaleAvg, overallFemaleAvg) * 100) / 100,
      },
      breakdown,
    }

    return apiSuccess(response)
  },
  perm(MODULE.ANALYTICS, ACTION.VIEW),
)
