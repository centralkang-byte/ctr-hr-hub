// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Compa-Ratio 분포 API
// GET /api/v1/analytics/payroll/compa-ratio
// 로컬 통화 기준 compaRatio = baseSalary / midSalary (환율 변환 금지)
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermission } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { apiSuccess } from '@/lib/api'
import { resolveCompanyId } from '@/lib/api/companyFilter'

// ─── Types ──────────────────────────────────────────────────

interface EmployeeCompaData {
  id: string
  name: string
  gradeCode: string
  gradeId: string
  department: string
  currentBaseSalary: number  // 연봉 (로컬 통화)
  currency: string
  bandMin: number
  bandMid: number
  bandMax: number
  compaRatio: number
}

// ─── Route Handler ──────────────────────────────────────────

export const GET = withPermission(
  async (req: NextRequest, _ctx, user) => {
    const { searchParams } = new URL(req.url)
    const requestedCompanyId = searchParams.get('companyId')
    const companyId = resolveCompanyId(user, requestedCompanyId)

    // 1. 활성 직원 + assignment + grade 조회
    const companyFilter = requestedCompanyId ? { companyId } : {}
    const employees = await prisma.employee.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        assignments: {
          where: { isPrimary: true, endDate: null, ...companyFilter },
          take: 1,
          select: {
            companyId: true,
            jobGradeId: true,
            department: { select: { name: true } },
            company: { select: { currency: true } },
            jobGrade: { select: { id: true, code: true } },
          },
        },
      },
    })

    // companyFilter가 있으면 assignment가 없는 직원은 자연스럽게 필터링됨
    const activeEmployees = employees.filter((e) => e.assignments.length > 0)

    // 2. 최신 CompensationHistory (연봉 정보)
    const empIds = activeEmployees.map((e) => e.id)
    const compensations = await prisma.compensationHistory.findMany({
      where: { employeeId: { in: empIds } },
      orderBy: { effectiveDate: 'desc' },
      distinct: ['employeeId'],
      select: { employeeId: true, newBaseSalary: true },
    })
    const salaryMap = new Map(
      compensations.map((c) => [c.employeeId, Number(c.newBaseSalary)])
    )

    // 3. SalaryBand 조회 (유효한 것만)
    const bandFilter = companyId ? { companyId } : {}
    const salaryBands = await prisma.salaryBand.findMany({
      where: { ...bandFilter, deletedAt: null, effectiveTo: null },
      select: {
        jobGradeId: true,
        companyId: true,
        minSalary: true,
        midSalary: true,
        maxSalary: true,
        currency: true,
      },
    })
    // gradeId+companyId 기준 밴드 맵 (같은 법인의 밴드만 매칭)
    const bandMap = new Map(
      salaryBands.map((b) => [`${b.jobGradeId}:${b.companyId}`, {
        min: Number(b.minSalary),
        mid: Number(b.midSalary),
        max: Number(b.maxSalary),
        currency: b.currency,
      }])
    )

    // 4. Compa-Ratio 계산 (로컬 통화 기준 — 환율 변환 금지)
    const compaData: EmployeeCompaData[] = []
    for (const emp of activeEmployees) {
      const asgn = emp.assignments[0]
      if (!asgn?.jobGradeId || !asgn.jobGrade) continue

      const annualSalary = salaryMap.get(emp.id)
      if (!annualSalary || annualSalary <= 0) continue

      const bandKey = `${asgn.jobGradeId}:${asgn.companyId}`
      const band = bandMap.get(bandKey)
      if (!band || band.mid <= 0) continue  // 밴드 없는 법인 직원은 N/A — 분포에서 제외

      const compaRatio = Math.round((annualSalary / band.mid) * 1000) / 1000

      compaData.push({
        id: emp.id,
        name: emp.name,
        gradeCode: asgn.jobGrade.code,
        gradeId: asgn.jobGrade.id,
        department: asgn.department?.name ?? '(미배정)',
        currentBaseSalary: annualSalary,
        currency: asgn.company?.currency ?? 'KRW',
        bandMin: band.min,
        bandMid: band.mid,
        bandMax: band.max,
        compaRatio,
      })
    }

    // 5. 히스토그램 분포 (0.5~1.5 구간, 0.1 단위)
    const buckets = [
      { range: '< 0.7', rangeMin: 0, rangeMax: 0.7 },
      { range: '0.7–0.8', rangeMin: 0.7, rangeMax: 0.8 },
      { range: '0.8–0.9', rangeMin: 0.8, rangeMax: 0.9 },
      { range: '0.9–1.0', rangeMin: 0.9, rangeMax: 1.0 },
      { range: '1.0–1.1', rangeMin: 1.0, rangeMax: 1.1 },
      { range: '1.1–1.2', rangeMin: 1.1, rangeMax: 1.2 },
      { range: '> 1.2', rangeMin: 1.2, rangeMax: 999 },
    ]
    const distribution = buckets.map((b) => ({
      ...b,
      count: compaData.filter((e) => e.compaRatio >= b.rangeMin && e.compaRatio < b.rangeMax).length,
    }))

    // 6. 직급별 집계
    const gradeGroups: Record<string, { ratios: number[]; count: number }> = {}
    for (const e of compaData) {
      const gc = e.gradeCode
      if (!gradeGroups[gc]) gradeGroups[gc] = { ratios: [], count: 0 }
      gradeGroups[gc].ratios.push(e.compaRatio)
      gradeGroups[gc].count++
    }
    const byGrade = Object.entries(gradeGroups).map(([grade, g]) => ({
      grade,
      avgCompaRatio: Math.round((g.ratios.reduce((a, b) => a + b, 0) / g.count) * 1000) / 1000,
      employees: g.count,
      minRatio: Math.min(...g.ratios),
      maxRatio: Math.max(...g.ratios),
    }))

    // 7. 부서별 집계
    const deptGroups: Record<string, { ratios: number[]; count: number }> = {}
    for (const e of compaData) {
      if (!deptGroups[e.department]) deptGroups[e.department] = { ratios: [], count: 0 }
      deptGroups[e.department].ratios.push(e.compaRatio)
      deptGroups[e.department].count++
    }
    const byDepartment = Object.entries(deptGroups).map(([dept, g]) => ({
      department: dept,
      avgCompaRatio: Math.round((g.ratios.reduce((a, b) => a + b, 0) / g.count) * 1000) / 1000,
      employees: g.count,
    }))

    // 8. 아웃라이어 (< 0.8 또는 > 1.2)
    const outliers = compaData
      .filter((e) => e.compaRatio < 0.8 || e.compaRatio > 1.2)
      .sort((a, b) => Math.abs(b.compaRatio - 1.0) - Math.abs(a.compaRatio - 1.0))
      .slice(0, 20)
      .map((e) => ({
        id: e.id,
        name: e.name,
        grade: e.gradeCode,
        department: e.department,
        compaRatio: e.compaRatio,
        salary: e.currentBaseSalary,
        currency: e.currency,
        bandMin: e.bandMin,
        bandMid: e.bandMid,
        bandMax: e.bandMax,
      }))

    // 9. 요약
    const allRatios = compaData.map((e) => e.compaRatio).sort((a, b) => a - b)
    const avg = allRatios.length > 0
      ? Math.round((allRatios.reduce((a, b) => a + b, 0) / allRatios.length) * 1000) / 1000
      : 0
    const median = allRatios.length > 0
      ? allRatios[Math.floor(allRatios.length / 2)]
      : 0

    return apiSuccess({
      distribution,
      byGrade,
      byDepartment,
      outliers,
      summary: {
        avg,
        median,
        belowBand: compaData.filter((e) => e.compaRatio < 0.8).length,
        aboveBand: compaData.filter((e) => e.compaRatio > 1.2).length,
        totalEmployees: activeEmployees.length,
        coveredEmployees: compaData.length,
      },
    })
  },
  { module: MODULE.PAYROLL, action: ACTION.VIEW },
)
