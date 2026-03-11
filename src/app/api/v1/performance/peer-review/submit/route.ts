// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GP#4 Peer Review Submit
// POST /api/v1/performance/peer-review/submit
//
// GEMINI FIX #5: Handles reviewer resignation (INACTIVE reviewers
// excluded from totalReviewers count). HR can skip nominations.
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { eventBus, DOMAIN_EVENTS } from '@/lib/events'
import type { SessionUser } from '@/types'

const submitSchema = z.object({
    nominationId: z.string().uuid(),
    scoreChallenge: z.number().int().min(1).max(5),
    scoreTrust: z.number().int().min(1).max(5),
    scoreResponsibility: z.number().int().min(1).max(5),
    scoreRespect: z.number().int().min(1).max(5),
    commentChallenge: z.string().optional(),
    commentTrust: z.string().optional(),
    commentResponsibility: z.string().optional(),
    commentRespect: z.string().optional(),
    overallComment: z.string().min(1),
    status: z.enum(['DRAFT', 'SUBMITTED']).default('SUBMITTED'),
})

// ─── POST /api/v1/performance/peer-review/submit ─────────

export const POST = withPermission(
    async (req: NextRequest, _context, user: SessionUser) => {
        const body: unknown = await req.json()
        const parsed = submitSchema.safeParse(body)
        if (!parsed.success) {
            throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
        }

        const data = parsed.data

        try {
            // 1. Validate nomination
            const nomination = await prisma.peerReviewNomination.findUnique({
                where: { id: data.nominationId },
                select: {
                    id: true,
                    cycleId: true,
                    employeeId: true,
                    nomineeId: true,
                    status: true,
                    cycle: { select: { status: true, companyId: true } },
                    answer: { select: { id: true } },
                },
            })

            if (!nomination) throw badRequest('평가 지정 정보를 찾을 수 없습니다.')
            if (nomination.nomineeId !== user.employeeId) {
                throw badRequest('본인에게 지정된 동료평가만 제출할 수 있습니다.')
            }
            if (nomination.cycle.status !== 'EVAL_OPEN') {
                throw badRequest('평가 실시(EVAL_OPEN) 단계에서만 제출할 수 있습니다.')
            }

            // Check if already submitted (not draft)
            if (nomination.answer) {
                // Allow updating draft, reject re-submitting
                const existingAnswer = await prisma.peerReviewAnswer.findUnique({
                    where: { nominationId: data.nominationId },
                })
                // If existing is a submitted review flagged by nomination status, block
                if (existingAnswer && nomination.status === 'NOMINATION_COMPLETED') {
                    throw badRequest('이미 제출된 동료평가는 수정할 수 없습니다.')
                }
            }

            // Validate comment length for SUBMITTED
            if (data.status === 'SUBMITTED' && data.overallComment.length < 20) {
                throw badRequest('제출 시 전체 의견은 최소 20자 이상이어야 합니다.')
            }

            // 2. Upsert PeerReviewAnswer
            const answer = await prisma.peerReviewAnswer.upsert({
                where: { nominationId: data.nominationId },
                create: {
                    nominationId: data.nominationId,
                    scoreChallenge: data.scoreChallenge,
                    scoreTrust: data.scoreTrust,
                    scoreResponsibility: data.scoreResponsibility,
                    scoreRespect: data.scoreRespect,
                    commentChallenge: data.commentChallenge,
                    commentTrust: data.commentTrust,
                    commentResponsibility: data.commentResponsibility,
                    commentRespect: data.commentRespect,
                    overallComment: data.overallComment,
                },
                update: {
                    scoreChallenge: data.scoreChallenge,
                    scoreTrust: data.scoreTrust,
                    scoreResponsibility: data.scoreResponsibility,
                    scoreRespect: data.scoreRespect,
                    commentChallenge: data.commentChallenge,
                    commentTrust: data.commentTrust,
                    commentResponsibility: data.commentResponsibility,
                    commentRespect: data.commentRespect,
                    overallComment: data.overallComment,
                    submittedAt: new Date(),
                },
            })

            // 3. Update nomination status if SUBMITTED
            if (data.status === 'SUBMITTED') {
                await prisma.peerReviewNomination.update({
                    where: { id: data.nominationId },
                    data: { status: 'NOMINATION_COMPLETED' },
                })
            }

            // 4. Check if all peers are done (GEMINI FIX #5: only count ACTIVE reviewers)
            const [totalNominations, completedNominations] = await Promise.all([
                prisma.peerReviewNomination.count({
                    where: {
                        cycleId: nomination.cycleId,
                        employeeId: nomination.employeeId,
                        status: { in: ['NOMINATION_APPROVED', 'NOMINATION_COMPLETED'] },
                        nominee: { deletedAt: null },
                    },
                }),
                prisma.peerReviewNomination.count({
                    where: {
                        cycleId: nomination.cycleId,
                        employeeId: nomination.employeeId,
                        status: 'NOMINATION_COMPLETED',
                        nominee: { deletedAt: null },
                    },
                }),
            ])

            const allPeersDone = completedNominations >= totalNominations && totalNominations > 0

            // 5. Fire event
            if (data.status === 'SUBMITTED') {
                void eventBus.publish(DOMAIN_EVENTS.PEER_EVAL_SUBMITTED, {
                    ctx: {
                        companyId: nomination.cycle.companyId,
                        actorId: user.employeeId,
                        occurredAt: new Date(),
                    },
                    cycleId: nomination.cycleId,
                    nominationId: nomination.id,
                    reviewerId: user.employeeId,
                    employeeId: nomination.employeeId,
                    companyId: nomination.cycle.companyId,
                    allPeersDone,
                })
            }

            const { ip, userAgent } = extractRequestMeta(req.headers)
            logAudit({
                actorId: user.employeeId,
                action: 'performance.peer-review.submit',
                resourceType: 'peerReviewAnswer',
                resourceId: answer.id,
                companyId: nomination.cycle.companyId,
                changes: { nominationId: data.nominationId, status: data.status, allPeersDone },
                ip,
                userAgent,
            })

            return apiSuccess({
                id: answer.id,
                status: data.status,
                allPeersDone,
                message: data.status === 'SUBMITTED'
                    ? '동료평가가 제출되었습니다.'
                    : '임시 저장되었습니다.',
            })
        } catch (error) {
            throw handlePrismaError(error)
        }
    },
    perm(MODULE.PERFORMANCE, ACTION.CREATE),
)
