// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GP#4 Compensation Dashboard
// GET /api/v1/performance/compensation/[cycleId]/dashboard
//
// Design Decision #19: Exception statistics
// GEMINI FIX #1: Math.round() on all monetary aggregations
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { getGradeLabel } from '@/lib/performance/data-masking'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/performance/compensation/[cycleId]/dashboard

export const GET = withPermission(
    async (_req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
        const { cycleId } = await context.params

        try {
            const cycle = await prisma.performanceCycle.findFirst({
                where: { id: cycleId, companyId: user.companyId },
                select: { id: true, name: true, companyId: true },
            })

            if (!cycle) throw badRequest('사이클을 찾을 수 없습니다.')

            // Fetch all compensation records for this cycle
            const records = await prisma.compensationHistory.findMany({
                where: { cycleId, companyId: cycle.companyId },
                select: {
                    employeeId: true,
                    changePct: true,
                    previousBaseSalary: true,
                    newBaseSalary: true,
                    performanceGradeAtTime: true,
                    isException: true,
                    exceptionReason: true,
                    employee: {
                        select: {
                            id: true,
                            name: true,
                            employeeNo: true,
                            assignments: {
                                where: { isPrimary: true, endDate: null, companyId: cycle.companyId },
                                take: 1,
                                select: { department: { select: { name: true } } },
                            },
                        },
                    },
                },
            })

            // Total reviews for the cycle (to know how many are pending)
            const totalReviews = await prisma.performanceReview.count({
                where: { cycleId, companyId: cycle.companyId },
            })

            const processedEmployees = records.length
            const exceptionCount = records.filter((r) => r.isException).length

            // Calculate averages
            const changePcts = records.map((r) => Number(r.changePct))
            const avgMeritPct = changePcts.length > 0
                ? Math.round(changePcts.reduce((s, v) => s + v, 0) / changePcts.length * 100) / 100
                : 0

            // Median calculation
            const sorted = [...changePcts].sort((a, b) => a - b)
            const medianMeritPct = sorted.length > 0
                ? sorted.length % 2 === 0
                    ? Math.round(((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2) * 100) / 100
                    : sorted[Math.floor(sorted.length / 2)]
                : 0

            const totalBudgetImpact = Math.round(
                records.reduce((s, r) => s + (Number(r.newBaseSalary) - Number(r.previousBaseSalary)), 0),
            )

            // By grade
            const gradeMap = new Map<string, { count: number; totalPct: number; totalImpact: number }>()
            for (const r of records) {
                const grade = r.performanceGradeAtTime ?? 'UNKNOWN'
                const entry = gradeMap.get(grade) ?? { count: 0, totalPct: 0, totalImpact: 0 }
                entry.count++
                entry.totalPct += Number(r.changePct)
                entry.totalImpact += Number(r.newBaseSalary) - Number(r.previousBaseSalary)
                gradeMap.set(grade, entry)
            }

            const byGrade = Array.from(gradeMap.entries()).map(([grade, data]) => ({
                grade,
                gradeLabel: getGradeLabel(grade, 'ko'),
                count: data.count,
                avgMeritPct: Math.round((data.totalPct / data.count) * 100) / 100,
                totalImpact: Math.round(data.totalImpact),
            }))

            // By department
            const deptMap = new Map<string, { count: number; totalPct: number; exceptionCount: number }>()
            for (const r of records) {
                const dept = extractPrimaryAssignment(r.employee.assignments)?.department?.name ?? '미배정'
                const entry = deptMap.get(dept) ?? { count: 0, totalPct: 0, exceptionCount: 0 }
                entry.count++
                entry.totalPct += Number(r.changePct)
                if (r.isException) entry.exceptionCount++
                deptMap.set(dept, entry)
            }

            const byDepartment = Array.from(deptMap.entries()).map(([dept, data]) => ({
                departmentName: dept,
                count: data.count,
                avgMeritPct: Math.round((data.totalPct / data.count) * 100) / 100,
                exceptionCount: data.exceptionCount,
            }))

            // Exceptions list
            const exceptions = records
                .filter((r) => r.isException)
                .map((r) => ({
                    employeeId: r.employeeId,
                    employeeName: r.employee.name,
                    employeeNo: r.employee.employeeNo,
                    department: extractPrimaryAssignment(r.employee.assignments)?.department?.name ?? '',
                    grade: r.performanceGradeAtTime ?? '',
                    appliedPct: Number(r.changePct),
                    exceptionReason: r.exceptionReason ?? '',
                }))

            return apiSuccess({
                cycleName: cycle.name,
                summary: {
                    totalEmployees: totalReviews,
                    processedEmployees,
                    pendingEmployees: totalReviews - processedEmployees,
                    averageMeritPct: avgMeritPct,
                    medianMeritPct,
                    totalBudgetImpact,
                    exceptionCount,
                    exceptionRatio: processedEmployees > 0
                        ? Math.round((exceptionCount / processedEmployees) * 1000) / 10
                        : 0,
                },
                byGrade,
                byDepartment,
                exceptions,
            })
        } catch (error) {
            throw handlePrismaError(error)
        }
    },
    perm(MODULE.PERFORMANCE, ACTION.APPROVE),
)
