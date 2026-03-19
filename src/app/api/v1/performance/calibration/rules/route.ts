// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Calibration Rules CRUD
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── Schemas ──────────────────────────────────────────────

const createSchema = z.object({
  cycleId: z.string().optional(),
  rules: z.array(z.object({
    emsBlock: z.string(),
    recommendedPct: z.number().min(0).max(100),
    minPct: z.number().min(0).max(100).optional(),
    maxPct: z.number().min(0).max(100).optional(),
  })),
})

// ─── GET /api/v1/performance/calibration/rules ────────────

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const cycleId = req.nextUrl.searchParams.get('cycleId') ?? undefined

    const rules = await prisma.calibrationRule.findMany({
      where: {
        companyId: user.companyId,
        ...(cycleId ? { cycleId } : {}),
      },
      orderBy: { emsBlock: 'asc' },
    })

    return apiSuccess(rules.map((r) => ({
      ...r,
      recommendedPct: Number(r.recommendedPct),
      minPct: r.minPct ? Number(r.minPct) : null,
      maxPct: r.maxPct ? Number(r.maxPct) : null,
    })))
  },
  perm(MODULE.PERFORMANCE, ACTION.VIEW),
)

// ─── POST /api/v1/performance/calibration/rules ──────────
// Bulk upsert calibration rules

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { cycleId, rules } = parsed.data

    try {
      const results = await prisma.$transaction(
        rules.map((rule) =>
          prisma.calibrationRule.upsert({
            where: {
              companyId_cycleId_emsBlock: {
                companyId: user.companyId,
                cycleId: cycleId ?? '',
                emsBlock: rule.emsBlock,
              },
            },
            update: {
              recommendedPct: rule.recommendedPct,
              minPct: rule.minPct ?? null,
              maxPct: rule.maxPct ?? null,
            },
            create: {
              companyId: user.companyId,
              cycleId: cycleId ?? null,
              emsBlock: rule.emsBlock,
              recommendedPct: rule.recommendedPct,
              minPct: rule.minPct ?? null,
              maxPct: rule.maxPct ?? null,
              createdBy: user.employeeId,
            },
          }),
        ),
      )

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'performance.calibration_rules.upsert',
        resourceType: 'calibrationRule',
        resourceId: cycleId ?? 'default',
        companyId: user.companyId,
        changes: { rulesCount: rules.length },
        ip,
        userAgent,
      })

      return apiSuccess(results.map((r) => ({
        ...r,
        recommendedPct: Number(r.recommendedPct),
        minPct: r.minPct ? Number(r.minPct) : null,
        maxPct: r.maxPct ? Number(r.maxPct) : null,
      })), 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.PERFORMANCE, ACTION.APPROVE),
)
