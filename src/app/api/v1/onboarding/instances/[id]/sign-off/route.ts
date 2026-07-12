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
import { getActiveTeamMemberIds } from '@/lib/employee/direct-reports'
import { checkSignOffEligibility, executeSignOff } from '@/lib/onboarding/sign-off'
import type { SessionUser } from '@/types'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'
import { resolveOnboardingCompanyId } from '@/lib/onboarding/tenant-guard'

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
        // ⑥-C Codex G2 P1: MANAGER 는 reportsTo 일치 + "현재 자사 primary 활성 발령" 직속부하일 때만 —
        // 목록 스코프(getActiveTeamMemberIds)와 동일 기준으로 통일 (비활성/전출 직원 by-id 접근 차단)
        const isManager =
            user.employeeId === managerId &&
            (user.role !== ROLE.MANAGER ||
                (await getActiveTeamMemberIds(user.employeeId ?? '', user.companyId)).includes(onboarding.employeeId))
        const isHrAdmin = user.role === ROLE.HR_ADMIN || user.role === ROLE.SUPER_ADMIN
        // 멀티테넌트: 비-SUPER는 동일 법인만 (HR/매니저 경로 법인 결합)
        const onboardingCompanyId = await resolveOnboardingCompanyId({ companyId: onboarding.companyId, employeeId: onboarding.employeeId })
        const sameCompany = onboardingCompanyId != null && onboardingCompanyId === user.companyId
        if (user.role !== ROLE.SUPER_ADMIN && (!sameCompany || (!isManager && !isHrAdmin))) throw forbidden('Only the direct manager or HR Admin can sign off')

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
    // ⑥-C: VIEW 게이트 — 실제 인가는 위 내부 가드(직속매니저/담당자 + 동일법인)가 담당 (MANAGER는 manage 미보유)
    perm(MODULE.ONBOARDING, ACTION.VIEW),
)
