// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Peer Review Results (Employee)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, forbidden, notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { EMPLOYEE_MINIMAL_SELECT, toMinimalEmployee } from '@/lib/employee-utils'
import { determineViewerRole, isResultPublishedForRole, deterministicShuffle } from '@/lib/performance/data-masking'
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
      select: { id: true, status: true, companyId: true },
    })
    if (!cycle) throw notFound('평가 주기를 찾을 수 없습니다.')

    // 뷰어 권한 판정 — 동료평가는 반익명. determineViewerRole은 무관한 직원에게도
    // 'EMPLOYEE' fallback을 부여하므로 아래 IDOR 게이트로 타인 조회를 차단한다.
    const isManager = await isCurrentManagerOf(user.employeeId, employeeId)
    const viewerRole = determineViewerRole(user.employeeId, employeeId, user.role, isManager)

    // IDOR 게이트 — 본인·담당 매니저·HR/임원만. (perm VIEW는 EMPLOYEE도 보유)
    if (viewerRole === 'EMPLOYEE' && user.employeeId !== employeeId) {
      throw forbidden('본인 또는 담당자만 조회할 수 있습니다.')
    }

    // 결과 공개 게이트 — 본인(EMPLOYEE)은 결과 통보(CLOSED) 이후에만.
    if (viewerRole === 'EMPLOYEE' && !isResultPublishedForRole(cycle.status, 'EMPLOYEE')) {
      throw badRequest('성과 결과가 아직 공개되지 않았습니다.')
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

    // 반익명 마스킹 — 본인(EMPLOYEE) 뷰는 reviewer 실명을 절대 노출하지 않는다('평가자 N').
    // 신원뿐 아니라 타이밍/순서 상관 단서까지 제거(maskPeerReviews SSOT와 동일 정책):
    // evaluator·submittedAt·id 제거 + cycleId:employeeId 기반 결정적 셔플 → 위치/제출시각으로
    // 평가자를 역추적하지 못하게 한다. 담당 매니저/HR/임원만 evaluator 신원·메타를 본다.
    const anonymize = viewerRole === 'EMPLOYEE'
    const shapedEvaluations = anonymize
      ? deterministicShuffle(
          evaluations.map((e) => ({
            competencyScore: e.competencyScore,
            competencyDetail: e.competencyDetail,
            comment: e.comment,
          })),
          `${cycleId}:${employeeId}`,
        ).map((e, idx) => ({ ...e, evaluatorLabel: `평가자 ${idx + 1}` }))
      : evaluations.map((e) => ({
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
