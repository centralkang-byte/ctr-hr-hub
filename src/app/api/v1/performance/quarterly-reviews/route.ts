// ═══════════════════════════════════════════════════════════
// CTR HR Hub — QuarterlyReview List & Create
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, conflict, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, ROLE, DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '@/lib/constants'
import { getManagerIdByPosition } from '@/lib/employee/direct-reports'
import { getHrAdminIds } from '@/lib/auth/hr-admin-lookup'
import { maskQuarterlyReview } from '@/lib/performance/quarterly-review-masking'
import { eventBus } from '@/lib/events/event-bus'
import { DOMAIN_EVENTS } from '@/lib/events/types'
import type { SessionUser } from '@/types'
import type { Quarter, QuarterlyReviewStatus } from '@/generated/prisma/client'

// ─── Schemas ──────────────────────────────────────────────

const searchSchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100).optional(),
  quarter: z.enum(['Q1', 'Q2', 'Q3', 'Q4']).optional(),
  status: z.enum(['DRAFT', 'IN_PROGRESS', 'EMPLOYEE_DONE', 'MANAGER_DONE', 'COMPLETED']).optional(),
  employeeId: z.string().uuid().optional(),
  managerId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(DEFAULT_PAGE),
  limit: z.coerce.number().int().positive().max(100).default(DEFAULT_PAGE_SIZE),
})

const createSchema = z.object({
  employeeId: z.string().uuid(),
  managerId: z.string().uuid().optional(),
  year: z.number().int().min(2020).max(2100),
  quarter: z.enum(['Q1', 'Q2', 'Q3', 'Q4']),
  cycleId: z.string().uuid().optional(),
})

// ─── GET /api/v1/performance/quarterly-reviews ──────────
// List quarterly reviews (role-scoped)

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = searchSchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { year, quarter, status, employeeId, managerId, page, limit } = parsed.data

    // ── Role-scoped where 절 구성 ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { companyId: user.companyId }

    if (year !== undefined) where.year = year
    if (quarter) where.quarter = quarter as Quarter
    if (status) where.status = status as QuarterlyReviewStatus

    if (user.role === ROLE.EMPLOYEE) {
      // EMPLOYEE: 자기 리뷰만
      where.employeeId = user.employeeId
    } else if (user.role === ROLE.MANAGER) {
      // MANAGER: 자기 리뷰 + 자기가 매니저인 리뷰
      where.OR = [
        { managerId: user.employeeId },
        { employeeId: user.employeeId },
      ]
    } else {
      // HR_ADMIN / SUPER_ADMIN: 필터만 적용
      if (employeeId) where.employeeId = employeeId
      if (managerId) where.managerId = managerId
    }

    const [reviews, total] = await Promise.all([
      prisma.quarterlyReview.findMany({
        where,
        orderBy: [{ year: 'desc' }, { quarter: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          employee: { select: { id: true, name: true, employeeNo: true } },
          manager: { select: { id: true, name: true } },
          _count: { select: { goalProgress: true } },
        },
      }),
      prisma.quarterlyReview.count({ where }),
    ])

    const masked = reviews.map((r) => maskQuarterlyReview(r, user))

    return apiPaginated(masked, buildPagination(page, limit, total))
  },
  perm(MODULE.PERFORMANCE, ACTION.VIEW),
)

// ─── POST /api/v1/performance/quarterly-reviews ─────────
// Create a new quarterly review (status: DRAFT)

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { employeeId, year, quarter, cycleId } = parsed.data
    let { managerId } = parsed.data

    // ── 1. managerId resolve ──
    if (!managerId) {
      managerId = await getManagerIdByPosition(employeeId) ?? undefined
    }
    if (!managerId) {
      const hrAdminIds = await getHrAdminIds(prisma, user.companyId)
      managerId = hrAdminIds[0] ?? undefined
    }
    if (!managerId) {
      throw badRequest('매니저를 결정할 수 없습니다. 직속 상관 또는 HR 담당자가 지정되어 있지 않습니다.')
    }

    // ── 2. 대상 직원 검증 (company via assignment) ──
    const employee = await prisma.employee.findFirst({
      where: {
        id: employeeId,
        assignments: {
          some: { isPrimary: true, endDate: null, position: { companyId: user.companyId } },
        },
      },
      select: { id: true },
    })
    if (!employee) {
      throw badRequest('해당 직원을 찾을 수 없거나 소속 법인이 다릅니다.')
    }

    // ── 3. 중복 검사 ──
    const existing = await prisma.quarterlyReview.findFirst({
      where: { employeeId, companyId: user.companyId, year, quarter: quarter as Quarter },
    })
    if (existing) {
      throw conflict('해당 분기에 이미 리뷰가 존재합니다.')
    }

    // ── 4. 트랜잭션: 리뷰 생성 + 목표 스냅샷 ──
    try {
      const result = await prisma.$transaction(async (tx) => {
        const review = await tx.quarterlyReview.create({
          data: {
            companyId: user.companyId,
            employeeId,
            managerId,
            year,
            quarter: quarter as Quarter,
            cycleId: cycleId ?? null,
            status: 'DRAFT' as QuarterlyReviewStatus,
          },
          include: {
            employee: { select: { id: true, name: true, employeeNo: true } },
            manager: { select: { id: true, name: true } },
          },
        })

        // APPROVED MboGoal 조회 (cycleId 있으면 해당 사이클, 없으면 직원+회사 기준)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const goalWhere: Record<string, any> = {
          employeeId,
          companyId: user.companyId,
          status: 'APPROVED',
        }
        if (cycleId) {
          goalWhere.cycleId = cycleId
        }

        const goals = await tx.mboGoal.findMany({
          where: goalWhere,
          select: { id: true, title: true, weight: true, targetValue: true },
        })

        // 각 목표에 대해 QuarterlyGoalProgress 스냅샷 생성
        if (goals.length > 0) {
          await tx.quarterlyGoalProgress.createMany({
            data: goals.map((goal) => ({
              quarterlyReviewId: review.id,
              goalId: goal.id,
              snapshotTitle: goal.title,
              snapshotWeight: Number(goal.weight),
              snapshotTarget: goal.targetValue ?? null,
            })),
          })
        }

        return review
      })

      // ── 5. 감사 로그 ──
      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'performance.quarterly-review.create',
        resourceType: 'quarterlyReview',
        resourceId: result.id,
        companyId: user.companyId,
        changes: { employeeId, managerId, year, quarter, cycleId },
        ip,
        userAgent,
      })

      // ── 6. 도메인 이벤트 ──
      void eventBus.publish(DOMAIN_EVENTS.QUARTERLY_REVIEW_CREATED, {
        ctx: {
          companyId: user.companyId,
          actorId: user.employeeId!,
          occurredAt: new Date(),
        },
        reviewId: result.id,
        employeeId,
        managerId,
        companyId: user.companyId,
        year,
        quarter,
      })

      return apiSuccess(result, 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.PERFORMANCE, ACTION.CREATE),
)
