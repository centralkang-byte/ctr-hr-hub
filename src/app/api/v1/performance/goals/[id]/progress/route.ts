// ═══════════════════════════════════════════════════════════
// CTR HR Hub — MBO Goal Progress List & Create
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, notFound, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── Schemas ──────────────────────────────────────────────

const progressSchema = z.object({
  progressPct: z.number().int().min(0).max(100),
  note: z.string().max(2000).optional(),
})

const listSchema = z.object({
  page: z.coerce.number().int().positive().default(DEFAULT_PAGE),
  limit: z.coerce.number().int().positive().max(100).default(DEFAULT_PAGE_SIZE),
})

// ─── Helper ──────────────────────────────────────────────

async function findGoalForUser(id: string, user: SessionUser) {
  const goal = await prisma.mboGoal.findFirst({
    where: { id, employeeId: user.employeeId, companyId: user.companyId },
  })
  if (!goal) throw notFound('해당 목표를 찾을 수 없습니다.')
  return goal
}

// ─── GET /api/v1/performance/goals/:id/progress ─────────
// List progress history for a goal

export const GET = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params
    await findGoalForUser(id, user)

    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = listSchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { page, limit } = parsed.data

    const [entries, total] = await Promise.all([
      prisma.mboProgress.findMany({
        where: { goalId: id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          creator: { select: { id: true, name: true } },
        },
      }),
      prisma.mboProgress.count({ where: { goalId: id } }),
    ])

    return apiPaginated(entries, buildPagination(page, limit, total))
  },
  perm(MODULE.PERFORMANCE, ACTION.VIEW),
)

// ─── POST /api/v1/performance/goals/:id/progress ────────
// Add progress entry and update achievementScore

export const POST = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params
    const goal = await findGoalForUser(id, user)

    const body: unknown = await req.json()
    const parsed = progressSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { progressPct, note } = parsed.data

    // Map progressPct to 1-5 scale: pct / 20
    const achievementScore = progressPct / 20

    try {
      const [progress] = await prisma.$transaction([
        prisma.mboProgress.create({
          data: {
            goalId: id,
            progressPct,
            note,
            createdBy: user.employeeId,
          },
          include: {
            creator: { select: { id: true, name: true } },
          },
        }),
        prisma.mboGoal.update({
          where: { id: goal.id },
          data: { achievementScore },
        }),
      ])

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'performance.goal.progress.create',
        resourceType: 'mboProgress',
        resourceId: progress.id,
        companyId: user.companyId,
        changes: { goalId: id, progressPct, achievementScore },
        ip,
        userAgent,
      })

      return apiSuccess(progress, 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.PERFORMANCE, ACTION.CREATE),
)
