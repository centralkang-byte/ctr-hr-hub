// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/offboarding/instances/[id]/complete
// 오프보딩 완료 처리 (게이팅 검증 + 정산 + 상태 전이)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { prisma } from '@/lib/prisma'
import { executeOffboardingCompletion } from '@/lib/offboarding/complete-offboarding'
import type { SessionUser } from '@/types'

export const POST = withPermission(
    async (req: NextRequest, ctx, user: SessionUser) => {
        const { id } = await ctx.params

        // Verify offboarding exists and is IN_PROGRESS
        const offboarding = await prisma.employeeOffboarding.findFirst({
            where: {
                id,
                ...(user.role !== ROLE.SUPER_ADMIN
                    ? { employee: { assignments: { some: { companyId: user.companyId, isPrimary: true, endDate: null } } } }
                    : {}),
            },
            select: { id: true, status: true, employeeId: true },
        })

        if (!offboarding) throw notFound('오프보딩 기록을 찾을 수 없습니다.')

        if (offboarding.status !== 'IN_PROGRESS') {
            throw badRequest(`현재 상태(${offboarding.status})에서는 완료 처리할 수 없습니다.`)
        }

        try {
            const result = await executeOffboardingCompletion(id)

            const { ip, userAgent } = extractRequestMeta(req.headers)
            logAudit({
                actorId: user.employeeId,
                action: 'offboarding.complete',
                resourceType: 'employee_offboarding',
                resourceId: id,
                companyId: user.companyId,
                changes: {
                    employeeId: offboarding.employeeId,
                    settlementCount: result.settlementItems.length,
                    assetDeductionCount: result.assetDeductions.length,
                },
                ip,
                userAgent,
            })

            return apiSuccess(result)
        } catch (error) {
            // 게이팅 실패는 badRequest로 반환 (사용자에게 구체적 에러 표시)
            if (error instanceof Error && (
                error.message.includes('미완료') ||
                error.message.includes('완료되지') ||
                error.message.includes('진행해주세요')
            )) {
                throw badRequest(error.message)
            }
            throw handlePrismaError(error)
        }
    },
    perm(MODULE.OFFBOARDING, ACTION.APPROVE),
)
