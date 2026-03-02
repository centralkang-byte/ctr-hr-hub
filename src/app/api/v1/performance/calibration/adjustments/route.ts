// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Calibration Adjustments
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError, notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { calculateEmsBlock, DEFAULT_BLOCK_DEFINITIONS } from '@/lib/ems'
import type { SessionUser } from '@/types'

// ─── Schema ──────────────────────────────────────────────

const createSchema = z.object({
  sessionId: z.string(),
  employeeId: z.string(),
  evaluationId: z.string().optional(),
  adjustedPerformanceScore: z.number().min(0).max(5),
  adjustedCompetencyScore: z.number().min(0).max(5),
  reason: z.string().min(1).max(2000),
})

// ─── POST /api/v1/performance/calibration/adjustments ────

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { sessionId, employeeId, evaluationId, adjustedPerformanceScore, adjustedCompetencyScore, reason } = parsed.data

    // Verify session
    const session = await prisma.calibrationSession.findFirst({
      where: { id: sessionId, companyId: user.companyId },
    })
    if (!session) throw notFound('캘리브레이션 세션을 찾을 수 없습니다.')
    if (session.status === 'CALIBRATION_COMPLETED') {
      throw badRequest('이미 완료된 캘리브레이션 세션입니다.')
    }

    // Get original evaluation
    const evaluation = await prisma.performanceEvaluation.findFirst({
      where: {
        ...(evaluationId ? { id: evaluationId } : {}),
        employeeId,
        cycleId: session.cycleId,
        evalType: 'MANAGER',
        companyId: user.companyId,
      },
    })

    const originalPerformanceScore = evaluation?.performanceScore ? Number(evaluation.performanceScore) : 0
    const originalCompetencyScore = evaluation?.competencyScore ? Number(evaluation.competencyScore) : 0
    const originalBlock = evaluation?.emsBlock ?? 'N/A'

    // Calculate new EMS block
    const newEmsResult = calculateEmsBlock(adjustedPerformanceScore, adjustedCompetencyScore, DEFAULT_BLOCK_DEFINITIONS)

    try {
      const adjustment = await prisma.calibrationAdjustment.create({
        data: {
          sessionId,
          employeeId,
          evaluatorId: evaluation?.evaluatorId ?? user.employeeId,
          evaluationId: evaluation?.id ?? null,
          originalPerformanceScore,
          originalCompetencyScore,
          originalBlock,
          adjustedPerformanceScore,
          adjustedCompetencyScore,
          adjustedBlock: newEmsResult.block,
          reason,
          adjustedBy: user.employeeId,
          adjustedAt: new Date(),
        },
        include: {
          employee: { select: { id: true, name: true, employeeNo: true } },
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'performance.calibration_adjustment.create',
        resourceType: 'calibrationAdjustment',
        resourceId: adjustment.id,
        companyId: user.companyId,
        changes: {
          employeeId,
          originalBlock,
          adjustedBlock: newEmsResult.block,
          reason,
        },
        ip,
        userAgent,
      })

      return apiSuccess({
        ...adjustment,
        originalPerformanceScore: Number(adjustment.originalPerformanceScore),
        originalCompetencyScore: Number(adjustment.originalCompetencyScore),
        adjustedPerformanceScore: Number(adjustment.adjustedPerformanceScore),
        adjustedCompetencyScore: Number(adjustment.adjustedCompetencyScore),
      }, 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.PERFORMANCE, ACTION.APPROVE),
)
