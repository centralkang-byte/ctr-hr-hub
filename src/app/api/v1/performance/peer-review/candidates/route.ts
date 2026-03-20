// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GP#4 Peer Review Candidate Pool
// GET /api/v1/performance/peer-review/candidates
//
// GEMINI FIX #2: Pre-filter at DB level, cap at 200, then score.
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

const querySchema = z.object({
    cycleId: z.string().uuid(),
    employeeId: z.string().uuid(),
})

// ─── GET /api/v1/performance/peer-review/candidates ──────

export const GET = withPermission(
    async (req: NextRequest, _context, _user: SessionUser) => {
        const params = Object.fromEntries(req.nextUrl.searchParams.entries())
        const parsed = querySchema.safeParse(params)
        if (!parsed.success) {
            throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
        }

        const { cycleId, employeeId } = parsed.data

        try {
            // Get employee's primary assignment for filtering
            const employeeAssignment = await prisma.employeeAssignment.findFirst({
                where: { employeeId, isPrimary: true, endDate: null, effectiveDate: { lte: new Date() } },
                select: {
                    companyId: true,
                    departmentId: true,
                    department: { select: { id: true, parentId: true } },
                    jobGradeId: true,
                    jobGrade: { select: { id: true, code: true, rankOrder: true } },
                    positionId: true,
                    position: { select: { dottedLinePositionId: true } },
                },
            })

            if (!employeeAssignment) throw badRequest('직원의 소속 정보가 없습니다.')

            // B-3f: Include dotted line manager as automatic peer review candidate
            let dottedLineManagerId: string | null = null
            if (employeeAssignment.position?.dottedLinePositionId) {
                const dottedManagerAssignment = await prisma.employeeAssignment.findFirst({
                    where: {
                        positionId: employeeAssignment.position.dottedLinePositionId,
                        isPrimary: true,
                        endDate: null,
                        effectiveDate: { lte: new Date() },
                    },
                    select: { employeeId: true },
                })
                if (dottedManagerAssignment && dottedManagerAssignment.employeeId !== employeeId) {
                    dottedLineManagerId = dottedManagerAssignment.employeeId
                }
            }

            // Already nominated peers
            const existingNominations = await prisma.peerReviewNomination.findMany({
                where: { cycleId, employeeId },
                select: { nomineeId: true },
            })
            const alreadyNominated = existingNominations.map((n) => n.nomineeId)

            // DB-level pre-filter (GEMINI FIX #2: cap at 200)
            const candidates = await prisma.employee.findMany({
                where: {
                    id: { not: employeeId },
                    deletedAt: null,
                    assignments: {
                        some: {
                            companyId: employeeAssignment.companyId,
                            isPrimary: true,
                            endDate: null,
                            status: 'ACTIVE',
                        },
                    },
                },
                take: 200,
                include: {
                    assignments: {
                        where: { isPrimary: true, endDate: null, companyId: employeeAssignment.companyId },
                        take: 1,
                        select: {
                            departmentId: true,
                            department: { select: { id: true, name: true, parentId: true } },
                            jobGradeId: true,
                            jobGrade: { select: { id: true, name: true, code: true, rankOrder: true } },
                        },
                    },
                },
            })

            // B-3f: Ensure dotted line manager is in candidates even if outside company filter or 200 cap
            if (dottedLineManagerId && !candidates.some((c) => c.id === dottedLineManagerId)) {
                const dottedManager = await prisma.employee.findUnique({
                    where: { id: dottedLineManagerId, deletedAt: null },
                    include: {
                        assignments: {
                            where: { isPrimary: true, endDate: null, effectiveDate: { lte: new Date() } },
                            take: 1,
                            select: {
                                departmentId: true,
                                department: { select: { id: true, name: true, parentId: true } },
                                jobGradeId: true,
                                jobGrade: { select: { id: true, name: true, code: true, rankOrder: true } },
                            },
                        },
                    },
                })
                if (dottedManager) {
                    candidates.push(dottedManager)
                }
            }

            // In-memory scoring
            const now = new Date()
            const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)

            const scored = candidates
                .filter((c) => extractPrimaryAssignment(c.assignments))
                .map((c) => {
                    const ca = extractPrimaryAssignment(c.assignments)!
                    const sameDept = ca.departmentId === employeeAssignment.departmentId
                    const siblingDept = !sameDept && ca.department?.parentId === employeeAssignment.department?.parentId && employeeAssignment.department?.parentId != null
                    const gradeDiff = Math.abs((ca.jobGrade?.rankOrder ?? 0) - (employeeAssignment.jobGrade?.rankOrder ?? 0))
                    const tenureOk = c.hireDate ? c.hireDate <= sixMonthsAgo : false

                    const scoreBreakdown = {
                        sameDept: sameDept ? 30 : siblingDept ? 15 : 0,
                        gradeProximity: gradeDiff === 0 ? 20 : gradeDiff === 1 ? 10 : 0,
                        sameJobFamily: 0, // Settings-connected: job family matching score (default: 0, future enhancement)
                        tenure: tenureOk ? 10 : 0,
                    }

                    const relevanceScore = scoreBreakdown.sameDept + scoreBreakdown.gradeProximity +
                        scoreBreakdown.sameJobFamily + scoreBreakdown.tenure

                    // B-3f: Boost dotted line manager score
                    const isDottedLineManager = dottedLineManagerId === c.id

                    return {
                        employeeId: c.id,
                        name: c.name,
                        nameEn: c.nameEn,
                        department: ca.department?.name ?? '',
                        position: ca.jobGrade?.name ?? '',
                        relevanceScore,
                        scoreBreakdown,
                        isDottedLineManager,
                    }
                })
                .sort((a, b) => {
                    // B-3f: Dotted line managers always appear first
                    if (a.isDottedLineManager && !b.isDottedLineManager) return -1
                    if (!a.isDottedLineManager && b.isDottedLineManager) return 1
                    return b.relevanceScore - a.relevanceScore
                })
                .slice(0, 20)

            return apiSuccess({
                candidates: scored,
                alreadyNominated,
            })
        } catch (error) {
            throw handlePrismaError(error)
        }
    },
    perm(MODULE.PERFORMANCE, ACTION.VIEW),
)
