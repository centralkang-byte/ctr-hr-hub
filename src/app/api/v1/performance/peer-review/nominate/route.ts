// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GP#4 Peer Review Nomination
// POST /api/v1/performance/peer-review/nominate
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, forbidden, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { eventBus, DOMAIN_EVENTS } from '@/lib/events'
import { isCurrentManagerOf } from '@/lib/performance/peer-access'
import type { SessionUser } from '@/types'

const nominateSchema = z.object({
    cycleId: z.string().uuid(),
    employeeId: z.string().uuid(),
    nomineeIds: z.array(z.string().uuid()).min(1).optional(),
    reviewerIds: z.array(z.string().uuid()).min(1).optional(),  // alias for nomineeIds
}).transform(({ reviewerIds, ...rest }) => ({
    ...rest,
    nomineeIds: rest.nomineeIds || reviewerIds || [],
}))

// ─── POST /api/v1/performance/peer-review/nominate ───────
// Manager-driven nomination (Design Decision #10)

export const POST = withPermission(
    async (req: NextRequest, _context, user: SessionUser) => {
        const body: unknown = await req.json()
        const parsed = nominateSchema.safeParse(body)
        if (!parsed.success) {
            throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
        }

        const { cycleId, employeeId, nomineeIds } = parsed.data

        if (!nomineeIds || nomineeIds.length === 0) {
            throw badRequest('nomineeIds 또는 reviewerIds가 필요합니다.')
        }

        try {
            // 1. Validate cycle
            const cycle = await prisma.performanceCycle.findFirst({
                where: { id: cycleId, companyId: user.companyId },
                select: {
                    id: true, companyId: true, status: true,
                    peerReviewEnabled: true, peerReviewMinCount: true, peerReviewMaxCount: true,
                },
            })

            if (!cycle) throw badRequest('사이클을 찾을 수 없습니다.')
            if (cycle.status !== 'EVAL_OPEN') throw badRequest('평가 실시(EVAL_OPEN) 단계에서만 동료평가 지정이 가능합니다.')
            if (!cycle.peerReviewEnabled) throw badRequest('이 사이클은 동료평가가 비활성화되어 있습니다.')

            // 2. Validate nominee count
            if (nomineeIds.length < cycle.peerReviewMinCount) {
                throw badRequest(`최소 ${cycle.peerReviewMinCount}명의 동료를 지정해야 합니다.`)
            }
            if (nomineeIds.length > cycle.peerReviewMaxCount) {
                throw badRequest(`최대 ${cycle.peerReviewMaxCount}명까지 지정할 수 있습니다.`)
            }

            // 3. Validate authority (현재 담당 매니저 or HR_ADMIN)
            // 과거 1:1 1건만으로 통과하던 stale 게이트를 활성 관계(현 보고라인 또는
            // 해당 cycle 1:1)로 한정 — 전임 매니저의 동료평가 지정(쓰기) 권한을 차단.
            const isHR = user.role === 'SUPER_ADMIN' || user.role === 'HR_ADMIN'
            if (!isHR) {
                const isManager = await isCurrentManagerOf(user.employeeId, employeeId, cycleId)
                if (!isManager) {
                    throw forbidden('해당 직원의 담당 매니저 또는 HR 관리자만 동료평가 대상을 지정할 수 있습니다.')
                }
            }

            // 4. Validate nominees
            if (nomineeIds.includes(employeeId)) {
                throw badRequest('본인을 동료평가자로 지정할 수 없습니다.')
            }
            if (nomineeIds.includes(user.employeeId)) {
                throw badRequest('직속 상사를 동료평가자로 지정할 수 없습니다.')
            }

            const activeNominees = await prisma.employee.findMany({
                where: { id: { in: nomineeIds }, deletedAt: null },
                select: { id: true },
            })

            if (activeNominees.length !== nomineeIds.length) {
                throw badRequest('일부 동료가 비활성 상태입니다. 활성 직원만 지정할 수 있습니다.')
            }

            // 5. Create nominations (upsert to handle re-nomination)
            const created: string[] = []
            const skipped: string[] = []

            for (const nomineeId of nomineeIds) {
                const existing = await prisma.peerReviewNomination.findUnique({
                    where: { cycleId_employeeId_nomineeId: { cycleId, employeeId, nomineeId } },
                })

                if (existing) {
                    skipped.push(nomineeId)
                    continue
                }

                await prisma.peerReviewNomination.create({
                    data: {
                        cycleId,
                        employeeId,
                        nomineeId,
                        nominationSource: 'MANAGER_ASSIGNED',
                        status: 'NOMINATION_APPROVED',
                        approvedById: user.employeeId,
                        approvedAt: new Date(),
                    },
                })
                created.push(nomineeId)
            }

            // 6. Fire event
            if (created.length > 0) {
                void eventBus.publish(DOMAIN_EVENTS.PEER_NOMINATION_COMPLETED, {
                    ctx: {
                        companyId: cycle.companyId,
                        actorId: user.employeeId,
                        occurredAt: new Date(),
                    },
                    cycleId,
                    employeeId,
                    companyId: cycle.companyId,
                    nomineeIds: created,
                    nomineeCount: created.length,
                })
            }

            const { ip, userAgent } = extractRequestMeta(req.headers)
            logAudit({
                actorId: user.employeeId,
                action: 'performance.peer-review.nominate',
                resourceType: 'peerReviewNomination',
                resourceId: cycleId,
                companyId: cycle.companyId,
                changes: { employeeId, created: created.length, skipped: skipped.length },
                ip,
                userAgent,
            })

            return apiSuccess({
                message: `${created.length}명의 동료평가자가 지정되었습니다.`,
                created: created.length,
                skipped: skipped.length,
                nomineeIds: created,
            })
        } catch (error) {
            throw handlePrismaError(error)
        }
    },
    perm(MODULE.PERFORMANCE, ACTION.UPDATE),
)
