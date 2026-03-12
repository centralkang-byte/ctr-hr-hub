// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Gender Pay Gap Analytics CSV Export
// GET /api/v1/analytics/gender-pay-gap/export
// ═══════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { genderPayGapQuerySchema } from '@/lib/schemas/gender-pay-gap'
import type { SessionUser } from '@/types'

// ─── Helpers ─────────────────────────────────────────────

function avg(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function gapPercent(maleAvg: number, femaleAvg: number): number {
  if (maleAvg === 0) return 0
  return ((maleAvg - femaleAvg) / maleAvg) * 100
}

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

// ─── GET Handler ─────────────────────────────────────────

export const GET = withRateLimit(withPermission(
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
        effectiveDate: true,
      },
    })

    // Pick latest record per employee
    const latestCompMap = new Map<string, number>()
    for (const rec of compensationRecords) {
      if (!latestCompMap.has(rec.employeeId)) {
        latestCompMap.set(rec.employeeId, Number(rec.newBaseSalary))
      }
    }

    // 3. Build employee data with salary info
    type EmployeeData = {
      gender: 'M' | 'F'
      groupId: string
      groupName: string
      baseSalary: number
    }

    const employeeData: EmployeeData[] = []

    for (const emp of employees) {
      const baseSalary = latestCompMap.get(emp.id)
      if (baseSalary == null) continue

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const a = emp.assignments?.[0] as any // eslint-disable-line @typescript-eslint/no-explicit-any -- Prisma type gap

      let groupId: string = ''
      let groupName: string = ''

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
        default:
          break
      }

      if (!groupId) continue

      employeeData.push({
        gender: emp.gender as 'M' | 'F',
        groupId,
        groupName,
        baseSalary,
      })
    }

    // 4. Group and calculate
    const groups = new Map<
      string,
      {
        groupName: string
        maleSalaries: number[]
        femaleSalaries: number[]
      }
    >()

    for (const ed of employeeData) {
      if (!groups.has(ed.groupId)) {
        groups.set(ed.groupId, {
          groupName: ed.groupName,
          maleSalaries: [],
          femaleSalaries: [],
        })
      }
      const g = groups.get(ed.groupId)!
      if (ed.gender === 'M') {
        g.maleSalaries.push(ed.baseSalary)
      } else {
        g.femaleSalaries.push(ed.baseSalary)
      }
    }

    // 5. Build CSV
    const rows: string[] = []
    rows.push('Group,MaleCount,FemaleCount,MaleAvgSalary,FemaleAvgSalary,GapPercent')

    for (const [, g] of groups) {
      const maleAvg = avg(g.maleSalaries)
      const femaleAvg = avg(g.femaleSalaries)
      const gap = Math.round(gapPercent(maleAvg, femaleAvg) * 100) / 100

      rows.push(
        [
          escapeCsvField(g.groupName),
          g.maleSalaries.length,
          g.femaleSalaries.length,
          Math.round(maleAvg),
          Math.round(femaleAvg),
          gap,
        ].join(','),
      )
    }

    // Add summary row
    const allMaleSalaries = employeeData
      .filter((e) => e.gender === 'M')
      .map((e) => e.baseSalary)
    const allFemaleSalaries = employeeData
      .filter((e) => e.gender === 'F')
      .map((e) => e.baseSalary)
    const overallMaleAvg = avg(allMaleSalaries)
    const overallFemaleAvg = avg(allFemaleSalaries)
    const overallGap =
      Math.round(gapPercent(overallMaleAvg, overallFemaleAvg) * 100) / 100

    rows.push(
      [
        escapeCsvField('Overall'),
        allMaleSalaries.length,
        allFemaleSalaries.length,
        Math.round(overallMaleAvg),
        Math.round(overallFemaleAvg),
        overallGap,
      ].join(','),
    )

    const csv = rows.join('\n')
    const groupLabel = groupBy === 'jobGrade' ? 'grade' : groupBy === 'jobCategory' ? 'category' : 'department'
    const filename = `gender-pay-gap-by-${groupLabel}${year ? `-${year}` : ''}.csv`

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  },
  perm(MODULE.ANALYTICS, ACTION.VIEW),
), RATE_LIMITS.EXPORT)
