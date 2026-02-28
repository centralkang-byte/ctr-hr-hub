// ═══════════════════════════════════════════════════════════
// CTR HR Hub — POST /api/v1/attrition/recalculate
// 이직 위험도 재계산: 단일 직원 또는 전사 배치
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import {
  calculateAttritionRisk,
  calculateAttritionRiskBatch,
} from '@/lib/attrition'
import type { SessionUser } from '@/types'

export const POST = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    const body = await req.json().catch(() => ({}))
    const { employeeId } = body as { employeeId?: string }
    const companyId = user.companyId
    const meta = extractRequestMeta(req.headers)

    if (employeeId) {
      // ── Single employee recalculation ─────────────────────
      const employee = await prisma.employee.findFirst({
        where: {
          id: employeeId,
          deletedAt: null,
          ...(user.role !== 'SUPER_ADMIN' ? { companyId } : {}),
        },
        select: { id: true, companyId: true },
      })

      if (!employee) {
        throw notFound('직원을 찾을 수 없습니다.')
      }

      const result = await calculateAttritionRisk(employeeId)

      // Save to history
      await prisma.attritionRiskHistory.create({
        data: {
          employeeId,
          companyId: employee.companyId,
          score: result.riskScore,
          ruleScore: result.riskScore,
          scoreFactors: JSON.parse(JSON.stringify(result.factors)),
          calculatedAt: result.calculatedAt,
        },
      })

      // Update denormalized score
      await prisma.employee.update({
        where: { id: employeeId },
        data: { attritionRiskScore: result.riskScore },
      })

      logAudit({
        actorId: user.id,
        action: 'attrition.recalculate',
        resourceType: 'employee',
        resourceId: employeeId,
        companyId: employee.companyId,
        changes: {
          type: 'single',
          score: result.riskScore,
          riskLevel: result.riskLevel,
        },
        ip: meta.ip,
        userAgent: meta.userAgent,
      })

      return apiSuccess({
        employeeId,
        riskScore: result.riskScore,
        riskLevel: result.riskLevel,
        factors: result.factors,
        calculatedAt: result.calculatedAt,
      })
    }

    // ── Batch recalculation for company ──────────────────────
    if (!companyId) {
      throw badRequest('companyId가 필요합니다.')
    }

    const batchResult = await calculateAttritionRiskBatch(companyId)

    logAudit({
      actorId: user.id,
      action: 'attrition.recalculate',
      resourceType: 'company',
      resourceId: companyId,
      companyId,
      changes: {
        type: 'batch',
        processed: batchResult.processed,
      },
      ip: meta.ip,
      userAgent: meta.userAgent,
    })

    return apiSuccess({
      type: 'batch',
      companyId,
      processed: batchResult.processed,
    })
  },
  perm(MODULE.ANALYTICS, ACTION.APPROVE),
)
