// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/offboarding/instances/[id]
// Single offboarding detail with tasks, assets, exit interview
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { notFound, forbidden, badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { getActiveTeamMemberIds, OFFBOARDING_TEAM_STATUSES } from '@/lib/employee/direct-reports'
import type { SessionUser } from '@/types'
import { extractPrimaryAssignment } from '@/lib/employee/assignment-helpers'

export const GET = withPermission(
    async (_req: NextRequest, ctx, user: SessionUser) => {
        const { id } = await ctx.params

        // 테넌트 스코핑 = EmployeeOffboarding.companyId 직접 (active-assignment 조인은 완료 시 탈락 → 상세 404 버그)
        const offboarding = await prisma.employeeOffboarding.findFirst({
            where: {
                id,
                ...(user.role !== ROLE.SUPER_ADMIN ? { companyId: user.companyId } : {}),
            },
            include: {
                employee: {
                    select: {
                        id: true,
                        name: true,
                        hireDate: true,
                        // 표시용 = 최신 primary assignment (endDate 무관 — 완료 퇴사도 회사·부서 렌더)
                        assignments: {
                            where: { isPrimary: true },
                            orderBy: { effectiveDate: 'desc' },
                            take: 1,
                            include: {
                                department: { select: { id: true, name: true } },
                                position: { select: { titleKo: true } },
                                company: { select: { name: true, code: true, countryCode: true } },
                            },
                        },
                    },
                },
                handoverTo: { select: { id: true, name: true } },
                offboardingTasks: {
                    include: {
                        task: {
                            select: {
                                id: true,
                                title: true,
                                description: true,
                                assigneeType: true,
                                dueDaysBefore: true,
                                isRequired: true,
                                sortOrder: true,
                            },
                        },
                        assignee: { select: { id: true, name: true } },
                        completer: { select: { id: true, name: true } },
                    },
                    orderBy: { dueDate: 'asc' },
                },
                assetReturns: true,
                checklist: { select: { id: true, name: true } },
            },
        })

        if (!offboarding) throw notFound('오프보딩 기록을 찾을 수 없습니다.')

        // ─── Access control ───────────────────────────────
        const isOwnOffboarding = user.employeeId === offboarding.employeeId
        const isHrOrSuperAdmin = user.role === ROLE.SUPER_ADMIN || user.role === 'HR_ADMIN'
        // ⑥-C PR-2: 매니저 판정을 목록/대시보드와 동일한 active-team 스코프로 통일 (PR-1 G2-③ 미러).
        // isDirectManager는 endDate:null 전제라 통보기간 endDate=LWD 선기입 케이스를 놓침.
        const isManager = !isOwnOffboarding && !isHrOrSuperAdmin
            ? (await getActiveTeamMemberIds(user.employeeId, user.companyId, OFFBOARDING_TEAM_STATUSES))
                .includes(offboarding.employeeId)
            : false

        if (!isOwnOffboarding && !isHrOrSuperAdmin && !isManager) {
            throw forbidden('이 오프보딩 정보에 접근할 권한이 없습니다.')
        }

        // ─── Exit interview (isolation enforced) ──────────
        let exitInterview = null
        if (isHrOrSuperAdmin) {
            // Only HR_ADMIN and SUPER_ADMIN can see exit interview data
            exitInterview = await prisma.exitInterview.findFirst({
                where: { employeeOffboardingId: id },
                include: { interviewer: { select: { id: true, name: true } } },
            })
        }

        // ─── Enrich with computed fields ──────────────────
        const now = Date.now()
        const daysRemaining = Math.ceil(
            (new Date(offboarding.lastWorkingDate).getTime() - now) / 86_400_000,
        )

        const totalTasks = offboarding.offboardingTasks.length
        const doneTasks = offboarding.offboardingTasks.filter((t) => t.status === 'DONE').length
        const blockedTasks = offboarding.offboardingTasks.filter((t) => t.status === 'BLOCKED').length
        const inProgressTasks = offboarding.offboardingTasks.filter((t) => t.status === 'IN_PROGRESS').length
        const pendingTasks = offboarding.offboardingTasks.filter((t) => t.status === 'PENDING').length

        const assignment = extractPrimaryAssignment(offboarding.employee?.assignments ?? [])

        return apiSuccess({
            id: offboarding.id,
            employeeId: offboarding.employeeId,
            employeeName: offboarding.employee?.name ?? '—',
            hireDate: offboarding.employee?.hireDate,
            department: assignment?.department?.name ?? '—',
            departmentId: assignment?.department?.id,
            position: assignment?.position?.titleKo ?? '—',
            company: assignment?.company?.name ?? '—',
            companyCode: assignment?.company?.code ?? '—',
            countryCode: assignment?.company?.countryCode ?? 'KR',
            resignType: offboarding.resignType,
            // ⑥-C PR-2: 사유 상세·재고용 불가는 HR 전용 (매니저/본인 뷰 마스킹)
            resignReasonCode: isHrOrSuperAdmin ? offboarding.resignReasonCode : null,
            resignReasonDetail: isHrOrSuperAdmin ? offboarding.resignReasonDetail : null,
            lastWorkingDate: offboarding.lastWorkingDate,
            daysRemaining,
            status: offboarding.status,
            handoverTo: offboarding.handoverTo,
            handoverToId: offboarding.handoverToId,
            checklistName: offboarding.checklist?.name,
            progress: {
                done: doneTasks,
                total: totalTasks,
                blocked: blockedTasks,
                inProgress: inProgressTasks,
                pending: pendingTasks,
                percentage: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
            },
            tasks: offboarding.offboardingTasks.map((t) => ({
                id: t.id,
                taskId: t.taskId,
                title: t.task.title,
                description: t.task.description,
                assigneeType: t.task.assigneeType,
                dueDaysBefore: t.task.dueDaysBefore,
                isRequired: t.task.isRequired,
                sortOrder: t.task.sortOrder,
                status: t.status,
                dueDate: t.dueDate,
                assignee: t.assignee,
                completedById: t.completer,
                completedAt: t.completedAt,
                blockedReason: t.blockedReason,
                blockedAt: t.blockedAt,
                note: t.note,
            })),
            assetReturns: offboarding.assetReturns,
            exitInterview,
            isExitInterviewCompleted: offboarding.isExitInterviewCompleted,
            isSeveranceCalculated: offboarding.isSeveranceCalculated,
            isItAccountDeactivated: offboarding.isItAccountDeactivated,
            isDoNotRehire: isHrOrSuperAdmin ? offboarding.isDoNotRehire : null,
            doNotRehireReason: isHrOrSuperAdmin ? offboarding.doNotRehireReason : null,
            startedAt: offboarding.startedAt,
            completedAt: offboarding.completedAt,
        })
    },
    perm(MODULE.OFFBOARDING, ACTION.VIEW),
)

// ─── PATCH Schema ────────────────────────────────────────

const patchSchema = z.object({
    isItAccountDeactivated: z.boolean().optional(),
    isExitInterviewCompleted: z.boolean().optional(),
    handoverToId: z.string().uuid().nullable().optional(),
    isDoNotRehire: z.boolean().optional(),
    doNotRehireReason: z.string().nullable().optional(),
}).refine(
    (data) => Object.keys(data).length > 0,
    { message: '변경할 필드를 하나 이상 입력해주세요.' },
)

// ─── PATCH /api/v1/offboarding/instances/[id] ────────────
// 게이팅 플래그 토글 + 인수자 변경 + do-not-rehire 설정

export const PATCH = withPermission(
    async (req: NextRequest, ctx, user: SessionUser) => {
        const { id } = await ctx.params

        const existing = await prisma.employeeOffboarding.findFirst({
            where: {
                id,
                ...(user.role !== ROLE.SUPER_ADMIN ? { companyId: user.companyId } : {}),
            },
            select: { id: true, status: true, employeeId: true },
        })

        if (!existing) throw notFound('오프보딩 기록을 찾을 수 없습니다.')

        if (existing.status !== 'IN_PROGRESS') {
            throw badRequest(`현재 상태(${existing.status})에서는 수정할 수 없습니다.`)
        }

        const body: unknown = await req.json()
        const parsed = patchSchema.safeParse(body)
        if (!parsed.success) {
            throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
        }

        const data: Record<string, unknown> = {}

        if (parsed.data.isItAccountDeactivated !== undefined) {
            data.isItAccountDeactivated = parsed.data.isItAccountDeactivated
        }
        if (parsed.data.isExitInterviewCompleted !== undefined) {
            data.isExitInterviewCompleted = parsed.data.isExitInterviewCompleted
        }
        if (parsed.data.handoverToId !== undefined) {
            data.handoverToId = parsed.data.handoverToId
        }
        if (parsed.data.isDoNotRehire !== undefined) {
            data.isDoNotRehire = parsed.data.isDoNotRehire
            data.doNotRehireReason = parsed.data.doNotRehireReason ?? null
            data.doNotRehireSetById = parsed.data.isDoNotRehire ? user.employeeId : null
        }

        try {
            const updated = await prisma.employeeOffboarding.update({
                where: { id },
                data,
                select: {
                    id: true,
                    isItAccountDeactivated: true,
                    isExitInterviewCompleted: true,
                    handoverToId: true,
                    isDoNotRehire: true,
                    doNotRehireReason: true,
                },
            })

            const { ip, userAgent } = extractRequestMeta(req.headers)
            logAudit({
                actorId: user.employeeId,
                action: 'offboarding.update_flags',
                resourceType: 'employee_offboarding',
                resourceId: id,
                companyId: user.companyId,
                changes: parsed.data,
                ip,
                userAgent,
            })

            return apiSuccess(updated)
        } catch (error) {
            throw handlePrismaError(error)
        }
    },
    perm(MODULE.OFFBOARDING, ACTION.UPDATE),
)
