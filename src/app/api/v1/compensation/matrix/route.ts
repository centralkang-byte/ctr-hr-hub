// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Salary Adjustment Matrix List & Upsert
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'
import { matrixSearchSchema, matrixUpsertSchema } from '@/lib/schemas/compensation'

// ─── GET /api/v1/compensation/matrix ────────────────────
// List matrix entries (max 9), optionally filtered by cycleId

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = matrixSearchSchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { cycleId } = parsed.data
    const companyId = user.companyId

    const where = {
      companyId,
      ...(cycleId ? { cycleId } : { cycleId: null }),
    }

    const entries = await prisma.salaryAdjustmentMatrix.findMany({
      where,
      include: {
        cycle: { select: { id: true, name: true, year: true } },
      },
      orderBy: { emsBlock: 'asc' },
    })

    return apiSuccess(entries)
  },
  perm(MODULE.COMPENSATION, ACTION.VIEW),
)

// ─── POST /api/v1/compensation/matrix ───────────────────
// Upsert matrix: delete existing + create new entries in transaction

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = matrixUpsertSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { cycleId, entries } = parsed.data
    const companyId = user.companyId

    try {
      const result = await prisma.$transaction(async (tx) => {
        // 1. Delete existing entries for this company + cycleId
        await tx.salaryAdjustmentMatrix.deleteMany({
          where: { companyId, cycleId: cycleId ?? null },
        })

        // 2. Create new entries
        const created = await tx.salaryAdjustmentMatrix.createMany({
          data: entries.map((entry) => ({
            companyId,
            cycleId: cycleId ?? null,
            emsBlock: entry.emsBlock,
            recommendedIncreasePct: entry.recommendedIncreasePct,
            minIncreasePct: entry.minIncreasePct ?? null,
            maxIncreasePct: entry.maxIncreasePct ?? null,
          })),
        })

        return created
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'compensation.matrix.upsert',
        resourceType: 'salaryAdjustmentMatrix',
        resourceId: cycleId ?? 'default',
        companyId,
        changes: { cycleId, entryCount: entries.length },
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
