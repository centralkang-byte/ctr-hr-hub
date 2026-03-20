// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GP#4 Compensation Recommendations
// GET /api/v1/performance/compensation/[cycleId]/recommendations
//
// Design Decision #15: Merit Matrix (Grade × Comparatio Band)
// GEMINI FIX #1: Math.round() for all salary calculations
// GEMINI FIX #3: Division-by-zero safe comparatio
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { getGradeLabel } from '@/lib/performance/data-masking'
import {
    getMeritRecommendation,
    getCurrentSalary,
    getSalaryBandMidpoint,
    calculateComparatio,
} from '@/lib/performance/merit-matrix'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/performance/compensation/[cycleId]/recommendations

export const GET = withPermission(
    async (_req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
        const { cycleId } = await context.params

        try {
            const cycle = await prisma.performanceCycle.findFirst({
                where: { id: cycleId, companyId: user.companyId },
                select: { id: true, name: true, status: true, companyId: true },
            })

            if (!cycle) throw badRequest('사이클을 찾을 수 없습니다.')
            if (!['COMP_REVIEW', 'COMP_COMPLETED', 'CLOSED'].includes(cycle.status)) {
                throw badRequest('보상 기획(COMP_REVIEW) 이후 단계에서만 조회 가능합니다.')
            }

            // Fetch all reviews with finalGrade
            const reviews = await prisma.performanceReview.findMany({
                where: { cycleId, companyId: cycle.companyId },
                select: {
                    id: true,
                    employeeId: true,
                    finalGrade: true,
                    employee: {
                        select: {
                            id: true,
                            name: true,
                            nameEn: true,
                            employeeNo: true,
                            assignments: {
                                where: { isPrimary: true, endDate: null, companyId: cycle.companyId },
                                take: 1,
                                select: {
                                    jobGradeId: true,
                                    department: { select: { name: true } },
                                    jobGrade: { select: { name: true } },
                                },
                            },
                        },
                    },
                },
            })

            const recommendations = []
            const skipped = []
            let totalBudgetImpact = 0

            for (const review of reviews) {
                // Skip if no finalGrade (calibration incomplete)
                if (!review.finalGrade) {
                    skipped.push({
                        employeeId: review.employeeId,
                        employeeName: review.employee.name,
                        reason: 'finalGrade 미설정 (캘리브레이션 미완료)',
                    })
                    continue
                }

                const assignment = extractPrimaryAssignment(review.employee.assignments)
                const { salary: currentSalary } = await getCurrentSalary(
                    review.employeeId, cycle.companyId, prisma,
                )

                // Get midpoint for comparatio
                const midpoint = await getSalaryBandMidpoint(
                    assignment?.jobGradeId ?? null, cycle.companyId, prisma,
                )
                const comparatio = calculateComparatio(currentSalary, midpoint)

                // Look up merit matrix
                const merit = await getMeritRecommendation(
                    review.finalGrade, comparatio, cycle.companyId, prisma,
                )

                // GEMINI FIX #1: Math.round() at final step
                const projectedIncrease = Math.round(currentSalary * merit.meritRecommendedPct / 100)
                const projectedNewSalary = currentSalary + projectedIncrease

                totalBudgetImpact += projectedIncrease

                recommendations.push({
                    reviewId: review.id,
                    employeeId: review.employeeId,
                    employeeName: review.employee.name,
                    employeeNo: review.employee.employeeNo,
                    department: assignment?.department?.name ?? '',
                    position: assignment?.jobGrade?.name ?? '',
                    finalGrade: review.finalGrade,
                    finalGradeLabel: getGradeLabel(review.finalGrade, 'ko'),
                    currentSalary,
                    comparatio,
                    comparatioBand: merit.comparatioBand,
                    meritMinPct: merit.meritMinPct,
                    meritMaxPct: merit.meritMaxPct,
                    meritRecommendedPct: merit.meritRecommendedPct,
                    projectedIncrease,
                    projectedNewSalary,
                })
            }

            // Sort by department, then name
            recommendations.sort((a, b) => {
                const deptCmp = a.department.localeCompare(b.department, 'ko')
                if (deptCmp !== 0) return deptCmp
                return a.employeeName.localeCompare(b.employeeName, 'ko')
            })

            return apiSuccess({
                cycleId,
                cycleName: cycle.name,
                totalEmployees: reviews.length,
                processedEmployees: recommendations.length,
                skippedCount: skipped.length,
                totalBudgetImpact: Math.round(totalBudgetImpact),
                recommendations,
                skipped,
            })
        } catch (error) {
            throw handlePrismaError(error)
        }
    },
    perm(MODULE.PERFORMANCE, ACTION.APPROVE),
)
