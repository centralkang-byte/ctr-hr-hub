// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GP#4 Cycle Initialize
// POST /api/v1/performance/cycles/:id/initialize
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { eventBus, DOMAIN_EVENTS } from '@/lib/events'
import type { SessionUser } from '@/types'

// ─── POST /api/v1/performance/cycles/:id/initialize ──────
// Creates PerformanceReview records for all participants
// Transitions cycle: DRAFT → ACTIVE (Goal Setting)

export const POST = withPermission(
    async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
        const { id: cycleId } = await context.params

        try {
            const cycle = await prisma.performanceCycle.findUnique({
                where: { id: cycleId },
            })

            if (!cycle) {
                throw badRequest('사이클을 찾을 수 없습니다.')
            }

            if (cycle.companyId !== user.companyId && user.role !== 'SUPER_ADMIN') {
                throw badRequest('접근 권한이 없습니다.')
            }

            if (cycle.status !== 'DRAFT') {
                throw badRequest('DRAFT 상태의 사이클만 개시할 수 있습니다.')
            }

            // 1. Find target employees
            const targetFilter = cycle.targetFilter as {
                departments?: string[]
                levels?: string[]
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

            const employees = await prisma.employee.findMany({
                where: employeeWhere,
                select: { id: true },
            })

            if (employees.length === 0) {
                throw badRequest('대상 직원이 없습니다. 사이클 필터 설정을 확인해주세요.')
            }

            // 2. Bulk create PerformanceReview + update cycle status (transaction)
            const result = await prisma.$transaction(async (tx) => {
                // Skip employees who already have a review (idempotency)
                const existingReviews = await tx.performanceReview.findMany({
                    where: { cycleId },
                    select: { employeeId: true },
                })
                const existingSet = new Set(existingReviews.map((r) => r.employeeId))
                const newEmployees = employees.filter((e) => !existingSet.has(e.id))

                if (newEmployees.length > 0) {
                    await tx.performanceReview.createMany({
                        data: newEmployees.map((emp) => ({
                            cycleId,
                            employeeId: emp.id,
                            companyId: cycle.companyId,
                            status: 'GOAL_SETTING' as const,
                            overdueFlags: [],
                        })),
                        skipDuplicates: true,
                    })
                }

                // 3. Transition cycle to ACTIVE (= Goal Setting in GP#4 pipeline)
                const updatedCycle = await tx.performanceCycle.update({
                    where: { id: cycleId },
                    data: { status: 'ACTIVE' },
                })

                return {
                    cycle: updatedCycle,
                    created: newEmployees.length,
                    skipped: existingSet.size,
                    total: employees.length,
                }
            })

            // 4. Audit + Event
            const { ip, userAgent } = extractRequestMeta(req.headers)
            logAudit({
                actorId: user.employeeId,
                action: 'performance.cycle.initialize',
                resourceType: 'performanceCycle',
                resourceId: cycleId,
                companyId: cycle.companyId,
                changes: { created: result.created, total: result.total },
                ip,
                userAgent,
            })

            void eventBus.publish(DOMAIN_EVENTS.PERFORMANCE_CYCLE_PHASE_CHANGED, {
                ctx: {
                    companyId: cycle.companyId,
                    actorId: user.employeeId,
                    occurredAt: new Date(),
                },
                cycleId,
                companyId: cycle.companyId,
                fromPhase: 'DRAFT',
                toPhase: 'ACTIVE',
                cycleName: cycle.name,
                year: cycle.year,
                half: cycle.half,
            })

            return apiSuccess({
                message: `${result.created}명의 평가 레코드가 생성되었습니다.`,
                created: result.created,
                skipped: result.skipped,
                total: result.total,
            })
        } catch (error) {
            throw handlePrismaError(error)
        }
    },
    perm(MODULE.PERFORMANCE, ACTION.APPROVE),
)
