// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Goal Revision List & Propose
// Phase C: APPROVED 목표의 수정 이력 조회 + 수정 제안
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { eventBus } from '@/lib/events/event-bus'
import { DOMAIN_EVENTS } from '@/lib/events/types'
import { bootstrapEventHandlers } from '@/lib/events/bootstrap'
import type { SessionUser } from '@/types'
import type { GoalRevisionStatus } from '@/generated/prisma/client'

bootstrapEventHandlers()

// ─── Schemas ──────────────────────────────────────────────

const proposeSchema = z.object({
  newTitle: z.string().min(1).max(200).optional(),
  newDescription: z.string().max(2000).optional(),
  newWeight: z.number().min(0).max(100).optional(),
  newTargetMetric: z.string().max(100).optional(),
  newTargetValue: z.string().max(100).optional(),
  reason: z.string().min(1).max(2000),
  quarterlyReviewId: z.string().uuid().optional(),
}).refine(
  (data) => {
    const { reason: _reason, quarterlyReviewId: _quarterlyReviewId, ...changes } = data
    return Object.values(changes).some((v) => v !== undefined)
  },
  { message: '최소 하나의 필드를 변경해야 합니다.' },
)

// ─── GET /api/v1/performance/goals/:id/revisions ─────────
// 목표의 수정 이력 조회

export const GET = withPermission(
  async (_req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params

    const goal = await prisma.mboGoal.findFirst({
      where: { id, companyId: user.companyId },
      select: { id: true, employeeId: true },
    })
    if (!goal) throw notFound('해당 목표를 찾을 수 없습니다.')

    const revisions = await prisma.goalRevision.findMany({
      where: { goalId: id },
      orderBy: { version: 'desc' },
      include: {
        proposedBy: { select: { id: true, name: true, employeeNo: true } },
        reviewedBy: { select: { id: true, name: true, employeeNo: true } },
      },
    })

    return apiSuccess(
      revisions.map((r) => ({
        ...r,
        prevWeight: Number(r.prevWeight),
        newWeight: Number(r.newWeight),
      })),
    )
  },
  perm(MODULE.PERFORMANCE, ACTION.VIEW),
)

// ─── POST /api/v1/performance/goals/:id/revisions ────────
// 직원이 APPROVED 목표의 수정 제안

export const POST = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params
    const body: unknown = await req.json()
    const parsed = proposeSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Row Lock: race condition 방지
        const [lockedGoal] = await tx.$queryRaw<Array<{
          id: string; status: string; is_locked: boolean; employee_id: string;
          cycle_id: string; company_id: string; title: string; description: string | null;
          weight: Prisma.Decimal; target_metric: string | null; target_value: string | null;
        }>>`
          SELECT id, status, is_locked, employee_id, cycle_id, company_id,
                 title, description, weight, target_metric, target_value
          FROM mbo_goals WHERE id = ${id} FOR UPDATE
        `
        if (!lockedGoal) throw notFound('해당 목표를 찾을 수 없습니다.')
        if (lockedGoal.company_id !== user.companyId) throw notFound('해당 목표를 찾을 수 없습니다.')
        if (lockedGoal.employee_id !== user.employeeId) throw badRequest('본인의 목표만 수정 제안할 수 있습니다.')
        if (lockedGoal.status !== 'APPROVED') throw badRequest('승인된 목표만 수정 제안할 수 있습니다.')
        if (lockedGoal.is_locked) throw badRequest('잠긴 목표는 수정할 수 없습니다.')

        // PENDING 중복 검증
        const existingPending = await tx.goalRevision.findFirst({
          where: { goalId: id, status: 'PENDING' as GoalRevisionStatus },
        })
        if (existingPending) throw badRequest('이미 승인 대기 중인 수정 제안이 있습니다. 기존 제안을 취소한 후 다시 시도해주세요.')

        // Version 채번 (락 보유 상태)
        const maxRevision = await tx.goalRevision.findFirst({
          where: { goalId: id },
          orderBy: { version: 'desc' },
          select: { version: true },
        })
        const nextVersion = (maxRevision?.version ?? 0) + 1

        const { reason, quarterlyReviewId, ...changes } = parsed.data

        const revision = await tx.goalRevision.create({
          data: {
            goalId: id,
            version: nextVersion,
            prevTitle: lockedGoal.title,
            prevDescription: lockedGoal.description,
            prevWeight: lockedGoal.weight,
            prevTargetMetric: lockedGoal.target_metric,
            prevTargetValue: lockedGoal.target_value,
            newTitle: changes.newTitle ?? lockedGoal.title,
            newDescription: changes.newDescription ?? lockedGoal.description,
            newWeight: changes.newWeight ?? lockedGoal.weight,
            newTargetMetric: changes.newTargetMetric ?? lockedGoal.target_metric,
            newTargetValue: changes.newTargetValue ?? lockedGoal.target_value,
            reason,
            status: 'PENDING' as GoalRevisionStatus,
            proposedById: user.employeeId,
            quarterlyReviewId: quarterlyReviewId ?? null,
            companyId: lockedGoal.company_id,
          },
          include: {
            proposedBy: { select: { id: true, name: true } },
          },
        })

        return { revision, lockedGoal }
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'performance.goal.revision.propose',
        resourceType: 'goalRevision',
        resourceId: result.revision.id,
        companyId: result.revision.companyId,
        changes: parsed.data,
        ip,
        userAgent,
      })

      // 매니저 알림
      void eventBus.publish(DOMAIN_EVENTS.GOAL_REVISION_PROPOSED, {
        ctx: {
          companyId: result.revision.companyId,
          actorId: user.employeeId,
          occurredAt: new Date(),
        },
        revisionId: result.revision.id,
        goalId: id,
        employeeId: user.employeeId,
        managerId: '', // resolved in handler
        companyId: result.revision.companyId,
        cycleId: result.lockedGoal.cycle_id,
        version: result.revision.version,
        reason: parsed.data.reason,
        quarterlyReviewId: parsed.data.quarterlyReviewId,
      })

      return apiSuccess({
        ...result.revision,
        prevWeight: Number(result.revision.prevWeight),
        newWeight: Number(result.revision.newWeight),
      })
    } catch (error) {
      if (error && typeof error === 'object' && 'statusCode' in error) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.PERFORMANCE, ACTION.CREATE),
)
