// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GP#4 Apply Compensation Adjustments
// PUT /api/v1/performance/compensation/[cycleId]/apply
//
// Design Decision #18: Soft Warning (exceptions with reason)
// GEMINI FIX #2: Upsert (idempotent) — HR can call multiple times
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { eventBus, DOMAIN_EVENTS } from '@/lib/events'
import {
    getMeritRecommendation,
    getCurrentSalary,
    getSalaryBandMidpoint,
    calculateComparatio,
    checkMeritException,
} from '@/lib/performance/merit-matrix'
import type { SessionUser } from '@/types'

const adjustmentSchema = z.object({
    employeeId: z.string().uuid(),
    appliedPct: z.number(),
    exceptionReason: z.string().optional(),
})

const applySchema = z.object({
    adjustments: z.array(adjustmentSchema).min(1),
})

// ─── PUT /api/v1/performance/compensation/[cycleId]/apply

export const PUT = withPermission(
    async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
        const { cycleId } = await context.params
        const body: unknown = await req.json()
        const parsed = applySchema.safeParse(body)
        if (!parsed.success) {
            throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
        }

        const { adjustments } = parsed.data

        try {
            const cycle = await prisma.performanceCycle.findFirst({
                where: { id: cycleId, companyId: user.companyId },
                select: { id: true, status: true, companyId: true },
            })

            if (!cycle) throw badRequest('사이클을 찾을 수 없습니다.')
            if (cycle.status !== 'COMP_REVIEW') {
                throw badRequest('보상 기획(COMP_REVIEW) 단계에서만 적용 가능합니다.')
            }

            let processed = 0
            let exceptions = 0
            let totalBudgetImpact = 0
            const errors: Array<{ employeeId: string; error: string }> = []

            // Process in transaction (GEMINI FIX #2: upsert for idempotency)
            await prisma.$transaction(async (tx) => {
                for (const adj of adjustments) {
                    try {
                        // Get review
                        const review = await tx.performanceReview.findFirst({
                            where: { cycleId, employeeId: adj.employeeId },
                            select: {
                                finalGrade: true,
                                employee: {
                                    select: {
                                        assignments: {
                                            where: { isPrimary: true, endDate: null, companyId: cycle.companyId },
                                            take: 1,
                                            select: { jobGradeId: true },
                                        },
                                    },
                                },
                            },
                        })

                        if (!review?.finalGrade) {
                            errors.push({ employeeId: adj.employeeId, error: '성과 등급이 없습니다.' })
                            continue
                        }

                        const { salary: currentSalary, currency } = await getCurrentSalary(
                            adj.employeeId, cycle.companyId, tx as typeof prisma,
                        )

                        // Get merit range for exception check
                        const midpoint = await getSalaryBandMidpoint(
                            review.employee.assignments[0]?.jobGradeId ?? null, cycle.companyId, tx as typeof prisma,
                        )
                        const comparatio = calculateComparatio(currentSalary, midpoint)
                        const merit = await getMeritRecommendation(
                            review.finalGrade, comparatio, cycle.companyId, tx as typeof prisma,
                        )

                        // Check exception (Design Decision #18: Soft Warning)
                        const check = checkMeritException(adj.appliedPct, merit.meritMinPct, merit.meritMaxPct)

                        if (check.isException && !adj.exceptionReason) {
                            errors.push({
                                employeeId: adj.employeeId,
                                error: `적용률 ${adj.appliedPct}%가 매트릭스 범위(${merit.meritMinPct}%–${merit.meritMaxPct}%) 밖입니다. exceptionReason이 필요합니다.`,
                            })
                            continue
                        }

                        // GEMINI FIX #1: Math.round() at final step
                        const adjustmentAmount = Math.round(currentSalary * adj.appliedPct / 100)
                        const newBaseSalary = currentSalary + adjustmentAmount

                        // Find existing record for upsert
                        const existing = await tx.compensationHistory.findFirst({
                            where: { cycleId, employeeId: adj.employeeId },
                            select: { id: true },
                        })

                        if (existing) {
                            await tx.compensationHistory.update({
                                where: { id: existing.id },
                                data: {
                                    previousBaseSalary: currentSalary,
                                    newBaseSalary,
                                    currency,
                                    changePct: adj.appliedPct,
                                    performanceGradeAtTime: review.finalGrade,
                                    isException: check.isException,
                                    exceptionReason: check.isException ? adj.exceptionReason : null,
                                    approvedBy: user.employeeId,
                                    reason: check.isException
                                        ? `보상 예외: ${adj.exceptionReason}`
                                        : `성과 기반 인상 (${review.finalGrade})`,
                                },
                            })
                        } else {
                            await tx.compensationHistory.create({
                                data: {
                                    employeeId: adj.employeeId,
                                    companyId: cycle.companyId,
                                    changeType: 'ANNUAL_INCREASE',
                                    previousBaseSalary: currentSalary,
                                    newBaseSalary,
                                    currency,
                                    changePct: adj.appliedPct,
                                    effectiveDate: new Date(),
                                    cycleId,
                                    performanceGradeAtTime: review.finalGrade,
                                    isException: check.isException,
                                    exceptionReason: check.isException ? adj.exceptionReason : null,
                                    approvedBy: user.employeeId,
                                    reason: check.isException
                                        ? `보상 예외: ${adj.exceptionReason}`
                                        : `성과 기반 인상 (${review.finalGrade})`,
                                },
                            })
                        }

                        if (check.isException) {
                            exceptions++
                        }
                        totalBudgetImpact += adjustmentAmount
                        processed++
                    } catch (innerError) {
                        errors.push({
                            employeeId: adj.employeeId,
                            error: innerError instanceof Error ? innerError.message : '처리 중 오류 발생',
                        })
                    }
                }
            })

            // Fire exception events (outside transaction)
            if (exceptions > 0) {
                // Fire a summary event with first exception's data as representative
                void eventBus.publish(DOMAIN_EVENTS.COMP_EXCEPTION_FLAGGED, {
                    ctx: {
                        companyId: cycle.companyId,
                        actorId: user.employeeId,
                        occurredAt: new Date(),
                    },
                    cycleId,
                    employeeId: user.employeeId,
                    companyId: cycle.companyId,
                    recommendedPct: 0,
                    actualPct: 0,
                    reason: `보상 예외 ${exceptions}건 발생`,
                })
            }

            const { ip, userAgent } = extractRequestMeta(req.headers)
            logAudit({
                actorId: user.employeeId,
                action: 'performance.compensation.apply',
                resourceType: 'compensationHistory',
                resourceId: cycleId,
                companyId: cycle.companyId,
                changes: { processed, exceptions, totalBudgetImpact: Math.round(totalBudgetImpact) },
                ip,
                userAgent,
            })

            return apiSuccess({
                processed,
                exceptions,
                totalBudgetImpact: Math.round(totalBudgetImpact),
                errors,
            })
        } catch (error) {
            throw handlePrismaError(error)
        }
    },
    perm(MODULE.PERFORMANCE, ACTION.APPROVE),
)
