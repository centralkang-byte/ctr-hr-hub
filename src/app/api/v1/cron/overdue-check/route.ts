// CRON: secured by CRON_SECRET header, not user session
// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GP#4 Cron: Overdue Check
// GET /api/v1/cron/overdue-check
//
// ⚠️ TIMEZONE RULE: All deadline comparisons use UTC.
// Deadlines (goalEnd, checkInDeadline, evalEnd) are stored as UTC DateTime.
// The UI displays localized dates, but the engine always compares in UTC.
//
// Schedule: Run HOURLY via Vercel Cron or external scheduler
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'
import { handlePrismaError, unauthorized } from '@/lib/errors'
import { verifyCronSecret } from '@/lib/cron-auth'
import { addOverdueFlag, daysSinceDeadline } from '@/lib/performance/pipeline'
import { eventBus, DOMAIN_EVENTS } from '@/lib/events'

// ─── GET /api/v1/cron/overdue-check ──────────────────────
// Settings-connected: CRON_SECRET header validation (env-based, not in Settings API)

export async function GET(req: NextRequest) {
    if (!verifyCronSecret(req)) return apiError(unauthorized('인증 실패'))
    try {
        const now = new Date()
        let totalFlagged = 0

        // Find all active cycles (not terminal states)
        const activeCycles = await prisma.performanceCycle.findMany({
            where: {
                status: { in: ['ACTIVE', 'CHECK_IN', 'EVAL_OPEN'] },
            },
            select: {
                id: true,
                companyId: true,
                status: true,
                goalEnd: true,
                checkInDeadline: true,
                evalEnd: true,
                checkInMode: true,
            },
        })

        for (const cycle of activeCycles) {
            const ctx = {
                companyId: cycle.companyId,
                actorId: 'SYSTEM',
                occurredAt: now,
            }

            // ── ACTIVE: Check goal deadlines ──────────────────
            if (cycle.status === 'ACTIVE' && cycle.goalEnd < now) {
                const days = daysSinceDeadline(cycle.goalEnd, now)

                const reviews = await prisma.performanceReview.findMany({
                    where: { cycleId: cycle.id, status: 'GOAL_SETTING' },
                    select: { id: true, employeeId: true, overdueFlags: true },
                })

                const overdueIds: string[] = []

                for (const review of reviews) {
                    const hasApproved = await prisma.mboGoal.count({
                        where: { cycleId: cycle.id, employeeId: review.employeeId, status: 'APPROVED' },
                    })

                    if (hasApproved === 0) {
                        overdueIds.push(review.employeeId)
                        const flag = `GOAL_LATE_${days}D`
                        const existing = review.overdueFlags as string[]
                        // Only update if flag doesn't already exist with same day count
                        if (!existing.includes(flag)) {
                            await prisma.performanceReview.update({
                                where: { id: review.id },
                                data: { overdueFlags: addOverdueFlag(review.overdueFlags, flag) },
                            })
                            totalFlagged++
                        }
                    }
                }

                if (overdueIds.length > 0) {
                    void eventBus.publish(DOMAIN_EVENTS.GOAL_OVERDUE, {
                        ctx,
                        cycleId: cycle.id,
                        companyId: cycle.companyId,
                        overdueEmployeeIds: overdueIds,
                        overdueCount: overdueIds.length,
                        daysSinceDeadline: days,
                    })
                }
            }

            // ── CHECK_IN: Check check-in deadlines ────────────
            if (cycle.status === 'CHECK_IN' && cycle.checkInDeadline && cycle.checkInDeadline < now) {
                if (cycle.checkInMode === 'MANDATORY') {
                    const reviews = await prisma.performanceReview.findMany({
                        where: { cycleId: cycle.id },
                        select: { id: true, employeeId: true, overdueFlags: true },
                    })

                    const overdueIds: string[] = []

                    for (const review of reviews) {
                        const existing = review.overdueFlags as string[]
                        if (existing.includes('CHECKIN_MISSING')) continue

                        const checkinCount = await prisma.oneOnOne.count({
                            where: { cycleId: cycle.id, employeeId: review.employeeId, isCheckinRecord: true },
                        })

                        if (checkinCount === 0) {
                            overdueIds.push(review.employeeId)
                            await prisma.performanceReview.update({
                                where: { id: review.id },
                                data: { overdueFlags: addOverdueFlag(review.overdueFlags, 'CHECKIN_MISSING') },
                            })
                            totalFlagged++
                        }
                    }

                    if (overdueIds.length > 0) {
                        void eventBus.publish(DOMAIN_EVENTS.CHECKIN_OVERDUE, {
                            ctx,
                            cycleId: cycle.id,
                            companyId: cycle.companyId,
                            overdueEmployeeIds: overdueIds,
                            overdueCount: overdueIds.length,
                            checkInMode: cycle.checkInMode,
                        })
                    }
                }
            }

            // ── EVAL_OPEN: Check eval deadlines ───────────────
            if (cycle.status === 'EVAL_OPEN' && cycle.evalEnd < now) {
                const days = daysSinceDeadline(cycle.evalEnd, now)

                const reviews = await prisma.performanceReview.findMany({
                    where: {
                        cycleId: cycle.id,
                        status: { in: ['GOAL_SETTING', 'SELF_EVAL'] },
                    },
                    select: { id: true, employeeId: true, overdueFlags: true },
                })

                const overdueIds: string[] = []

                for (const review of reviews) {
                    const hasSelfEval = await prisma.performanceEvaluation.count({
                        where: {
                            cycleId: cycle.id,
                            employeeId: review.employeeId,
                            evalType: 'SELF',
                            status: 'SUBMITTED',
                        },
                    })

                    if (hasSelfEval === 0) {
                        const flag = `SELF_EVAL_LATE_${days}D`
                        const existing = review.overdueFlags as string[]
                        if (!existing.some((f) => f.startsWith('SELF_EVAL_LATE_'))) {
                            overdueIds.push(review.employeeId)
                            await prisma.performanceReview.update({
                                where: { id: review.id },
                                data: { overdueFlags: addOverdueFlag(review.overdueFlags, flag) },
                            })
                            totalFlagged++
                        }
                    }
                }

                if (overdueIds.length > 0) {
                    void eventBus.publish(DOMAIN_EVENTS.SELF_EVAL_OVERDUE, {
                        ctx,
                        cycleId: cycle.id,
                        companyId: cycle.companyId,
                        overdueEmployeeIds: overdueIds,
                        overdueCount: overdueIds.length,
                        daysSinceDeadline: days,
                    })
                }
            }
        }

        return apiSuccess({
            cyclesChecked: activeCycles.length,
            totalFlagged,
            message: `${activeCycles.length}개 사이클 점검 완료, ${totalFlagged}건 신규 Overdue 플래그`,
        })
    } catch (error) {
        throw handlePrismaError(error)
    }
}
