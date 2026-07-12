// ═══════════════════════════════════════════════════════════
// CTR HR Hub — PUT /api/v1/offboarding/instances/[id]/tasks/[taskId]/status
// Task status transition using shared state machine
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound, badRequest, forbidden } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { validateTaskTransition } from '@/lib/shared/task-state-machine'
import { getActiveTeamMemberIds, OFFBOARDING_TEAM_STATUSES } from '@/lib/employee/direct-reports'
import type { SessionUser } from '@/types'

const statusSchema = z.object({
    status: z.enum(['PENDING', 'IN_PROGRESS', 'DONE', 'BLOCKED', 'SKIPPED']),
    blockedReason: z.string().optional(),
    note: z.string().optional(),
})

export const PUT = withPermission(
    async (req: NextRequest, ctx, user: SessionUser) => {
        const params = await ctx.params
        const offboardingId = params.id
        const taskId = params.taskId

        const body = await req.json()
        const parsed = statusSchema.safeParse(body)
        if (!parsed.success) throw badRequest('잘못된 요청입니다.', { issues: parsed.error.issues })

        const { status: targetStatus, blockedReason, note } = parsed.data

        // Fetch task with offboarding and template task info
        // 테넌트 스코핑 = 부모 EmployeeOffboarding.companyId 직접 (scoped find → cross-tenant는 notFound).
        // 구 active-assignment 사후체크는 fail-open이었음(완료/전출자 = 활성발령 없음 → 가드 스킵) — 삭제.
        const task = await prisma.employeeOffboardingTask.findFirst({
            where: {
                id: taskId,
                employeeOffboardingId: offboardingId,
                ...(user.role !== ROLE.SUPER_ADMIN
                    ? { employeeOffboarding: { companyId: user.companyId } }
                    : {}),
            },
            include: {
                task: { select: { isRequired: true, title: true, assigneeType: true } },
                employeeOffboarding: { select: { status: true, employeeId: true } },
            },
        })

        if (!task) throw notFound('태스크를 찾을 수 없습니다.')

        // ⑥-C PR-2: VIEW 게이트 다운그레이드 — 실제 인가는 이 내부 가드가 load-bearing.
        // HR/SUPER 외에는 "직속부하의 오프보딩 + MANAGER형 태스크"만 상태 변경 가능
        // (block/unblock 포함 — HR/IT/FINANCE/EMPLOYEE형 태스크 통제권 미부여, Codex G1-3).
        const isHrOrSuper = user.role === ROLE.SUPER_ADMIN || user.role === ROLE.HR_ADMIN
        if (!isHrOrSuper) {
            const teamIds = await getActiveTeamMemberIds(user.employeeId, user.companyId, OFFBOARDING_TEAM_STATUSES)
            const isTeamManager = teamIds.includes(task.employeeOffboarding.employeeId)
            if (!isTeamManager || task.task.assigneeType !== 'MANAGER') {
                throw forbidden('직속부하 오프보딩의 매니저 담당 태스크만 처리할 수 있습니다.')
            }
        }

        // Validate offboarding is still active
        if (task.employeeOffboarding.status !== 'IN_PROGRESS') {
            throw badRequest('진행 중인 오프보딩만 태스크 상태를 변경할 수 있습니다.')
        }

        // Validate state transition
        const transition = validateTaskTransition({
            currentStatus: task.status,
            targetStatus,
            isRequired: task.task.isRequired,
            blockedReason,
        })

        if (!transition.allowed) {
            throw badRequest(transition.error ?? '유효하지 않은 상태 전환입니다.')
        }

        // Execute update in transaction
        const result = await prisma.$transaction(async (tx) => {
            const updateData: Record<string, unknown> = {
                status: targetStatus,
                note: note ?? task.note,
            }

            // Handle BLOCKED
            if (targetStatus === 'BLOCKED') {
                updateData.blockedReason = blockedReason
                updateData.blockedAt = new Date()
                updateData.unblockedAt = null
            }

            // Handle unblock (BLOCKED → PENDING or IN_PROGRESS)
            if (task.status === 'BLOCKED' && (targetStatus === 'PENDING' || targetStatus === 'IN_PROGRESS')) {
                updateData.unblockedAt = new Date()
            }

            // Handle DONE
            if (targetStatus === 'DONE') {
                updateData.completedById = user.employeeId
                updateData.completedAt = new Date()
            }

            const updated = await tx.employeeOffboardingTask.update({
                where: { id: taskId },
                data: updateData,
            })

            // Check if all required tasks are done → auto-complete offboarding
            // 🚨 SYNCHRONOUS inside transaction (no event emission here → no infinite loop)
            if (targetStatus === 'DONE') {
                const allTasks = await tx.employeeOffboardingTask.findMany({
                    where: { employeeOffboardingId: offboardingId },
                    include: { task: { select: { isRequired: true } } },
                })

                const requiredTasks = allTasks.filter((t) => t.task.isRequired)
                const allRequiredDone = requiredTasks.every((t) => t.status === 'DONE')

                if (allRequiredDone) {
                    // All required done — mark offboarding ready for sign-off (not auto-complete)
                    // Auto-completion requires explicit sign-off from HR
                    // Just flag it as ready
                    await tx.employeeOffboarding.update({
                        where: { id: offboardingId },
                        data: { isSeveranceCalculated: true }, // signal that completion check passed
                    })
                }
            }

            return updated
        })

        return apiSuccess({
            id: result.id,
            status: result.status,
            blockedReason: result.blockedReason,
            blockedAt: result.blockedAt,
            unblockedAt: result.unblockedAt,
            completedById: result.completedById,
            completedAt: result.completedAt,
        })
    },
    // ⑥-C PR-2: VIEW 게이트 — 실제 인가는 위 내부 가드(직속매니저 + MANAGER형 태스크)가 담당 (MANAGER는 approve 미보유)
    perm(MODULE.OFFBOARDING, ACTION.VIEW),
)
