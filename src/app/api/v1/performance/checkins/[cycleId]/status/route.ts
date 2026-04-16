// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GP#4 Check-in Status
// GET /api/v1/performance/checkins/:cycleId/status
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, forbidden, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── Manager+ only roles ────────────────────────────────
const MANAGER_UP: Set<string> = new Set([ROLE.SUPER_ADMIN, ROLE.HR_ADMIN, ROLE.EXECUTIVE, ROLE.MANAGER])

// ─── GET /api/v1/performance/checkins/:cycleId/status ────
// Returns per-employee check-in completion status (manager-level)

export const GET = withPermission(
    async (_req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
        if (!MANAGER_UP.has(user.role as string)) {
            throw forbidden('매니저 이상 권한이 필요합니다.')
        }

        const { cycleId } = await context.params

        try {
            const cycle = await prisma.performanceCycle.findFirst({
                where: { id: cycleId, companyId: user.companyId },
                select: { id: true, companyId: true, goalEnd: true, checkInDeadline: true },
            })

            if (!cycle) throw badRequest('사이클을 찾을 수 없습니다.')

            // Get all reviews for cycle
            const reviews = await prisma.performanceReview.findMany({
                where: { cycleId },
                select: {
                    employeeId: true,
                    status: true,
                    overdueFlags: true,
                    employee: {
                        select: { id: true, name: true, nameEn: true, employeeNo: true },
                    },
                },
            })

            // For each employee, check 3 conditions
            const employees = await Promise.all(
                reviews.map(async (review) => {
                    const empId = review.employeeId

                    const [managerCheckins, employeeCheckins, goalProgress] = await Promise.all([
                        // Manager created a checkin for this employee
                        prisma.oneOnOne.count({
                            where: {
                                cycleId,
                                employeeId: empId,
                                isCheckinRecord: true,
                                managerId: { not: empId },
                            },
                        }),
                        // Employee created their own checkin
                        prisma.oneOnOne.count({
                            where: {
                                cycleId,
                                employeeId: empId,
                                isCheckinRecord: true,
                                managerId: empId,
                            },
                        }),
                        // Goal progress updated during check-in period
                        prisma.mboProgress.count({
                            where: {
                                goal: { cycleId, employeeId: empId },
                                ...(cycle.goalEnd ? { createdAt: { gte: cycle.goalEnd } } : {}),
                            },
                        }),
                    ])

                    const managerCheckin = managerCheckins > 0
                    const employeeCheckin = employeeCheckins > 0
                    const goalProgressUpdated = goalProgress > 0
                    const isComplete = managerCheckin && goalProgressUpdated

                    return {
                        id: review.employee.id,
                        name: review.employee.name,
                        nameEn: review.employee.nameEn,
                        employeeNo: review.employee.employeeNo,
                        managerCheckin,
                        employeeCheckin,
                        goalProgressUpdated,
                        isComplete,
                        overdueFlags: review.overdueFlags as string[],
                    }
                }),
            )

            const completedCount = employees.filter((e) => e.isComplete).length
            const overdueCount = employees.filter((e) => !e.isComplete).length

            return apiSuccess({
                totalParticipants: employees.length,
                completedCount,
                overdueCount,
                checkInDeadline: cycle.checkInDeadline,
                employees,
            })
        } catch (error) {
            throw handlePrismaError(error)
        }
    },
    perm(MODULE.PERFORMANCE, ACTION.VIEW),
)
