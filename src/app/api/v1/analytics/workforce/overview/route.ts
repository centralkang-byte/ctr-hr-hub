// ═══════════════════════════════════════════════════════════
// G-1: Workforce Overview API
// GET /api/v1/analytics/workforce/overview
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
// import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { parseAnalyticsParams, generateMonthRange, toYearMonth } from '@/lib/analytics/parse-params'
import { withRLS, buildRLSContext } from '@/lib/api/withRLS'
import type { WorkforceResponse } from '@/lib/analytics/types'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    const params = parseAnalyticsParams(new URL(req.url).searchParams)
    // SUPER_ADMIN can pass ?companyId=xxx; others are locked to their own company
    const effectiveCompanyId = user.role === 'SUPER_ADMIN' && params.companyId
      ? params.companyId
      : user.companyId
    const companyFilter = effectiveCompanyId ? { companyId: effectiveCompanyId } : {}
    const now = new Date()

    // RLS: DB-level tenant isolation — withRLS sets session vars for all queries in this tx
    const [activeAssignments, hireAssignments, exitAssignments, departments, jobGrades] =
      await withRLS(buildRLSContext({ ...user, companyId: effectiveCompanyId }), (tx) =>
        Promise.all([
          // Active employees with relations
          tx.employeeAssignment.findMany({
            where: { ...companyFilter, status: 'ACTIVE', isPrimary: true, endDate: null },
            select: {
              employeeId: true,
              companyId: true,
              departmentId: true,
              jobGradeId: true,
              employee: { select: { hireDate: true, birthDate: true } },
              company: { select: { name: true } },
              department: { select: { name: true } },
              jobGrade: { select: { name: true, rankOrder: true } },
            },
          }),
          // New hires in period
          tx.employeeAssignment.findMany({
            where: {
              ...companyFilter, isPrimary: true, changeType: 'HIRE',
              effectiveDate: { gte: params.startDate, lte: params.endDate },
            },
            select: { effectiveDate: true },
          }),
          // Exits in period
          tx.employeeAssignment.findMany({
            where: {
              ...companyFilter, isPrimary: true,
              status: { in: ['RESIGNED', 'TERMINATED'] },
              endDate: { gte: params.startDate, lte: params.endDate },
            },
            select: { endDate: true },
          }),
          tx.department.findMany({ where: { deletedAt: null }, select: { id: true, name: true } }),
          tx.jobGrade.findMany({ where: { deletedAt: null }, select: { id: true, name: true, rankOrder: true }, orderBy: { rankOrder: 'asc' } }),
        ]),
      )

    const totalEmps = activeAssignments.length

    // KPI: Avg Age
    const ages = activeAssignments
      .map((a) => {
        const bd = a.employee?.birthDate
        if (!bd) return null
        return (now.getTime() - new Date(bd).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      })
      .filter((a): a is number => a !== null)
    const avgAge = ages.length > 0 ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length * 10) / 10 : 0

    // Chart: Position level distribution
    const gradeCounts = new Map<string, number>()
    for (const a of activeAssignments) {
      const name = a.jobGrade?.name || '미지정'
      gradeCounts.set(name, (gradeCounts.get(name) || 0) + 1)
    }
    const gradeOrder = new Map(jobGrades.map((g) => [g.name, g.rankOrder]))
    const positionLevelDist = Array.from(gradeCounts.entries())
      .map(([level, count]) => ({ level, count }))
      .sort((a, b) => (gradeOrder.get(a.level) ?? 99) - (gradeOrder.get(b.level) ?? 99))

    // Chart: Company headcount trend (simplified — current snapshot per company)
    const companyGroups = new Map<string, number>()
    for (const a of activeAssignments) {
      const name = a.company?.name || '알 수 없음'
      companyGroups.set(name, (companyGroups.get(name) || 0) + 1)
    }
    const months = generateMonthRange(params.startDate, params.endDate)
    // Simplified: show current count for each month (full time-series needs snapshot table)
    const companyHeadcountTrend = months.map((m) => {
      const row: { month: string; [companyName: string]: number | string } = { month: m }
      for (const [name, cnt] of companyGroups) row[name] = cnt
      return row
    })

    // Chart: Department distribution
    const deptCounts = new Map<string, number>()
    for (const a of activeAssignments) {
      const name = a.department?.name || '미지정'
      deptCounts.set(name, (deptCounts.get(name) || 0) + 1)
    }
    const departmentDist = Array.from(deptCounts.entries())
      .map(([department, count]) => ({ department, count }))
      .sort((a, b) => b.count - a.count)

    // Chart: Tenure distribution
    const tenureBuckets = { '0-1년': 0, '1-3년': 0, '3-5년': 0, '5-10년': 0, '10년+': 0 }
    for (const a of activeAssignments) {
      const hd = a.employee?.hireDate
      if (!hd) continue
      const years = (now.getTime() - new Date(hd).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      if (years < 1) tenureBuckets['0-1년']++
      else if (years < 3) tenureBuckets['1-3년']++
      else if (years < 5) tenureBuckets['3-5년']++
      else if (years < 10) tenureBuckets['5-10년']++
      else tenureBuckets['10년+']++
    }
    const tenureDist = Object.entries(tenureBuckets).map(([range, count]) => ({ range, count }))

    // Chart: Monthly hires/exits
    const monthlyHireMap = new Map<string, number>()
    for (const h of hireAssignments) {
      const m = toYearMonth(new Date(h.effectiveDate))
      monthlyHireMap.set(m, (monthlyHireMap.get(m) || 0) + 1)
    }
    const monthlyExitMap = new Map<string, number>()
    for (const e of exitAssignments) {
      if (e.endDate) {
        const m = toYearMonth(new Date(e.endDate))
        monthlyExitMap.set(m, (monthlyExitMap.get(m) || 0) + 1)
      }
    }
    const monthlyHiresExits = months.map((m) => ({
      month: m,
      hires: monthlyHireMap.get(m) || 0,
      exits: monthlyExitMap.get(m) || 0,
    }))

    const response: WorkforceResponse = {
      kpis: {
        totalEmployees: { label: '총 인원', value: totalEmps, unit: '명', severity: 'neutral' },
        newHires: { label: '신규 입사', value: hireAssignments.length, unit: '명', severity: 'positive' },
        exits: { label: '퇴사', value: exitAssignments.length, unit: '명', severity: exitAssignments.length > 0 ? 'negative' : 'neutral' },
        avgAge: { label: '평균 연령', value: avgAge, unit: '세', severity: 'neutral' },
      },
      charts: {
        positionLevelDist,
        companyHeadcountTrend,
        departmentDist,
        tenureDist,
        monthlyHiresExits,
      },
    }

    return apiSuccess(response)
  },
  perm(MODULE.ANALYTICS, ACTION.VIEW),
)
