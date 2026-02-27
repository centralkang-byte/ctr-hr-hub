// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Performance Cycle List & Create
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
import type { CycleStatus, CycleHalf } from '@/generated/prisma/client'

// ─── Schemas ──────────────────────────────────────────────

const searchSchema = z.object({
  page: z.coerce.number().int().positive().default(DEFAULT_PAGE),
  limit: z.coerce.number().int().positive().max(100).default(DEFAULT_PAGE_SIZE),
  year: z.coerce.number().int().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'EVAL_OPEN', 'CALIBRATION', 'CLOSED']).optional(),
})

const createSchema = z.object({
  name: z.string().min(1).max(100),
  year: z.number().int().min(2000).max(2100),
  half: z.enum(['H1', 'H2', 'ANNUAL']),
  goalStart: z.string().datetime(),
  goalEnd: z.string().datetime(),
  evalStart: z.string().datetime(),
  evalEnd: z.string().datetime(),
})

// ─── GET /api/v1/performance/cycles ──────────────────────
// Paginated list with year/status filters, company scoped

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = searchSchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { page, limit, year, status } = parsed.data
    const companyId = user.companyId

    const where = {
      companyId,
      ...(year ? { year } : {}),
      ...(status ? { status: status as CycleStatus } : {}),
    }

    const [cycles, total] = await Promise.all([
      prisma.performanceCycle.findMany({
        where,
        orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: {
            select: {
              mboGoals: true,
              performanceEvaluations: true,
            },
          },
        },
      }),
      prisma.performanceCycle.count({ where }),
    ])

    return apiPaginated(cycles, buildPagination(page, limit, total))
  },
  perm(MODULE.PERFORMANCE, ACTION.VIEW),
)

// ─── POST /api/v1/performance/cycles ─────────────────────
// Create a new performance cycle (default status: DRAFT)

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { name, year, half, goalStart, goalEnd, evalStart, evalEnd } = parsed.data

    // Validate date ordering
    if (new Date(goalStart) >= new Date(goalEnd)) {
      throw badRequest('목표 시작일은 종료일보다 이전이어야 합니다.')
    }
    if (new Date(evalStart) >= new Date(evalEnd)) {
      throw badRequest('평가 시작일은 종료일보다 이전이어야 합니다.')
    }

    try {
      const cycle = await prisma.performanceCycle.create({
        data: {
          companyId: user.companyId,
          name,
          year,
          half: half as CycleHalf,
          goalStart: new Date(goalStart),
          goalEnd: new Date(goalEnd),
          evalStart: new Date(evalStart),
          evalEnd: new Date(evalEnd),
          status: 'DRAFT' as CycleStatus,
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'performance.cycle.create',
        resourceType: 'performanceCycle',
        resourceId: cycle.id,
        companyId: cycle.companyId,
        changes: { name, year, half },
        ip,
        userAgent,
      })

      return apiSuccess(cycle, 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.PERFORMANCE, ACTION.CREATE),
)
