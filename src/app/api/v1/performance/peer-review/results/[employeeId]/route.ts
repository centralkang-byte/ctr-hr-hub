// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GP#4 Peer Review Results
// GET /api/v1/performance/peer-review/results/:employeeId
//
// Semi-anonymous: Manager sees names, Employee sees "평가자 1/2/3"
// GEMINI FIX #1: Employee cannot see partial results during EVAL_OPEN
// GEMINI FIX #3: Deterministic shuffle prevents reviewer identification
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { determineViewerRole, maskPeerReviews } from '@/lib/performance/data-masking'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'
import type { SessionUser } from '@/types'

const querySchema = z.object({
    cycleId: z.string().uuid(),
})

// ─── GET /api/v1/performance/peer-review/results/:employeeId

export const GET = withPermission(
    async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
        const { employeeId } = await context.params
        const params = Object.fromEntries(req.nextUrl.searchParams.entries())
        const parsed = querySchema.safeParse(params)
        if (!parsed.success) {
            throw badRequest('cycleId 파라미터가 필요합니다.', { issues: parsed.error.issues })
        }

        const { cycleId } = parsed.data

        try {
            const cycle = await prisma.performanceCycle.findFirst({
                where: { id: cycleId, companyId: user.companyId },
                select: { id: true, status: true, companyId: true },
            })

            if (!cycle) throw badRequest('사이클을 찾을 수 없습니다.')

            // Determine viewer role
            const isManager = await prisma.oneOnOne.findFirst({
                where: { managerId: user.employeeId, employeeId },
                select: { id: true },
            })

            const viewerRole = determineViewerRole(
                user.employeeId,
                employeeId,
                user.role,
                !!isManager,
            )

            // GEMINI FIX #1: Anti-Deduction Attack prevention
            // Employee cannot see partial results during EVAL_OPEN
            const totalNominations = await prisma.peerReviewNomination.count({
                where: {
                    cycleId, employeeId,
                    status: { in: ['NOMINATION_APPROVED', 'NOMINATION_COMPLETED'] },
                    nominee: { deletedAt: null },
                },
            })
            const completedNominations = await prisma.peerReviewNomination.count({
                where: {
                    cycleId, employeeId,
                    status: 'NOMINATION_COMPLETED',
                    nominee: { deletedAt: null },
                },
            })

            if (
                viewerRole === 'EMPLOYEE' &&
                cycle.status === 'EVAL_OPEN' &&
                completedNominations < totalNominations
            ) {
                throw badRequest('동료 평가가 진행 중입니다. 모든 평가 완료 후 확인하실 수 있습니다.')
            }

            // Fetch answers
            const nominations = await prisma.peerReviewNomination.findMany({
                where: {
                    cycleId, employeeId,
                    status: 'NOMINATION_COMPLETED',
                    nominee: { deletedAt: null },
                },
                select: {
                    answer: {
                        select: {
                            scoreChallenge: true,
                            scoreTrust: true,
                            scoreResponsibility: true,
                            scoreRespect: true,
                            commentChallenge: true,
                            commentTrust: true,
                            commentResponsibility: true,
                            commentRespect: true,
                            overallComment: true,
                            submittedAt: true,
                        },
                    },
                    nominee: {
                        select: {
                            name: true,
                            nameEn: true,
                            assignments: {
                                where: { isPrimary: true, endDate: null },
                                take: 1,
                                select: { department: { select: { name: true } } },
                            },
                        },
                    },
                },
            })

            const rawReviews = nominations
                .filter((n) => n.answer)
                .map((n) => ({
                    reviewerName: n.nominee.name,
                    reviewerDepartment: extractPrimaryAssignment(n.nominee.assignments)?.department?.name ?? '',
                    scoreChallenge: n.answer!.scoreChallenge,
                    scoreTrust: n.answer!.scoreTrust,
                    scoreResponsibility: n.answer!.scoreResponsibility,
                    scoreRespect: n.answer!.scoreRespect,
                    overallComment: n.answer!.overallComment,
                    submittedAt: n.answer!.submittedAt,
                }))

            // Calculate summary
            const count = rawReviews.length
            const summary = {
                averageChallenge: count > 0 ? rawReviews.reduce((s, r) => s + r.scoreChallenge, 0) / count : 0,
                averageTrust: count > 0 ? rawReviews.reduce((s, r) => s + r.scoreTrust, 0) / count : 0,
                averageResponsibility: count > 0 ? rawReviews.reduce((s, r) => s + r.scoreResponsibility, 0) / count : 0,
                averageRespect: count > 0 ? rawReviews.reduce((s, r) => s + r.scoreRespect, 0) / count : 0,
                overallAverage: 0,
                totalReviewers: totalNominations,
                completedReviewers: completedNominations,
            }
            summary.overallAverage = (summary.averageChallenge + summary.averageTrust +
                summary.averageResponsibility + summary.averageRespect) / 4

            // Round to 1 decimal
            summary.averageChallenge = Math.round(summary.averageChallenge * 10) / 10
            summary.averageTrust = Math.round(summary.averageTrust * 10) / 10
            summary.averageResponsibility = Math.round(summary.averageResponsibility * 10) / 10
            summary.averageRespect = Math.round(summary.averageRespect * 10) / 10
            summary.overallAverage = Math.round(summary.overallAverage * 10) / 10

            // Apply data masking (GEMINI FIX #3: deterministic shuffle for employee)
            const maskedReviews = maskPeerReviews(rawReviews, viewerRole, cycleId, employeeId)

            return apiSuccess({ summary, reviews: maskedReviews })
        } catch (error) {
            throw handlePrismaError(error)
        }
    },
    perm(MODULE.PERFORMANCE, ACTION.VIEW),
)
