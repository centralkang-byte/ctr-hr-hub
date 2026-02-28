// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/attrition/trend
// 이직 위험도 월별 추이: 기간별 평균 점수 + 위험 등급 분포
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
    const months = Math.min(Math.max(Number(p.months ?? 12), 1), 36)
    const departmentId = p.departmentId || undefined
    const companyId =
      user.role === 'SUPER_ADMIN' ? (p.companyId ?? user.companyId) : user.companyId

    // ── Date range ─────────────────────────────────────────
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - months)
    startDate.setDate(1)
    startDate.setHours(0, 0, 0, 0)

    // ── Build employee filter for department scope ─────────
    let employeeFilter: { employeeId?: { in: string[] } } = {}
    if (departmentId) {
      const deptEmployees = await prisma.employee.findMany({
        where: { companyId, departmentId, status: 'ACTIVE', deletedAt: null },
        select: { id: true },
      })
      employeeFilter = { employeeId: { in: deptEmployees.map((e) => e.id) } }
    }

    // ── Get all risk records in the range ──────────────────
    const records = await prisma.attritionRiskHistory.findMany({
      where: {
        companyId,
        calculatedAt: { gte: startDate },
        ...employeeFilter,
      },
      orderBy: { calculatedAt: 'asc' },
      select: {
        score: true,
        calculatedAt: true,
      },
    })

    // ── Aggregate by month ─────────────────────────────────
    const monthlyMap = new Map<
      string,
      { totalScore: number; count: number; low: number; medium: number; high: number; critical: number }
    >()

    for (const record of records) {
      const d = record.calculatedAt
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

      let entry = monthlyMap.get(monthKey)
      if (!entry) {
        entry = { totalScore: 0, count: 0, low: 0, medium: 0, high: 0, critical: 0 }
        monthlyMap.set(monthKey, entry)
      }

      entry.totalScore += record.score
      entry.count++

      if (record.score >= 80) entry.critical++
      else if (record.score >= 60) entry.high++
      else if (record.score >= 40) entry.medium++
      else entry.low++
    }

    // ── Build sorted trend array ───────────────────────────
    const trend = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        avgScore: data.count > 0 ? Math.round(data.totalScore / data.count) : 0,
        highCount: data.high + data.critical,
        mediumCount: data.medium,
        lowCount: data.low,
        criticalCount: data.critical,
      }))

    return apiSuccess(trend)
  },
  perm(MODULE.ANALYTICS, ACTION.VIEW),
)
