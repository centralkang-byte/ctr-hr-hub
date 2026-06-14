// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GP#4 Cycle Participants
// GET /api/v1/performance/cycles/:id/participants
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, forbidden, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE, DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '@/lib/constants'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'
import type { SessionUser } from '@/types'

const querySchema = z.object({
    page: z.coerce.number().int().positive().default(DEFAULT_PAGE),
    limit: z.coerce.number().int().positive().max(200).default(DEFAULT_PAGE_SIZE),
})

// 전 직원의 originalGrade/finalGrade/overdueFlags(캘리브레이션 산물)를 반환하는
// HR/관리자 로스터 뷰 — perm(VIEW)만으론 EMPLOYEE도 통과해 회사 전체 등급이 유출된다.
// 등급은 매니저에게도 임의 직원 분을 노출하면 안 되므로 HR/임원/SUPER로 한정.
const HR_UP: Set<string> = new Set([ROLE.SUPER_ADMIN, ROLE.HR_ADMIN, ROLE.EXECUTIVE])

// ─── GET /api/v1/performance/cycles/:id/participants ───────
// Returns employees targeted by cycle + their PerformanceReview status

export const GET = withPermission(
    async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
        // 권한 게이트 — 등급 포함 로스터는 HR/임원/SUPER만. (perm VIEW는 EMPLOYEE도 보유)
        if (!HR_UP.has(user.role as string)) {
            throw forbidden('인사 담당자 이상만 조회할 수 있습니다.')
        }

        const { id: cycleId } = await context.params
        const params = Object.fromEntries(req.nextUrl.searchParams.entries())
        const parsed = querySchema.safeParse(params)
        if (!parsed.success) {
            throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
        }

        const { page, limit } = parsed.data

        try {
            // 1. Get cycle with settings
            const cycle = await prisma.performanceCycle.findUnique({
                where: { id: cycleId },
                select: {
                    id: true,
                    companyId: true,
                    excludeProbation: true,
                    targetFilter: true,
                },
            })

            if (!cycle) {
                throw badRequest('사이클을 찾을 수 없습니다.')
            }

            // Security: company scope
            if (cycle.companyId !== user.companyId && user.role !== 'SUPER_ADMIN') {
                throw badRequest('접근 권한이 없습니다.')
            }

            // 2. Build employee filter
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

            // Settings-connected: probation exclusion logic (cycle.excludeProbation flag)
            const employeeWhere: Record<string, unknown> = {
                deletedAt: null,
                assignments: { some: assignmentWhere },
            }

            if (cycle.excludeProbation) {
                employeeWhere.probationStatus = { not: 'IN_PROGRESS' }
            }

            // 3. Fetch employees + their review status
            const [employees, total] = await Promise.all([
                prisma.employee.findMany({
                    where: employeeWhere,
                    skip: (page - 1) * limit,
                    take: limit,
                    orderBy: { name: 'asc' },
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
                                jobGrade: { select: { id: true, name: true, code: true } },
                            },
                        },
                        performanceReviews: {
                            where: { cycleId },
                            take: 1,
                            select: {
                                id: true,
                                status: true,
                                overdueFlags: true,
                                originalGrade: true,
                                finalGrade: true,
                            },
                        },
                    },
                }),
                prisma.employee.count({ where: employeeWhere }),
            ])

            const result = employees.map((emp) => {
                const primary = extractPrimaryAssignment(emp.assignments)
                return {
                    id: emp.id,
                    name: emp.name,
                    nameEn: emp.nameEn,
                    employeeNo: emp.employeeNo,
                    department: primary?.department ?? null,
                    jobGrade: primary?.jobGrade ?? null,
                    review: emp.performanceReviews[0] ?? null,
                }
            })

            return apiPaginated(result, buildPagination(page, limit, total))
        } catch (error) {
            throw handlePrismaError(error)
        }
    },
    perm(MODULE.PERFORMANCE, ACTION.VIEW),
)
