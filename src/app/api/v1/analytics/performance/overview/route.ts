// ═══════════════════════════════════════════════════════════
// G-1: Performance Overview API
// GET /api/v1/analytics/performance/overview
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { parseAnalyticsParams } from '@/lib/analytics/parse-params'
import type { PerformanceResponse } from '@/lib/analytics/types'
import type { SessionUser } from '@/types'

const GRADE_GUIDELINES: Record<string, number> = { E: 10, M_PLUS: 30, M: 50, B: 10 }
const GRADE_LABELS: Record<string, string> = { E: '탁월(E)', M_PLUS: '우수(M+)', M: '보통(M)', B: '미흡(B)' }

export const GET = withPermission(
  async (req: NextRequest, _ctx, _user: SessionUser) => {
    const params = parseAnalyticsParams(new URL(req.url).searchParams)
    const companyFilter = params.companyId ? { companyId: params.companyId } : {}

    const [latestCycle, reviews, goals, calibrations] = await Promise.all([
      // Latest performance cycle
      prisma.performanceCycle.findFirst({
        where: companyFilter,
        orderBy: { year: 'desc' },
        select: { id: true, name: true, status: true, year: true },
      }),
      // All reviews for latest cycle (will filter below)
      prisma.performanceReview.findMany({
        where: companyFilter,
        select: {
          cycleId: true, status: true, finalGrade: true, originalGrade: true,
          employee: {
            select: {
              assignments: {
                where: { isPrimary: true, endDate: null },
                take: 1,
                select: { department: { select: { name: true } } },
              },
            },
          },
        },
      }),
      prisma.mboGoal.findMany({
        where: { status: { in: ['APPROVED', 'PENDING_APPROVAL'] } },
        select: { employeeId: true, status: true },
      }),
      prisma.calibrationAdjustment.findMany({
        select: { originalBlock: true, adjustedBlock: true },
      }),
    ])

    const cycleId = latestCycle?.id
    const cycleReviews = cycleId ? reviews.filter((r) => r.cycleId === cycleId) : []

    // KPI: Current cycle phase
    const statusLabels: Record<string, string> = {
      DRAFT: '개시 준비', ACTIVE: '목표 설정', CHECK_IN: '중간 체크인',
      EVAL_OPEN: '평가 실시', CALIBRATION: '캘리브레이션',
      FINALIZED: '결과 확정', CLOSED: '종료', RESULT_OPEN: '결과 공개',
    }
    const currentPhase = latestCycle?.status ? (statusLabels[latestCycle.status] || latestCycle.status) : '사이클 없음'

    // KPI: Evaluation completion rate
    const totalReviews = cycleReviews.length
    const completedReviews = cycleReviews.filter((r) =>
      ['COMPLETED', 'MANAGER_DONE', 'CALIBRATED', 'FINALIZED', 'NOTIFIED'].includes(r.status),
    ).length
    const evalRate = totalReviews > 0 ? Math.round((completedReviews / totalReviews) * 1000) / 10 : 0

    // KPI: Calibration adjustment rate
    const adjusted = calibrations.filter((c) => c.originalBlock !== c.adjustedBlock).length
    const calibRate = calibrations.length > 0 ? Math.round((adjusted / calibrations.length) * 1000) / 10 : 0

    // KPI: Goal submission rate
    const goalEmployees = new Set(goals.map((g) => g.employeeId))
    const approvedGoalEmployees = new Set(goals.filter((g) => g.status === 'APPROVED').map((g) => g.employeeId))
    const goalRate = goalEmployees.size > 0
      ? Math.round((approvedGoalEmployees.size / goalEmployees.size) * 1000) / 10 : 0

    // Chart: Grade distribution vs guideline
    const gradeCounts: Record<string, number> = { E: 0, M_PLUS: 0, M: 0, B: 0 }
    for (const r of cycleReviews) {
      if (r.finalGrade && gradeCounts[r.finalGrade] !== undefined) {
        gradeCounts[r.finalGrade]++
      }
    }
    const totalGraded = Object.values(gradeCounts).reduce((a, b) => a + b, 0)
    const gradeDistribution = Object.entries(gradeCounts).map(([grade, count]) => ({
      grade: GRADE_LABELS[grade] || grade,
      actual: totalGraded > 0 ? Math.round((count / totalGraded) * 100) : 0,
      guideline: GRADE_GUIDELINES[grade] || 0,
    }))

    // Chart: Department grade distribution
    const deptGrades = new Map<string, Record<string, number>>()
    for (const r of cycleReviews) {
      if (!r.finalGrade) continue
      const dept = r.employee?.assignments?.[0]?.department?.name || '미지정'
      if (!deptGrades.has(dept)) deptGrades.set(dept, { E: 0, M_PLUS: 0, M: 0, B: 0 })
      const dg = deptGrades.get(dept)!
      if (dg[r.finalGrade] !== undefined) dg[r.finalGrade]++
    }
    const departmentGradeDist = Array.from(deptGrades.entries()).map(([department, grades]) => {
      const total = Object.values(grades).reduce((a, b) => a + b, 0)
      const row: Record<string, number | string> = { department }
      for (const [g, cnt] of Object.entries(grades)) {
        row[GRADE_LABELS[g] || g] = total > 0 ? Math.round((cnt / total) * 100) : 0
      }
      return row
    })

    // Chart: Evaluation progress
    const stageCounts: Record<string, number> = {
      '자기 평가': 0, '관리자 평가': 0, '캘리브레이션': 0, '결과 통보': 0,
    }
    for (const r of cycleReviews) {
      if (['SELF_EVAL', 'SELF_DONE'].includes(r.status)) stageCounts['자기 평가']++
      if (['MANAGER_EVAL', 'MANAGER_DONE'].includes(r.status)) stageCounts['관리자 평가']++
      if (['CALIBRATED', 'FINALIZED'].includes(r.status)) stageCounts['캘리브레이션']++
      if (['NOTIFIED', 'COMPLETED'].includes(r.status)) stageCounts['결과 통보']++
    }
    const evaluationProgress = Object.entries(stageCounts).map(([stage, completed]) => ({
      stage, completed, total: totalReviews,
    }))

    const response: PerformanceResponse = {
      kpis: {
        currentCyclePhase: { label: '현재 사이클', value: currentPhase, severity: 'neutral' },
        evaluationCompletionRate: {
          label: '평가 완료율', value: evalRate, unit: '%',
          severity: evalRate >= 80 ? 'positive' : evalRate >= 50 ? 'neutral' : 'negative',
        },
        calibrationAdjustmentRate: { label: '캘리 조정률', value: calibRate, unit: '%', severity: 'neutral' },
        goalSubmissionRate: {
          label: '목표 제출률', value: goalRate, unit: '%',
          severity: goalRate >= 80 ? 'positive' : 'negative',
        },
      },
      charts: { gradeDistribution, departmentGradeDist, evaluationProgress },
    }

    return apiSuccess(response)
  },
  perm(MODULE.ANALYTICS, ACTION.VIEW),
)
