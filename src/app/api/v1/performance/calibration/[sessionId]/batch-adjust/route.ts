// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Calibration Batch Adjust
// POST /api/v1/performance/calibration/:sessionId/batch-adjust
//
// 다수 직원의 EMS 블록을 한 번에 이동하는 배치 조정 API
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { eventBus, DOMAIN_EVENTS } from '@/lib/events'
import type { SessionUser } from '@/types'

// ─── Schema ──────────────────────────────────────────────────

const adjustmentItemSchema = z.object({
  employeeId: z.string().uuid(),
  fromBlock: z.string().min(1),
  toBlock: z.string().min(1),
  reason: z.string().optional(),
})

const batchAdjustSchema = z.object({
  adjustments: z.array(adjustmentItemSchema).min(1).max(100),
  sharedReason: z.string().min(10, '조정 사유는 최소 10자 이상이어야 합니다.'),
})

// ─── POST ────────────────────────────────────────────────────

export const POST = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { sessionId } = await context.params
    const body: unknown = await req.json()
    const parsed = batchAdjustSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { adjustments, sharedReason } = parsed.data

    try {
      // 1. 세션 검증
      const session = await prisma.calibrationSession.findFirst({
        where: { id: sessionId, companyId: user.companyId },
        select: {
          id: true, cycleId: true, companyId: true, status: true,
          cycle: { select: { status: true } },
        },
      })

      if (!session) throw notFound('캘리브레이션 세션을 찾을 수 없습니다.')
      if (session.cycle.status !== 'CALIBRATION') {
        throw badRequest('캘리브레이션(CALIBRATION) 단계에서만 조정이 가능합니다.')
      }
      if (session.status === 'CALIBRATION_COMPLETED') {
        throw badRequest('이미 완료된 세션입니다.')
      }

      // 2. 대상 직원 평가 일괄 조회
      const employeeIds = adjustments.map((a) => a.employeeId)
      const evaluations = await prisma.performanceEvaluation.findMany({
        where: {
          cycleId: session.cycleId,
          employeeId: { in: employeeIds },
          evalType: 'MANAGER',
        },
        select: { id: true, employeeId: true, emsBlock: true },
      })

      const evalMap = new Map(evaluations.map((e) => [e.employeeId, e]))

      // 3. 트랜잭션: 일괄 조정
      const batchId = crypto.randomUUID()
      const results: { employeeId: string; status: 'success' | 'failed'; error?: string }[] = []

      await prisma.$transaction(async (tx) => {
        for (const adj of adjustments) {
          const evaluation = evalMap.get(adj.employeeId)
          if (!evaluation) {
            results.push({ employeeId: adj.employeeId, status: 'failed', error: '평가 데이터 없음' })
            continue
          }

          // CalibrationAdjustment 생성
          await tx.calibrationAdjustment.create({
            data: {
              sessionId,
              employeeId: adj.employeeId,
              evaluatorId: user.employeeId,
              originalPerformanceScore: 0,
              originalCompetencyScore: 0,
              originalBlock: adj.fromBlock,
              adjustedPerformanceScore: 0,
              adjustedCompetencyScore: 0,
              adjustedBlock: adj.toBlock,
              reason: adj.reason || sharedReason,
              adjustedBy: user.employeeId,
              adjustedAt: new Date(),
            },
          })

          // PerformanceEvaluation emsBlock 업데이트
          await tx.performanceEvaluation.update({
            where: { id: evaluation.id },
            data: { emsBlock: adj.toBlock },
          })

          results.push({ employeeId: adj.employeeId, status: 'success' })
        }
      })

      // 4. 도메인 이벤트
      for (const adj of adjustments) {
        if (results.find((r) => r.employeeId === adj.employeeId)?.status === 'success') {
          void eventBus.publish(DOMAIN_EVENTS.CALIBRATION_ADJUSTED, {
            ctx: {
              companyId: session.companyId,
              actorId: user.employeeId,
              occurredAt: new Date(),
            },
            cycleId: session.cycleId,
            employeeId: adj.employeeId,
            companyId: session.companyId,
            originalGrade: adj.fromBlock,
            adjustedGrade: adj.toBlock,
            reason: adj.reason || sharedReason,
            batchId,
          })
        }
      }

      // 5. 감사 로그
      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'performance.calibration.batch-adjust',
        resourceType: 'calibrationSession',
        resourceId: sessionId,
        companyId: session.companyId,
        changes: {
          batchId,
          totalCount: adjustments.length,
          adjustments: adjustments.map((a) => ({
            employeeId: a.employeeId,
            from: a.fromBlock,
            to: a.toBlock,
          })),
          sharedReason,
        },
        ip,
        userAgent,
      })

      const succeeded = results.filter((r) => r.status === 'success').length
      const failed = results.filter((r) => r.status === 'failed').length

      return apiSuccess({
        batchId,
        totalProcessed: adjustments.length,
        succeeded,
        failed,
        results,
      })
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.PERFORMANCE, ACTION.APPROVE),
)
