// ═══════════════════════════════════════════════════════════
// CTR HR Hub — PUT /api/v1/offboarding/instances/[id]/reschedule
// Reschedule offboarding: update lastWorkingDate + all task dueDates
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound, badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { rescheduleOffboarding } from '@/lib/offboarding/reschedule-offboarding'
import type { SessionUser } from '@/types'

const rescheduleSchema = z.object({
    newLastWorkingDate: z.string().datetime(),
    reason: z.string().min(1, '사유를 입력해주세요.'),
})

export const PUT = withPermission(
    async (req: NextRequest, ctx, user: SessionUser) => {
        const { id } = await ctx.params

        const body = await req.json()
        const parsed = rescheduleSchema.safeParse(body)
        if (!parsed.success) throw badRequest('잘못된 요청입니다.', { issues: parsed.error.issues })

        const { newLastWorkingDate, reason } = parsed.data
        const newDate = new Date(newLastWorkingDate)

        // Validate: new date must be in the future
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        if (newDate < today) {
            throw badRequest('새 퇴직일은 오늘 이후여야 합니다.')
        }

        // Find offboarding
        const offboarding = await prisma.employeeOffboarding.findFirst({
            where: {
                id,
                ...(user.role !== ROLE.SUPER_ADMIN
                    ? { employee: { assignments: { some: { companyId: user.companyId, isPrimary: true, endDate: null } } } }
                    : {}),
            },
        })
        if (!offboarding) throw notFound('오프보딩 기록을 찾을 수 없습니다.')

        // Validate: must be IN_PROGRESS
        if (offboarding.status !== 'IN_PROGRESS') {
            throw badRequest('진행 중인 오프보딩만 일정을 변경할 수 있습니다.')
        }

        // Execute reschedule
        await rescheduleOffboarding(id, newDate, reason, user.employeeId)

        // Return updated offboarding
        const updated = await prisma.employeeOffboarding.findUnique({
            where: { id },
            include: {
                offboardingTasks: {
                    include: { task: { select: { title: true, dueDaysBefore: true } } },
                    orderBy: { dueDate: 'asc' },
                },
            },
        })

        return apiSuccess({
            id: updated!.id,
            lastWorkingDate: updated!.lastWorkingDate,
            tasks: updated!.offboardingTasks.map((t) => ({
                id: t.id,
                title: t.task.title,
                dueDate: t.dueDate,
                dueDaysBefore: t.task.dueDaysBefore,
                status: t.status,
            })),
        })
    },
    perm(MODULE.OFFBOARDING, ACTION.APPROVE),
)
