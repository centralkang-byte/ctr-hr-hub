// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GP#4 Employee Performance History
// GET /api/v1/performance/reviews/my-history
//
// 과거 사이클 대비 성과 추이 데이터 (성장 여정 시각화용)
// + 평가자명·매니저 평가 코멘트 (기존 PerformanceEvaluation(MANAGER) surface)
// + MBO 가중 달성점수·주요 목표 (MboGoal 집계)
//
// Data Masking: originalGrade, calibrationNote 미포함.
// 결과 공개 게이트: 통보된(notifiedAt!=null) cycle만. 코멘트·MBO는
//   publishedCycleIds 범위로만 조회 → 미공개분은 메모리에도 안 올라옴 (방어적 게이트).
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { getGradeLabel } from '@/lib/performance/data-masking'
import { pickManagerEval, aggregateMbo, type ManagerEvalLike } from '@/lib/performance/my-history-aggregate'
import type { SessionUser } from '@/types'

// ─── Types ──────────────────────────────────────────────────

interface ManagerEval extends ManagerEvalLike {
    cycleId: string
}

// ─── GET /api/v1/performance/reviews/my-history ─────────

export const GET = withPermission(
    async (_req: NextRequest, _context, user: SessionUser) => {
        try {
            const reviews = await prisma.performanceReview.findMany({
                where: {
                    employeeId: user.employeeId,
                    companyId: user.companyId,
                    // 확정된 결과만 (통보 이후)
                    notifiedAt: { not: null },
                },
                select: {
                    id: true,
                    finalGrade: true,
                    mboScore: true,
                    beiScore: true,
                    totalScore: true,
                    cycle: {
                        select: { id: true, name: true, year: true, half: true },
                    },
                },
                orderBy: { cycle: { year: 'asc' } },
            })

            const publishedCycleIds = reviews.map((r) => r.cycle.id)

            // 통보된 cycle이 없으면 코멘트/MBO 조회 자체를 스킵 (불필요 fetch·누출 0).
            const managerEvalByCycle = new Map<string, ManagerEval>()
            const goalsByCycle = new Map<string, { title: string; weight: number; achievementScore: number | null; id: string }[]>()

            if (publishedCycleIds.length > 0) {
                const [managerEvals, mboGoals] = await Promise.all([
                    prisma.performanceEvaluation.findMany({
                        where: {
                            employeeId: user.employeeId,
                            companyId: user.companyId,
                            evalType: 'MANAGER',
                            status: { in: ['SUBMITTED', 'CONFIRMED'] },
                            cycleId: { in: publishedCycleIds },
                        },
                        select: {
                            cycleId: true,
                            comment: true,
                            status: true,
                            submittedAt: true,
                            id: true,
                            evaluator: { select: { name: true } },
                        },
                    }),
                    prisma.mboGoal.findMany({
                        where: {
                            employeeId: user.employeeId,
                            companyId: user.companyId,
                            cycleId: { in: publishedCycleIds },
                        },
                        select: { cycleId: true, title: true, weight: true, achievementScore: true, id: true },
                    }),
                ])

                for (const ev of managerEvals) {
                    const prev = managerEvalByCycle.get(ev.cycleId)
                    managerEvalByCycle.set(ev.cycleId, prev ? pickManagerEval(prev, ev) : ev)
                }
                for (const g of mboGoals) {
                    const list = goalsByCycle.get(g.cycleId) ?? []
                    list.push({
                        title: g.title,
                        weight: Number(g.weight),
                        achievementScore: g.achievementScore != null ? Number(g.achievementScore) : null,
                        id: g.id,
                    })
                    goalsByCycle.set(g.cycleId, list)
                }
            }

            const history = reviews.map((r) => {
                const ev = managerEvalByCycle.get(r.cycle.id)
                const goals = goalsByCycle.get(r.cycle.id) ?? []
                const mbo = aggregateMbo(goals)

                return {
                    cycleId: r.cycle.id,
                    cycleName: r.cycle.name,
                    year: r.cycle.year,
                    half: r.cycle.half,
                    label: `${r.cycle.year} ${r.cycle.half}`,
                    mboScore: r.mboScore ? Number(r.mboScore) : null,
                    beiScore: r.beiScore ? Number(r.beiScore) : null,
                    totalScore: r.totalScore ? Number(r.totalScore) : null,
                    finalGrade: r.finalGrade,
                    finalGradeLabel: getGradeLabel(r.finalGrade, 'ko'),
                    evaluatorName: ev?.evaluator?.name ?? null,
                    comment: ev?.comment ?? null,
                    mboGoalCount: mbo.goalCount,
                    mboAchievement: mbo.achievement,
                    mboKeyGoals: mbo.keyGoals,
                }
            })

            return apiSuccess(history)
        } catch (error) {
            throw handlePrismaError(error)
        }
    },
    perm(MODULE.PERFORMANCE, ACTION.VIEW),
)
