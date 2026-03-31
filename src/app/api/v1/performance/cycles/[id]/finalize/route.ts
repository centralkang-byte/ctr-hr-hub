// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Finalize Performance Cycle
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { eventBus } from '@/lib/events/event-bus'
import { DOMAIN_EVENTS } from '@/lib/events/types'
import { bootstrapEventHandlers } from '@/lib/events/bootstrap'
import type { SessionUser } from '@/types'
import { getNextStatus } from '@/lib/performance/pipeline'

bootstrapEventHandlers()

// ─── POST /api/v1/performance/cycles/[id]/finalize ───────
// Finalize cycle: CALIBRATION → next status (uses pipeline)

export const POST = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params

    const cycle = await prisma.performanceCycle.findFirst({
      where: { id, companyId: user.companyId },
    })
    if (!cycle) throw notFound('성과 주기를 찾을 수 없습니다.')
    if (cycle.status !== 'CALIBRATION') {
      throw badRequest('피플세션 단계에서만 확정할 수 있습니다.')
    }

    const nextStatus = getNextStatus('CALIBRATION', cycle.half)
    if (!nextStatus) {
      throw badRequest('다음 단계가 정의되지 않았습니다.')
    }

    // Check all calibration sessions are completed
    const pendingSessions = await prisma.calibrationSession.count({
      where: {
        cycleId: id,
        companyId: user.companyId,
        status: { not: 'CALIBRATION_COMPLETED' },
      },
    })

    if (pendingSessions > 0) {
      throw badRequest(`미완료 피플세션이 ${pendingSessions}건 있습니다.`)
    }

    const updated = await prisma.performanceCycle.update({
      where: { id },
      data: { status: nextStatus },
    })

    const { ip, userAgent } = extractRequestMeta(req.headers)
    logAudit({
      actorId: user.employeeId,
      action: 'performance.cycle.finalize',
      resourceType: 'performanceCycle',
      resourceId: id,
      companyId: user.companyId,
      changes: { previousStatus: 'CALIBRATION', newStatus: nextStatus },
      ip,
      userAgent,
    })

    // ── Fire-and-forget: PHASE_CHANGED + FINALIZED ────────────────────────
    const totalEvaluated = await prisma.performanceEvaluation.count({
      where: { cycleId: id, companyId: user.companyId, status: 'SUBMITTED' },
    })

    const finalCtx = {
      companyId:  user.companyId,
      actorId:    user.employeeId,
      occurredAt: new Date(),
    }

    void eventBus.publish(DOMAIN_EVENTS.PERFORMANCE_CYCLE_PHASE_CHANGED, {
      ctx:       finalCtx,
      cycleId:   updated.id,
      companyId: updated.companyId,
      fromPhase: 'CALIBRATION',
      toPhase:   nextStatus,
      cycleName: updated.name,
      year:      updated.year,
      half:      updated.half,
    })

    void eventBus.publish(DOMAIN_EVENTS.PERFORMANCE_CYCLE_FINALIZED, {
      ctx:            finalCtx,
      cycleId:        updated.id,
      companyId:      updated.companyId,
      cycleName:      updated.name,
      year:           updated.year,
      half:           updated.half,
      totalEvaluated,
    })

    return apiSuccess(updated)
  },
  perm(MODULE.PERFORMANCE, ACTION.APPROVE),
)
