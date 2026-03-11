// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GP#4 Calibration Distribution
// GET /api/v1/performance/calibration/:sessionId/distribution
//
// Design Decision #3: Guideline distribution E=10%, M+=30%, M=50%, B=10%
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

// Settings-connected: guideline percentages per company (seed: PERFORMANCE/calibration-distribution)
const GRADE_GUIDELINES: Record<string, number> = {
    E: 10,
    M_PLUS: 30,
    M: 50,
    B: 10,
}

// ─── GET /api/v1/performance/calibration/:sessionId/distribution

export const GET = withPermission(
    async (_req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
        const { sessionId } = await context.params

        try {
            const session = await prisma.calibrationSession.findFirst({
                where: { id: sessionId, companyId: user.companyId },
                select: {
                    id: true, cycleId: true, companyId: true, departmentId: true,
                    cycle: { select: { name: true } },
                },
            })

            if (!session) throw notFound('캘리브레이션 세션을 찾을 수 없습니다.')

            // Get all reviews for cycle (optionally filtered by department)
            const reviewWhere: Record<string, unknown> = { cycleId: session.cycleId }
            if (session.departmentId) {
                reviewWhere.employee = {
                    assignments: {
                        some: {
                            departmentId: session.departmentId,
                            isPrimary: true,
                            endDate: null,
                        },
                    },
                }
            }

            const reviews = await prisma.performanceReview.findMany({
                where: reviewWhere,
                select: {
                    originalGrade: true,
                    finalGrade: true,
                    employee: {
                        select: {
                            assignments: {
                                where: { isPrimary: true, endDate: null },
                                take: 1,
                                select: { department: { select: { id: true, name: true } } },
                            },
                        },
                    },
                },
            })

            const total = reviews.length

            // Overall distribution
            const gradeCount: Record<string, number> = { E: 0, M_PLUS: 0, M: 0, B: 0 }
            for (const review of reviews) {
                const grade = (review.finalGrade ?? review.originalGrade ?? 'M') as string
                if (gradeCount[grade] !== undefined) {
                    gradeCount[grade]++
                }
            }

            // Settings-connected: deviation threshold (default: 5pp)
            const DEVIATION_THRESHOLD = 5

            const distribution = Object.entries(gradeCount).map(([grade, count]) => {
                const percentage = total > 0 ? Math.round((count / total) * 1000) / 10 : 0
                const guidelinePercentage = GRADE_GUIDELINES[grade] ?? 0
                const deviation = Math.round((percentage - guidelinePercentage) * 10) / 10

                return {
                    grade,
                    count,
                    percentage,
                    guidelinePercentage,
                    deviation,
                    isWarning: Math.abs(deviation) > DEVIATION_THRESHOLD,
                }
            })

            // Department breakdown
            const deptMap = new Map<string, { name: string; grades: Record<string, number>; total: number }>()
            for (const review of reviews) {
                const dept = review.employee?.assignments[0]?.department
                if (!dept) continue
                if (!deptMap.has(dept.id)) {
                    deptMap.set(dept.id, { name: dept.name, grades: { E: 0, M_PLUS: 0, M: 0, B: 0 }, total: 0 })
                }
                const d = deptMap.get(dept.id)!
                const grade = (review.finalGrade ?? review.originalGrade ?? 'M') as string
                if (d.grades[grade] !== undefined) d.grades[grade]++
                d.total++
            }

            const departmentBreakdown = Array.from(deptMap.values()).map((dept) => ({
                departmentName: dept.name,
                distribution: Object.entries(dept.grades).map(([grade, count]) => ({
                    grade,
                    count,
                    percentage: dept.total > 0 ? Math.round((count / dept.total) * 1000) / 10 : 0,
                    guidelinePercentage: GRADE_GUIDELINES[grade] ?? 0,
                    deviation: dept.total > 0
                        ? Math.round(((count / dept.total) * 100 - (GRADE_GUIDELINES[grade] ?? 0)) * 10) / 10
                        : 0,
                    isWarning: dept.total > 0
                        ? Math.abs((count / dept.total) * 100 - (GRADE_GUIDELINES[grade] ?? 0)) > DEVIATION_THRESHOLD
                        : false,
                })),
            }))

            return apiSuccess({
                total,
                cycleName: session.cycle.name,
                distribution,
                departmentBreakdown,
            })
        } catch (error) {
            throw handlePrismaError(error)
        }
    },
    perm(MODULE.PERFORMANCE, ACTION.VIEW),
)
