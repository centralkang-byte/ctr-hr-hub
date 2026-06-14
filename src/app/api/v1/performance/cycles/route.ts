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
import { maskCycleForEmployee, isResultPublishedForRole } from '@/lib/performance/data-masking'

// ─── Schemas ──────────────────────────────────────────────

const searchSchema = z.object({
  page: z.coerce.number().int().positive().default(DEFAULT_PAGE),
  limit: z.coerce.number().int().positive().max(100).default(DEFAULT_PAGE_SIZE),
  year: z.coerce.number().int().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'CHECK_IN', 'EVAL_OPEN', 'CALIBRATION', 'FINALIZED', 'CLOSED', 'COMP_REVIEW', 'COMP_COMPLETED']).optional(),
})

const createSchema = z.object({
  name: z.string().min(1).max(100),
  year: z.number().int().min(2000).max(2100),
  half: z.enum(['H1', 'H2', 'ANNUAL']),
  goalStart: z.string().datetime(),
  goalEnd: z.string().datetime(),
  evalStart: z.string().datetime(),
  evalEnd: z.string().datetime(),
  excludeProbation: z.boolean().optional(),
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

    // EMPLOYEE: 결과 공개 = 본인 PerformanceReview.notifiedAt(단조) — my-result·peer-review/results
    // 서버 게이트와 동일 신호. status 마스킹(COMP_* → CLOSED 표시)은 유지하되 isResultPublished는
    // notifiedAt으로 판정해 통보 후 후속 단계(CALIBRATION/COMP_*)에서도 드롭다운과 게이트가 일치하도록 한다
    // (status-only면 통보된 결과가 후속 단계서 목록에서 사라지는 회귀 — Codex Gate2 P1).
    // 비-EMPLOYEE는 status 기반(isResultPublishedForRole).
    let resultCycles
    if (user.role === 'EMPLOYEE') {
      const reviews = await prisma.performanceReview.findMany({
        where: { employeeId: user.employeeId, companyId, cycleId: { in: cycles.map((c) => c.id) } },
        select: { cycleId: true, notifiedAt: true },
      })
      const notified = new Map(reviews.map((r) => [r.cycleId, r.notifiedAt != null]))
      resultCycles = cycles.map((c) => ({
        ...maskCycleForEmployee(c),
        isResultPublished: notified.get(c.id) ?? false,
      }))
    } else {
      resultCycles = cycles.map((c) => ({ ...c, isResultPublished: isResultPublishedForRole(c.status, user.role) }))
    }

    return apiPaginated(resultCycles, buildPagination(page, limit, total))
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

    const { name, year, half, goalStart, goalEnd, evalStart, evalEnd, excludeProbation } = parsed.data

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
          ...(excludeProbation !== undefined ? { excludeProbation } : {}),
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
  perm(MODULE.PERFORMANCE, ACTION.APPROVE), // HR-admin only — cycle creation requires manage permission
)
