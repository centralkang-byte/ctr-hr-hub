// ═══════════════════════════════════════════════════════════
// CTR HR Hub — MBO Goal List & Create
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '@/lib/constants'
import type { SessionUser } from '@/types'
import type { GoalStatus } from '@/generated/prisma/client'

// ─── Schemas ──────────────────────────────────────────────

const searchSchema = z.object({
  cycleId: z.string().cuid(),
  page: z.coerce.number().int().positive().default(DEFAULT_PAGE),
  limit: z.coerce.number().int().positive().max(100).default(DEFAULT_PAGE_SIZE),
})

const createSchema = z.object({
  cycleId: z.string().cuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  weight: z.number().min(0).max(100),
  targetMetric: z.string().max(100).optional(),
  targetValue: z.string().max(100).optional(),
})

// ─── GET /api/v1/performance/goals ───────────────────────
// List current user's goals for a cycle

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = searchSchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { cycleId, page, limit } = parsed.data

    const where = {
      cycleId,
      employeeId: user.employeeId,
      companyId: user.companyId,
    }

    const [goals, total] = await Promise.all([
      prisma.mboGoal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          cycle: { select: { id: true, name: true, year: true, half: true, status: true } },
          progress: {
            orderBy: { createdAt: 'desc' },
            take: 3,
            select: { id: true, progressPct: true, note: true, createdAt: true },
          },
        },
      }),
      prisma.mboGoal.count({ where }),
    ])

    const mapped = goals.map((g) => ({
      ...g,
      weight: Number(g.weight),
      achievementScore: g.achievementScore ? Number(g.achievementScore) : null,
    }))

    return apiPaginated(mapped, buildPagination(page, limit, total))
  },
  perm(MODULE.PERFORMANCE, ACTION.VIEW),
)

// ─── POST /api/v1/performance/goals ─────────────────────
// Create a new MBO goal (status: DRAFT)

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { cycleId, title, description, weight, targetMetric, targetValue } = parsed.data

    // Verify cycle exists and belongs to company
    const cycle = await prisma.performanceCycle.findFirst({
      where: { id: cycleId, companyId: user.companyId },
    })
    if (!cycle) {
      throw badRequest('유효하지 않은 성과 주기입니다.')
    }

    try {
      const goal = await prisma.mboGoal.create({
        data: {
          cycleId,
          employeeId: user.employeeId,
          companyId: user.companyId,
          title,
          description,
          weight,
          targetMetric,
          targetValue,
          status: 'DRAFT' as GoalStatus,
          aiGenerated: false,
        },
        include: {
          cycle: { select: { id: true, name: true, year: true, half: true } },
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'performance.goal.create',
        resourceType: 'mboGoal',
        resourceId: goal.id,
        companyId: goal.companyId,
        changes: { title, weight, cycleId },
        ip,
        userAgent,
      })

      return apiSuccess(
        { ...goal, weight: Number(goal.weight), achievementScore: null },
        201,
      )
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.PERFORMANCE, ACTION.CREATE),
)
