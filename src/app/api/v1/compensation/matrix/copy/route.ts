// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Salary Adjustment Matrix Copy
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'
import { matrixCopySchema } from '@/lib/schemas/compensation'

// ─── POST /api/v1/compensation/matrix/copy ──────────────
// Copy matrix entries from one cycle to another

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = matrixCopySchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { sourceCycleId, targetCycleId } = parsed.data
    const companyId = user.companyId

    try {
      // 1. Read source entries
      const sourceEntries = await prisma.salaryAdjustmentMatrix.findMany({
        where: { companyId, cycleId: sourceCycleId },
      })

      if (sourceEntries.length === 0) {
        throw badRequest('원본 사이클에 매트릭스 항목이 없습니다.')
      }

      const result = await prisma.$transaction(async (tx) => {
        // 2. Delete existing target entries
        await tx.salaryAdjustmentMatrix.deleteMany({
          where: { companyId, cycleId: targetCycleId },
        })

        // 3. Create new entries with targetCycleId
        const created = await tx.salaryAdjustmentMatrix.createMany({
          data: sourceEntries.map((entry) => ({
            companyId,
            cycleId: targetCycleId,
            emsBlock: entry.emsBlock,
            recommendedIncreasePct: entry.recommendedIncreasePct,
            minIncreasePct: entry.minIncreasePct,
            maxIncreasePct: entry.maxIncreasePct,
          })),
        })

        return created
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'compensation.matrix.copy',
        resourceType: 'salaryAdjustmentMatrix',
        resourceId: targetCycleId,
        companyId,
        changes: { sourceCycleId, targetCycleId, entryCount: sourceEntries.length },
        ip,
        userAgent,
      })

      return apiSuccess(result, 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.COMPENSATION, ACTION.CREATE),
)
