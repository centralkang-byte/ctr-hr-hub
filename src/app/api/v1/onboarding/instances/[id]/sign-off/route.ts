// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/onboarding/instances/[id]/sign-off
// Manager sign-off for onboarding completion
// E-1: GP#2 Onboarding Pipeline
// ═══════════════════════════════════════════════════════════

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, forbidden } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { checkSignOffEligibility, executeSignOff } from '@/lib/onboarding/sign-off'
import type { SessionUser } from '@/types'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'

const signOffSchema = z.object({
    note: z.string().optional(),
})

export const POST = withPermission(
    async (req, ctx, user: SessionUser) => {
        const { id: onboardingId } = await ctx.params
        const body = await req.json().catch(() => ({}))
        const parsed = signOffSchema.safeParse(body)
        if (!parsed.success) throw badRequest(parsed.error.issues.map((e) => e.message).join(', '))

        const onboarding = await prisma.employeeOnboarding.findUnique({
            where: { id: onboardingId },
            include: {
                employee: {
                    select: {
                        assignments: {
                            where: { isPrimary: true, endDate: null },
                            select: {
                                position: {
                                    select: {
                                        reportsTo: {
                                            select: {
                                                assignments: {
                                                    where: { isPrimary: true, endDate: null },
                                                    select: { employeeId: true },
                                                    take: 1,
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                            take: 1,
                        },
                    },
                },
            },
        })

        if (!onboarding) throw notFound('Onboarding instance not found')

        const empPrimary = extractPrimaryAssignment(onboarding.employee?.assignments ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mgrPrimary = extractPrimaryAssignment((empPrimary as any)?.position?.reportsTo?.assignments ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const managerId = (mgrPrimary as any)?.employeeId
        const isManager = user.employeeId === managerId
        const isHrAdmin = user.role === ROLE.HR_ADMIN || user.role === ROLE.SUPER_ADMIN
        if (!isManager && !isHrAdmin) throw forbidden('Only the direct manager or HR Admin can sign off')

        const eligibility = await checkSignOffEligibility(onboardingId)
        if (!eligibility.eligible) {
            throw badRequest(`Sign-off not eligible: ${eligibility.reason}`)
        }

        await executeSignOff(onboardingId, user.employeeId ?? '', parsed.data.note)

        const updated = await prisma.employeeOnboarding.findUnique({
            where: { id: onboardingId },
            include: {
                signer: { select: { id: true, name: true } },
            },
        })

        return apiSuccess({
            id: updated?.id,
            status: updated?.status,
            signOffBy: updated?.signer,
            signOffAt: updated?.signOffAt,
            signOffNote: updated?.signOffNote,
            message: '온보딩이 성공적으로 완료되었습니다.',
        })
    },
    perm(MODULE.ONBOARDING, ACTION.APPROVE),
)
