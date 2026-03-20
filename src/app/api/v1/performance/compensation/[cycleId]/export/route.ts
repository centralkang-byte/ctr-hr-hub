// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GP#4 Compensation Export
// GET /api/v1/performance/compensation/[cycleId]/export
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/performance/compensation/[cycleId]/export

export const GET = withRateLimit(withPermission(
    async (_req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
        const { cycleId } = await context.params

        try {
            const cycle = await prisma.performanceCycle.findFirst({
                where: { id: cycleId, companyId: user.companyId },
                select: { id: true, name: true, companyId: true },
            })

            if (!cycle) throw badRequest('사이클을 찾을 수 없습니다.')

            const records = await prisma.compensationHistory.findMany({
                where: { cycleId, companyId: cycle.companyId },
                select: {
                    employeeId: true,
                    previousBaseSalary: true,
                    newBaseSalary: true,
                    changePct: true,
                    performanceGradeAtTime: true,
                    isException: true,
                    exceptionReason: true,
                    compaRatio: true,
                    effectiveDate: true,
                    employee: {
                        select: {
                            employeeNo: true,
                            name: true,
                            nameEn: true,
                            assignments: {
                                where: { isPrimary: true, endDate: null, companyId: cycle.companyId },
                                take: 1,
                                select: {
                                    department: { select: { name: true } },
                                    jobGrade: { select: { name: true } },
                                },
                            },
                        },
                    },
                },
                orderBy: [
                    { employee: { name: 'asc' } },
                ],
            })

            const data = records.map((r) => {
                const primary = extractPrimaryAssignment(r.employee.assignments)
                return {
                employeeNumber: r.employee.employeeNo,
                employeeName: r.employee.name,
                employeeNameEn: r.employee.nameEn,
                department: primary?.department?.name ?? '',
                position: primary?.jobGrade?.name ?? '',
                grade: r.performanceGradeAtTime ?? '',
                currentSalary: Number(r.previousBaseSalary),
                comparatio: r.compaRatio ? Number(r.compaRatio) : null,
                meritPct: Number(r.changePct),
                increaseAmount: Math.round(Number(r.newBaseSalary) - Number(r.previousBaseSalary)),
                newSalary: Number(r.newBaseSalary),
                effectiveDate: r.effectiveDate,
                isException: r.isException,
                exceptionReason: r.exceptionReason ?? null,
            }})

            return apiSuccess({
                exportDate: new Date().toISOString(),
                cycleName: cycle.name,
                totalRecords: data.length,
                data,
            })
        } catch (error) {
            throw handlePrismaError(error)
        }
    },
    perm(MODULE.PERFORMANCE, ACTION.APPROVE),
), RATE_LIMITS.EXPORT)
