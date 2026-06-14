// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Peer Review Results (Manager/HR drill-down)
//
// evaluator 실명을 노출하는 매니저/HR 뷰. 직원 본인의 (마스킹된) 결과는
// /api/v1/performance/peer-review/results/[employeeId] (반익명 maskPeerReviews)를 사용한다.
// 따라서 이 엔드포인트는 담당 매니저·HR/임원/SUPER로 한정한다(EMPLOYEE 차단).
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, forbidden, notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { EMPLOYEE_MINIMAL_SELECT, toMinimalEmployee } from '@/lib/employee-utils'
import { isCurrentManagerOf } from '@/lib/performance/peer-access'
import type { SessionUser } from '@/types'

const querySchema = z.object({
  cycleId: z.string(),
  employeeId: z.string(),
})

// ─── GET /api/v1/peer-review/results ─────────────────────

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = querySchema.safeParse(params)
    if (!parsed.success) throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })

    const { cycleId, employeeId } = parsed.data

    // Verify cycle belongs to company
    const cycle = await prisma.performanceCycle.findFirst({
      where: { id: cycleId, companyId: user.companyId },
      select: { id: true },
    })
    if (!cycle) throw notFound('평가 주기를 찾을 수 없습니다.')

    // 권한 게이트 — evaluator 실명을 노출하므로 담당 매니저·HR/임원/SUPER만.
    // (직원 본인은 마스킹된 path-param 엔드포인트 사용; 여기선 본인 포함 EMPLOYEE 차단)
    const isPrivileged =
      user.role === 'SUPER_ADMIN' || user.role === 'HR_ADMIN' || user.role === 'EXECUTIVE'
    if (!isPrivileged && !(await isCurrentManagerOf(user.employeeId, employeeId))) {
      throw forbidden('담당 매니저 또는 인사담당자만 조회할 수 있습니다.')
    }

    // Get all peer evaluations for this employee in this cycle
    const evaluations = await prisma.performanceEvaluation.findMany({
      where: {
        cycleId,
        employeeId,
        evalType: 'PEER',
        status: { in: ['SUBMITTED', 'CONFIRMED'] },
        companyId: user.companyId,
      },
      select: {
        id: true,
        competencyScore: true,
        competencyDetail: true,
        comment: true,
        submittedAt: true,
        evaluator: { select: { ...EMPLOYEE_MINIMAL_SELECT } },
      },
    })

    // 담당 매니저/HR 뷰 — evaluator 신원·메타 포함(반익명 마스킹은 직원용 path-param 엔드포인트가 담당).
    const shapedEvaluations = evaluations.map((e) => ({
      id: e.id,
      competencyScore: e.competencyScore,
      competencyDetail: e.competencyDetail,
      comment: e.comment,
      submittedAt: e.submittedAt,
      evaluator: toMinimalEmployee(e.evaluator as unknown),
    }))

    if (evaluations.length === 0) {
      return apiSuccess({
        employeeId,
        cycleId,
        evaluations: shapedEvaluations,
        summary: null,
      })
    }

    // Calculate average
    const scores = evaluations.map((e) => Number(e.competencyScore ?? 0))
    const avgScore = scores.reduce((s, v) => s + v, 0) / scores.length

    // Aggregate competency details
    const detailAgg: Record<string, number[]> = {}
    for (const e of evaluations) {
      if (e.competencyDetail && typeof e.competencyDetail === 'object') {
        const detail = e.competencyDetail as Record<string, unknown>
        for (const [key, val] of Object.entries(detail)) {
          if (typeof val === 'number') {
            if (!detailAgg[key]) detailAgg[key] = []
            detailAgg[key].push(val)
          }
        }
      }
    }
    const detailAvg: Record<string, number> = {}
    for (const [key, vals] of Object.entries(detailAgg)) {
      detailAvg[key] = Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100
    }

    return apiSuccess({
      employeeId,
      cycleId,
      evaluations: shapedEvaluations,
      summary: {
        reviewerCount: evaluations.length,
        averageScore: Math.round(avgScore * 100) / 100,
        competencyAvg: detailAvg,
      },
    })
  },
  perm(MODULE.PERFORMANCE, ACTION.VIEW),
)
