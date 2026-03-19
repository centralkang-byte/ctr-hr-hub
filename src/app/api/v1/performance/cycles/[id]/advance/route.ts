// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GP#4 Pipeline State Machine Advance
// PUT /api/v1/performance/cycles/:id/advance
//
// 9-state transitions with overdue processing at each step.
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { eventBus } from '@/lib/events/event-bus'
import { DOMAIN_EVENTS } from '@/lib/events/types'
import { bootstrapEventHandlers } from '@/lib/events/bootstrap'
import { TRANSITIONS, addOverdueFlag, daysSinceDeadline } from '@/lib/performance/pipeline'
import { getPerformanceSetting } from '@/lib/settings/get-setting'
import type { SessionUser } from '@/types'

interface EvalMethodologyConfig {
  methodology?: string  // '360' | 'top-down' | 'mbo'
  includePeerReview?: boolean
  includeCheckIn?: boolean
}

bootstrapEventHandlers()

// ─── PUT /api/v1/performance/cycles/:id/advance ──────────
// Advance cycle to next status with overdue processing

export const PUT = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params

    const cycle = await prisma.performanceCycle.findFirst({
      where: { id, companyId: user.companyId },
    })

    if (!cycle) {
      throw notFound('해당 성과 주기를 찾을 수 없습니다.')
    }

    const currentStatus = cycle.status as string
    const nextStatus = TRANSITIONS[currentStatus]

    if (!nextStatus) {
      throw badRequest(
        `현재 상태(${currentStatus})에서는 더 이상 진행할 수 없습니다.`,
      )
    }

    try {
      const now = new Date()
      const ctx = {
        companyId: cycle.companyId,
        actorId: user.employeeId,
        occurredAt: now,
      }

      // Settings-connected: evaluation methodology affects stage transitions
      const evalMethodology = await getPerformanceSetting<EvalMethodologyConfig>(
        'evaluation-methodology',
        cycle.companyId,
      )
      const includePeerReview = evalMethodology?.includePeerReview ?? evalMethodology?.methodology === '360'
      const includeCheckIn = evalMethodology?.includeCheckIn ?? true

      // ════════════════════════════════════════════════════
      // STEP-SPECIFIC OVERDUE PROCESSING (runs inside transaction)
      // ════════════════════════════════════════════════════

      const result = await prisma.$transaction(async (tx) => {
        let overdueCount = 0
        const overdueEmployeeIds: string[] = []

        // ── DRAFT → ACTIVE (Setup → Goal Setting) ────────
        if (currentStatus === 'DRAFT') {
          // Create PerformanceReview records if not already created
          const existingReviews = await tx.performanceReview.count({
            where: { cycleId: id },
          })

          if (existingReviews === 0) {
            // Build employee filter from targetFilter
            const targetFilter = cycle.targetFilter as {
              departments?: string[]
            } | null

            const assignmentWhere: Record<string, unknown> = {
              companyId: cycle.companyId,
              isPrimary: true,
              endDate: null,
              status: 'ACTIVE',
            }
            if (targetFilter?.departments?.length) {
              assignmentWhere.departmentId = { in: targetFilter.departments }
            }

            const employeeWhere: Record<string, unknown> = {
              deletedAt: null,
              assignments: { some: assignmentWhere },
            }
            if (cycle.excludeProbation) {
              employeeWhere.probationStatus = { not: 'IN_PROGRESS' }
            }

            const employees = await tx.employee.findMany({
              where: employeeWhere,
              select: { id: true },
            })

            if (employees.length > 0) {
              await tx.performanceReview.createMany({
                data: employees.map((e) => ({
                  cycleId: id,
                  employeeId: e.id,
                  companyId: cycle.companyId,
                  status: 'GOAL_SETTING' as const,
                  overdueFlags: [],
                })),
                skipDuplicates: true,
              })
            }
          }
        }

        // ── ACTIVE → CHECK_IN (Goal Setting → Check-in) ──
        if (currentStatus === 'ACTIVE') {
          const days = daysSinceDeadline(cycle.goalEnd, now)

          // Find employees with unapproved goals
          const reviews = await tx.performanceReview.findMany({
            where: { cycleId: id, status: 'GOAL_SETTING' },
            select: { id: true, employeeId: true, overdueFlags: true },
          })

          for (const review of reviews) {
            const hasApprovedGoals = await tx.mboGoal.count({
              where: { cycleId: id, employeeId: review.employeeId, status: 'APPROVED' },
            })

            if (hasApprovedGoals === 0) {
              overdueEmployeeIds.push(review.employeeId)
              const flag = `GOAL_LATE_${days}D`
              await tx.performanceReview.update({
                where: { id: review.id },
                data: { overdueFlags: addOverdueFlag(review.overdueFlags, flag) },
              })

              // Mark overdue on goals
              await tx.mboGoal.updateMany({
                where: { cycleId: id, employeeId: review.employeeId, status: { not: 'APPROVED' } },
                data: { overdueAt: now },
              })
            }
          }

          // Lock approved goals
          await tx.mboGoal.updateMany({
            where: { cycleId: id, status: 'APPROVED', isLocked: false },
            data: { isLocked: true },
          })

          overdueCount = overdueEmployeeIds.length
        }

        // ── CHECK_IN → EVAL_OPEN (Check-in → Evaluation) ─
        if (currentStatus === 'CHECK_IN') {
          if (cycle.checkInMode === 'MANDATORY') {
            // Find employees who haven't completed check-in
            const allReviews = await tx.performanceReview.findMany({
              where: { cycleId: id },
              select: { id: true, employeeId: true, overdueFlags: true },
            })

            for (const review of allReviews) {
              // Check 3 conditions
              const managerCheckin = await tx.oneOnOne.count({
                where: { cycleId: id, employeeId: review.employeeId, isCheckinRecord: true },
              })
              const goalProgress = await tx.mboProgress.count({
                where: {
                  goal: { cycleId: id, employeeId: review.employeeId },
                  createdAt: { gte: cycle.goalEnd },
                },
              })

              if (managerCheckin === 0 || goalProgress === 0) {
                overdueEmployeeIds.push(review.employeeId)
                await tx.performanceReview.update({
                  where: { id: review.id },
                  data: { overdueFlags: addOverdueFlag(review.overdueFlags, 'CHECKIN_MISSING') },
                })
              }
            }

            overdueCount = overdueEmployeeIds.length
          }
        }

        // ── EVAL_OPEN → CALIBRATION (Evaluation → Calibration)
        if (currentStatus === 'EVAL_OPEN') {
          const days = daysSinceDeadline(cycle.evalEnd, now)

          // Find employees without self-evaluation
          const reviews = await tx.performanceReview.findMany({
            where: {
              cycleId: id,
              status: { in: ['GOAL_SETTING', 'SELF_EVAL'] },
            },
            select: { id: true, employeeId: true, overdueFlags: true },
          })

          for (const review of reviews) {
            const hasSelfEval = await tx.performanceEvaluation.count({
              where: { cycleId: id, employeeId: review.employeeId, evalType: 'SELF', status: 'SUBMITTED' },
            })

            if (hasSelfEval === 0) {
              overdueEmployeeIds.push(review.employeeId)
              const flag = `SELF_EVAL_LATE_${days}D`
              await tx.performanceReview.update({
                where: { id: review.id },
                data: {
                  overdueFlags: addOverdueFlag(review.overdueFlags, flag),
                },
              })

              await tx.performanceEvaluation.updateMany({
                where: { cycleId: id, employeeId: review.employeeId, evalType: 'SELF' },
                data: { overdueAt: now },
              })
            }
          }

          overdueCount = overdueEmployeeIds.length
        }

        // ── CALIBRATION → FINALIZED ──────────────────────
        if (currentStatus === 'CALIBRATION') {
          // Copy manager grades to PerformanceReview
          const reviews = await tx.performanceReview.findMany({
            where: { cycleId: id },
            select: { id: true, employeeId: true, finalGrade: true },
          })

          for (const review of reviews) {
            // Skip reviews that already have finalGrade (set during calibration adjust)
            if (review.finalGrade) continue

            const managerEval = await tx.performanceEvaluation.findFirst({
              where: { cycleId: id, employeeId: review.employeeId, evalType: 'MANAGER' },
              select: { originalGradeEnum: true, finalGradeEnum: true, performanceGrade: true },
            })

            if (managerEval) {
              // Resolve grade: enum fields take priority, fall back to performanceGrade string
              const validGrades = ['E', 'M_PLUS', 'M', 'B'] as const
              type PGrade = typeof validGrades[number]
              const pgAsEnum = validGrades.includes(managerEval.performanceGrade as PGrade)
                ? (managerEval.performanceGrade as PGrade)
                : null

              const original = managerEval.originalGradeEnum ?? managerEval.finalGradeEnum ?? pgAsEnum
              const final = managerEval.finalGradeEnum ?? managerEval.originalGradeEnum ?? pgAsEnum

              if (original || final) {
                await tx.performanceReview.update({
                  where: { id: review.id },
                  data: {
                    originalGrade: original,
                    finalGrade: final,
                    status: 'CALIBRATED',
                    calibrationNote: original !== final ? 'Calibration adjusted' : null,
                  },
                })
              }
            }
          }
        }

        // ── FINALIZED → CLOSED (auto-ack check) ─────────
        // No special processing — advance is manually triggered after notifications

        // ── CLOSED → COMP_REVIEW ────────────────────────
        // No special processing — HR manually triggers

        // ── COMP_REVIEW → COMP_COMPLETED ────────────────
        // No special processing here — handled by comp approval flow

        // ══ Update cycle status ═══════════════════════════
        const updated = await tx.performanceCycle.update({
          where: { id },
          data: { status: nextStatus },
          include: {
            _count: {
              select: {
                mboGoals: true,
                performanceEvaluations: true,
                performanceReviews: true,
              },
            },
          },
        })

        return { updated, overdueCount, overdueEmployeeIds }
      })

      // ════════════════════════════════════════════════════
      // POST-TRANSACTION: Audit + Events (fire-and-forget)
      // ════════════════════════════════════════════════════

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'performance.cycle.advance',
        resourceType: 'performanceCycle',
        resourceId: result.updated.id,
        companyId: result.updated.companyId,
        changes: {
          from: currentStatus,
          to: nextStatus,
          overdueCount: result.overdueCount,
        },
        ip,
        userAgent,
      })

      // Phase change event
      void eventBus.publish(DOMAIN_EVENTS.PERFORMANCE_CYCLE_PHASE_CHANGED, {
        ctx,
        cycleId: result.updated.id,
        companyId: result.updated.companyId,
        fromPhase: currentStatus,
        toPhase: nextStatus,
        cycleName: result.updated.name,
        year: result.updated.year,
        half: result.updated.half,
      })

      // Step-specific events
      if (currentStatus === 'ACTIVE' && result.overdueCount > 0) {
        void eventBus.publish(DOMAIN_EVENTS.GOAL_OVERDUE, {
          ctx, cycleId: id, companyId: cycle.companyId,
          overdueEmployeeIds: result.overdueEmployeeIds,
          overdueCount: result.overdueCount,
          daysSinceDeadline: daysSinceDeadline(cycle.goalEnd, now),
        })
      }

      if (currentStatus === 'CHECK_IN' && result.overdueCount > 0) {
        void eventBus.publish(DOMAIN_EVENTS.CHECKIN_OVERDUE, {
          ctx, cycleId: id, companyId: cycle.companyId,
          overdueEmployeeIds: result.overdueEmployeeIds,
          overdueCount: result.overdueCount,
          checkInMode: cycle.checkInMode,
        })
      }

      if (currentStatus === 'EVAL_OPEN' && result.overdueCount > 0) {
        void eventBus.publish(DOMAIN_EVENTS.SELF_EVAL_OVERDUE, {
          ctx, cycleId: id, companyId: cycle.companyId,
          overdueEmployeeIds: result.overdueEmployeeIds,
          overdueCount: result.overdueCount,
          daysSinceDeadline: daysSinceDeadline(cycle.evalEnd, now),
        })
      }

      if (currentStatus === 'CALIBRATION') {
        // Count reviews where grade was adjusted (originalGrade !== finalGrade)
        const allReviews = await prisma.performanceReview.findMany({
          where: { cycleId: id, originalGrade: { not: null }, finalGrade: { not: null } },
          select: { originalGrade: true, finalGrade: true },
        })
        const adjustedCount = allReviews.filter((r) => r.originalGrade !== r.finalGrade).length

        void eventBus.publish(DOMAIN_EVENTS.CALIBRATION_APPROVED, {
          ctx, cycleId: id, companyId: cycle.companyId,
          approvedBy: user.employeeId,
          totalEmployees: result.updated._count.performanceReviews,
          adjustedCount,
        })
      }

      if (nextStatus === 'CLOSED') {
        const totalEvaluated = await prisma.performanceEvaluation.count({
          where: { cycleId: id, companyId: cycle.companyId, status: 'SUBMITTED' },
        })
        void eventBus.publish(DOMAIN_EVENTS.PERFORMANCE_CYCLE_FINALIZED, {
          ctx, cycleId: id, companyId: cycle.companyId,
          cycleName: result.updated.name,
          year: result.updated.year,
          half: result.updated.half,
          totalEvaluated,
        })
      }

      return apiSuccess({
        ...result.updated,
        overdueCount: result.overdueCount,
        overdueEmployeeIds: result.overdueEmployeeIds,
      })
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.PERFORMANCE, ACTION.APPROVE),
)
