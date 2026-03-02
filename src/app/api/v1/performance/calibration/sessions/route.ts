// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Calibration Sessions List & Create
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError, notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '@/lib/constants'
import type { SessionUser } from '@/types'
import type { CalibrationStatus } from '@/generated/prisma/client'

// ─── Schemas ──────────────────────────────────────────────

const searchSchema = z.object({
  cycleId: z.string().cuid().optional(),
  page: z.coerce.number().int().positive().default(DEFAULT_PAGE),
  limit: z.coerce.number().int().positive().max(100).default(DEFAULT_PAGE_SIZE),
})

const createSchema = z.object({
  cycleId: z.string().cuid(),
  departmentId: z.string().optional(),
  name: z.string().min(1).max(200),
})

// ─── GET /api/v1/performance/calibration/sessions ────────

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = searchSchema.safeParse(params)
    if (!parsed.success) throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })

    const { cycleId, page, limit } = parsed.data

    const where = {
      companyId: user.companyId,
      ...(cycleId ? { cycleId } : {}),
    }

    const [sessions, total] = await Promise.all([
      prisma.calibrationSession.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          cycle: { select: { id: true, name: true, year: true, half: true } },
          department: { select: { id: true, name: true } },
          creator: { select: { id: true, name: true } },
          _count: { select: { adjustments: true } },
        },
      }),
      prisma.calibrationSession.count({ where }),
    ])

    return apiPaginated(sessions, buildPagination(page, limit, total))
  },
  perm(MODULE.PERFORMANCE, ACTION.APPROVE),
)

// ─── POST /api/v1/performance/calibration/sessions ───────

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { cycleId, departmentId, name } = parsed.data

    const cycle = await prisma.performanceCycle.findFirst({
      where: { id: cycleId, companyId: user.companyId },
    })
    if (!cycle) throw notFound('유효하지 않은 성과 주기입니다.')
    if (cycle.status !== 'CALIBRATION') throw badRequest('캘리브레이션 단계가 아닙니다.')

    try {
      const session = await prisma.calibrationSession.create({
        data: {
          cycleId,
          companyId: user.companyId,
          departmentId: departmentId ?? null,
          name,
          status: 'CALIBRATION_DRAFT' as CalibrationStatus,
          createdBy: user.employeeId,
        },
        include: {
          cycle: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'performance.calibration_session.create',
        resourceType: 'calibrationSession',
        resourceId: session.id,
        companyId: user.companyId,
        changes: { name, cycleId, departmentId },
        ip,
        userAgent,
      })

      return apiSuccess(session, 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.PERFORMANCE, ACTION.APPROVE),
)
