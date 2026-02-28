// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/attrition/dashboard
// 이직 위험도 대시보드: KPI + 분포 + 고위험 직원 목록
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

    // ── Get all active employees ───────────────────────────
    const activeEmployees = await prisma.employee.findMany({
      where: { companyId, status: 'ACTIVE', deletedAt: null },
      select: { id: true },
    })

    const employeeIds = activeEmployees.map((e) => e.id)
    const totalEmployees = employeeIds.length

    if (totalEmployees === 0) {
      return apiSuccess({
        kpi: { totalEmployees: 0, highRiskCount: 0, mediumRiskCount: 0, avgScore: 0 },
        distribution: [
          { level: 'LOW', count: 0, percentage: 0 },
          { level: 'MEDIUM', count: 0, percentage: 0 },
          { level: 'HIGH', count: 0, percentage: 0 },
          { level: 'CRITICAL', count: 0, percentage: 0 },
        ],
        highRiskEmployees: [],
      })
    }

    // ── Get latest AttritionRiskHistory per employee ───────
    // Use a raw query with DISTINCT ON for best performance
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
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            departmentId: true,
            jobGradeId: true,
            department: { select: { id: true, name: true } },
            jobGrade: { select: { id: true, name: true } },
          },
        },
      },
    })

    // ── Classify risk levels ───────────────────────────────
    const levelCounts: Record<string, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    }

    let totalScore = 0
    for (const risk of latestRisks) {
      totalScore += risk.score
      if (risk.score >= 80) levelCounts.CRITICAL++
      else if (risk.score >= 60) levelCounts.HIGH++
      else if (risk.score >= 40) levelCounts.MEDIUM++
      else levelCounts.LOW++
    }

    const avgScore = latestRisks.length > 0
      ? Math.round(totalScore / latestRisks.length)
      : 0

    const highRiskCount = levelCounts.HIGH + levelCounts.CRITICAL
    const mediumRiskCount = levelCounts.MEDIUM

    const distribution = (['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map(
      (level) => ({
        level,
        count: levelCounts[level],
        percentage:
          latestRisks.length > 0
            ? Math.round((levelCounts[level] / latestRisks.length) * 1000) / 10
            : 0,
      }),
    )

    // ── Top 20 high-risk employees (score >= 60) ──────────
    const highRiskEmployees = latestRisks
      .filter((r) => r.score >= 60)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map((r) => ({
        employeeId: r.employeeId,
        name: r.employee.name,
        department: r.employee.department?.name ?? null,
        grade: r.employee.jobGrade?.name ?? null,
        score: r.score,
        factors: r.scoreFactors,
        calculatedAt: r.calculatedAt,
      }))

    return apiSuccess({
      kpi: {
        totalEmployees,
        highRiskCount,
        mediumRiskCount,
        avgScore,
      },
      distribution,
      highRiskEmployees,
    })
  },
  perm(MODULE.ANALYTICS, ACTION.VIEW),
)
