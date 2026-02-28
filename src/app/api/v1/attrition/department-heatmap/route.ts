// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/attrition/department-heatmap
// 부서별 이직 위험도 히트맵: 평균 점수 + 고위험 인원
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    const p = Object.fromEntries(req.nextUrl.searchParams)
    const companyId =
      user.role === 'SUPER_ADMIN' ? (p.companyId ?? user.companyId) : user.companyId

    // ── Get all departments for the company ────────────────
    const departments = await prisma.department.findMany({
      where: { companyId, deletedAt: null },
      select: { id: true, name: true },
    })

    // ── Get active employees grouped by department ─────────
    const activeEmployees = await prisma.employee.findMany({
      where: { companyId, status: 'ACTIVE', deletedAt: null },
      select: { id: true, departmentId: true },
    })

    const employeeIds = activeEmployees.map((e) => e.id)

    // ── Get latest risk per employee ───────────────────────
    const latestRisks = await prisma.attritionRiskHistory.findMany({
      where: {
        companyId,
        employeeId: { in: employeeIds },
      },
      orderBy: [
        { employeeId: 'asc' },
        { calculatedAt: 'desc' },
      ],
      distinct: ['employeeId'],
      select: {
        employeeId: true,
        score: true,
      },
    })

    // ── Build a map: employeeId → score ────────────────────
    const scoreMap = new Map<string, number>()
    for (const r of latestRisks) {
      scoreMap.set(r.employeeId, r.score)
    }

    // ── Build a map: departmentId → employeeIds ────────────
    const deptEmployeeMap = new Map<string, string[]>()
    for (const emp of activeEmployees) {
      const list = deptEmployeeMap.get(emp.departmentId) ?? []
      list.push(emp.id)
      deptEmployeeMap.set(emp.departmentId, list)
    }

    // ── Aggregate per department ───────────────────────────
    const heatmap = departments.map((dept) => {
      const empIds = deptEmployeeMap.get(dept.id) ?? []
      const totalCount = empIds.length

      let totalScore = 0
      let highRiskCount = 0
      let scored = 0

      for (const empId of empIds) {
        const s = scoreMap.get(empId)
        if (s !== undefined) {
          totalScore += s
          scored++
          if (s >= 60) highRiskCount++
        }
      }

      const avgScore = scored > 0 ? Math.round(totalScore / scored) : 0

      return {
        departmentId: dept.id,
        departmentName: dept.name,
        avgScore,
        highRiskCount,
        totalCount,
      }
    })

    // Sort by avgScore descending (hottest first)
    heatmap.sort((a, b) => b.avgScore - a.avgScore)

    return apiSuccess(heatmap)
  },
  perm(MODULE.ANALYTICS, ACTION.VIEW),
)
