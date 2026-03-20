// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GP#4 Overdue Check
// GET /api/v1/performance/cycles/:id/overdue/:step
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'
import type { SessionUser } from '@/types'

const stepEnum = z.enum(['goal', 'checkin', 'self-eval'])

// ─── GET /api/v1/performance/cycles/:id/overdue/:step ─────
// Returns employees overdue for a specific step

export const GET = withPermission(
    async (_req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
        const { id: cycleId, step } = await context.params

        const parsedStep = stepEnum.safeParse(step)
        if (!parsedStep.success) {
            throw badRequest('유효하지 않은 단계입니다. goal | checkin | self-eval 중 하나를 선택하세요.')
        }

        try {
            const cycle = await prisma.performanceCycle.findUnique({
                where: { id: cycleId },
                select: {
                    id: true,
                    companyId: true,
                    goalEnd: true,
                    checkInDeadline: true,
                    evalEnd: true,
                },
            })

            if (!cycle) throw badRequest('사이클을 찾을 수 없습니다.')
            if (cycle.companyId !== user.companyId && user.role !== 'SUPER_ADMIN') {
                throw badRequest('접근 권한이 없습니다.')
            }

            // Find reviews with overdue flags matching the step
            const overdueFlagPrefix = {
                goal: 'GOAL_',
                checkin: 'CHECKIN_',
                'self-eval': 'SELF_EVAL_',
            }[parsedStep.data]

            // Get deadline for this step
            const deadline = {
                goal: cycle.goalEnd,
                checkin: cycle.checkInDeadline,
                'self-eval': cycle.evalEnd,
            }[parsedStep.data]

            // Find reviews that should be further along based on cycle status
            const statusForStep = {
                goal: 'GOAL_SETTING' as const,
                checkin: 'GOAL_SETTING' as const, // still in goal setting = didn't start checkin
                'self-eval': 'SELF_EVAL' as const,
            }[parsedStep.data]

            const now = new Date()
            const isOverdue = deadline ? now > deadline : false

            const reviews = await prisma.performanceReview.findMany({
                where: {
                    cycleId,
                    status: statusForStep,
                },
                include: {
                    employee: {
                        select: {
                            id: true,
                            name: true,
                            nameEn: true,
                            employeeNo: true,
                            assignments: {
                                where: { companyId: cycle.companyId, isPrimary: true, endDate: null },
                                take: 1,
                                select: {
                                    department: { select: { id: true, name: true } },
                                },
                            },
                        },
                    },
                },
            })

            const overdueEmployees = reviews.map((r) => {
                const flags = (r.overdueFlags as string[]) || []
                const daysSinceDeadline = deadline
                    ? Math.max(0, Math.floor((now.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24)))
                    : 0

                return {
                    id: r.employee.id,
                    name: r.employee.name,
                    nameEn: r.employee.nameEn,
                    employeeNo: r.employee.employeeNo,
                    department: extractPrimaryAssignment(r.employee.assignments)?.department ?? null,
                    reviewStatus: r.status,
                    daysSinceDeadline,
                    overdueFlags: flags.filter((f: string) => f.startsWith(overdueFlagPrefix)),
                    isOverdue,
                }
            })

            return apiSuccess({
                step: parsedStep.data,
                deadline,
                isOverdue,
                overdueCount: overdueEmployees.length,
                employees: overdueEmployees,
            })
        } catch (error) {
            throw handlePrismaError(error)
        }
    },
    perm(MODULE.PERFORMANCE, ACTION.VIEW),
)
