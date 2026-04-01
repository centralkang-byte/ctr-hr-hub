// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Batch Goal Revision Propose
// Phase C: 여러 목표를 한 번에 수정 제안 (All-or-Nothing)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { eventBus } from '@/lib/events/event-bus'
import { DOMAIN_EVENTS } from '@/lib/events/types'
import { bootstrapEventHandlers } from '@/lib/events/bootstrap'
import type { SessionUser } from '@/types'
import type { GoalRevisionStatus } from '@/generated/prisma/client'

bootstrapEventHandlers()

const revisionItemSchema = z.object({
  goalId: z.string().uuid(),
  newTitle: z.string().min(1).max(200).optional(),
  newDescription: z.string().max(2000).optional(),
  newWeight: z.number().min(0).max(100).optional(),
  newTargetMetric: z.string().max(100).optional(),
  newTargetValue: z.string().max(100).optional(),
})

const batchSchema = z.object({
  revisions: z.array(revisionItemSchema).min(1).max(20),
  reason: z.string().min(1).max(2000),
  quarterlyReviewId: z.string().uuid().optional(),
})

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = batchSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { revisions: items, reason, quarterlyReviewId } = parsed.data
    const batchId = randomUUID()

    try {
      const results = await prisma.$transaction(async (tx) => {
        const created = []

        for (const item of items) {
          // Row Lock per goal
          const [lockedGoal] = await tx.$queryRaw<Array<{
            id: string; status: string; is_locked: boolean; employee_id: string;
            cycle_id: string; company_id: string; title: string; description: string | null;
            weight: Prisma.Decimal; target_metric: string | null; target_value: string | null;
          }>>`
            SELECT id, status, is_locked, employee_id, cycle_id, company_id,
                   title, description, weight, target_metric, target_value
            FROM mbo_goals WHERE id = ${item.goalId} FOR UPDATE
          `
          if (!lockedGoal) throw badRequest(`목표를 찾을 수 없습니다: ${item.goalId}`)
          if (lockedGoal.company_id !== user.companyId) throw badRequest(`목표를 찾을 수 없습니다: ${item.goalId}`)
          if (lockedGoal.employee_id !== user.employeeId) throw badRequest('본인의 목표만 수정 제안할 수 있습니다.')
          if (lockedGoal.status !== 'APPROVED') throw badRequest(`승인된 목표만 수정 제안할 수 있습니다: ${item.goalId}`)
          if (lockedGoal.is_locked) throw badRequest(`잠긴 목표는 수정할 수 없습니다: ${item.goalId}`)

          const existingPending = await tx.goalRevision.findFirst({
            where: { goalId: item.goalId, status: 'PENDING' as GoalRevisionStatus },
          })
          if (existingPending) throw badRequest(`이미 승인 대기 중인 수정 제안이 있습니다: ${item.goalId}`)

          const maxRevision = await tx.goalRevision.findFirst({
            where: { goalId: item.goalId },
            orderBy: { version: 'desc' },
            select: { version: true },
          })
          const nextVersion = (maxRevision?.version ?? 0) + 1

          const revision = await tx.goalRevision.create({
            data: {
              goalId: item.goalId,
              version: nextVersion,
              prevTitle: lockedGoal.title,
              prevDescription: lockedGoal.description,
              prevWeight: lockedGoal.weight,
              prevTargetMetric: lockedGoal.target_metric,
              prevTargetValue: lockedGoal.target_value,
              newTitle: item.newTitle ?? lockedGoal.title,
              newDescription: item.newDescription ?? lockedGoal.description,
              newWeight: item.newWeight ?? lockedGoal.weight,
              newTargetMetric: item.newTargetMetric ?? lockedGoal.target_metric,
              newTargetValue: item.newTargetValue ?? lockedGoal.target_value,
              reason,
              status: 'PENDING' as GoalRevisionStatus,
              proposedById: user.employeeId,
              quarterlyReviewId: quarterlyReviewId ?? null,
              batchId,
              companyId: lockedGoal.company_id,
            },
          })

          created.push({ revision, cycleId: lockedGoal.cycle_id })
        }

        return created
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'performance.goal.revision.batch-propose',
        resourceType: 'goalRevision',
        resourceId: batchId,
        companyId: user.companyId,
        changes: { batchId, count: results.length, reason },
        ip,
        userAgent,
      })

      // 이벤트 1건 (배치 전체)
      if (results.length > 0) {
        void eventBus.publish(DOMAIN_EVENTS.GOAL_REVISION_PROPOSED, {
          ctx: {
            companyId: user.companyId,
            actorId: user.employeeId,
            occurredAt: new Date(),
          },
          revisionId: results[0].revision.id,
          goalId: results[0].revision.goalId,
          employeeId: user.employeeId,
          managerId: '',
          companyId: user.companyId,
          cycleId: results[0].cycleId,
          version: results[0].revision.version,
          reason,
          batchId,
          quarterlyReviewId,
        })
      }

      return apiSuccess({
        batchId,
        count: results.length,
        revisions: results.map((r) => ({
          id: r.revision.id,
          goalId: r.revision.goalId,
          version: r.revision.version,
        })),
      })
    } catch (error) {
      if (error && typeof error === 'object' && 'statusCode' in error) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.PERFORMANCE, ACTION.CREATE),
)
