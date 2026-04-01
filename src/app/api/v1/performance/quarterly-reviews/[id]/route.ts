// ═══════════════════════════════════════════════════════════
// CTR HR Hub — QuarterlyReview Detail (GET) & Update (PUT)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, forbidden, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { maskQuarterlyReview } from '@/lib/performance/quarterly-review-masking'
import type { GoalTrackingStatus } from '@/generated/prisma/enums'
import type { SessionUser } from '@/types'

// ─── Schemas ──────────────────────────────────────────────

const employeeUpdateSchema = z.object({
  goalHighlights: z.string().max(5000).optional(),
  challenges: z.string().max(5000).optional(),
  developmentNeeds: z.string().max(5000).optional(),
  employeeComments: z.string().max(5000).optional(),
  goalProgress: z
    .array(
      z.object({
        goalProgressId: z.string().uuid(),
        progressPct: z.number().int().min(0).max(100),
        employeeComment: z.string().max(2000).optional(),
      }),
    )
    .optional(),
})

const managerUpdateSchema = z.object({
  managerFeedback: z.string().max(5000).optional(),
  coachingNotes: z.string().max(5000).optional(),
  developmentPlan: z.string().max(5000).optional(),
  overallSentiment: z.enum(['POSITIVE', 'NEUTRAL', 'CONCERN']).optional(),
  actionItems: z
    .array(
      z.object({
        description: z.string().max(500),
        dueDate: z.string().optional(),
        assignee: z.enum(['EMPLOYEE', 'MANAGER']).optional(),
      }),
    )
    .max(20)
    .optional(),
  goalProgress: z
    .array(
      z.object({
        goalProgressId: z.string().uuid(),
        managerComment: z.string().max(2000).optional(),
        trackingStatus: z.enum(['ON_TRACK', 'AT_RISK', 'BEHIND']).optional(),
      }),
    )
    .optional(),
})

// ─── Shared Includes ─────────────────────────────────────

const reviewInclude = {
  employee: {
    select: {
      id: true,
      name: true,
      employeeNo: true,
      assignments: {
        where: { isPrimary: true, endDate: null },
        select: {
          department: { select: { name: true } },
          jobGrade: { select: { name: true, code: true } },
        },
        take: 1,
      },
    },
  },
  manager: { select: { id: true, name: true } },
  goalProgress: {
    include: {
      goal: { select: { id: true, title: true, status: true } },
    },
    orderBy: { snapshotWeight: 'desc' as const },
  },
  cycle: { select: { id: true, name: true, year: true, half: true, status: true } },
} as const

// ─── GET /api/v1/performance/quarterly-reviews/:id ──────

export const GET = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params

    // SUPER_ADMIN은 companyId 파라미터로 다른 회사 조회 가능
    const url = new URL(req.url)
    const companyId =
      user.role === ROLE.SUPER_ADMIN
        ? url.searchParams.get('companyId') ?? user.companyId
        : user.companyId

    const review = await prisma.quarterlyReview.findFirst({
      where: { id, companyId },
      include: reviewInclude,
    })

    if (!review) {
      throw notFound('분기 리뷰를 찾을 수 없습니다.')
    }

    // 접근 권한 확인
    const isEmployee = user.employeeId === review.employeeId
    const isManager = user.employeeId === review.managerId
    const isHr = user.role === ROLE.SUPER_ADMIN || user.role === ROLE.HR_ADMIN
    const isExecutive = user.role === ROLE.EXECUTIVE

    if (!isEmployee && !isManager && !isHr && !isExecutive) {
      throw forbidden('이 리뷰에 접근할 권한이 없습니다.')
    }

    const masked = maskQuarterlyReview(review, user)
    return apiSuccess(masked)
  },
  perm(MODULE.PERFORMANCE, ACTION.VIEW),
)

// ─── PUT /api/v1/performance/quarterly-reviews/:id ──────

export const PUT = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params

    // 1. 기존 리뷰 조회
    const review = await prisma.quarterlyReview.findFirst({
      where: { id, companyId: user.companyId },
      include: reviewInclude,
    })

    if (!review) {
      throw notFound('분기 리뷰를 찾을 수 없습니다.')
    }

    // 2. 호출자 역할 판별
    const isEmployee = user.employeeId === review.employeeId
    const isManager = user.employeeId === review.managerId
    const isHr = user.role === ROLE.SUPER_ADMIN || user.role === ROLE.HR_ADMIN

    // 3. 상태 가드
    if (isEmployee) {
      if (!['DRAFT', 'IN_PROGRESS'].includes(review.status)) {
        throw badRequest('현재 상태에서 수정할 수 없습니다.')
      }
    } else if (isManager) {
      if (review.status !== 'EMPLOYEE_DONE') {
        throw badRequest('직원이 제출한 후에만 수정할 수 있습니다.')
      }
    } else if (isHr) {
      if (review.status === 'COMPLETED') {
        throw badRequest('완료된 리뷰는 수정할 수 없습니다. 재오픈하세요.')
      }
    } else {
      throw forbidden('이 리뷰를 수정할 권한이 없습니다.')
    }

    // 4. 요청 바디 파싱 (역할별 스키마)
    const body: unknown = await req.json()
    const schema = isEmployee ? employeeUpdateSchema : managerUpdateSchema
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { goalProgress, ...reviewFields } = parsed.data

    // 5. IDOR 방어: goalProgress ID가 이 리뷰에 속하는지 검증
    if (goalProgress && goalProgress.length > 0) {
      const validIds = await prisma.quarterlyGoalProgress.findMany({
        where: { quarterlyReviewId: review.id },
        select: { id: true },
      })
      const validIdSet = new Set(validIds.map((v) => v.id))

      for (const gp of goalProgress) {
        if (!validIdSet.has(gp.goalProgressId)) {
          throw forbidden('해당 목표 진행 데이터에 접근할 수 없습니다.')
        }
      }
    }

    // 6. 트랜잭션: 리뷰 필드 업데이트 + QGP 배치 업데이트
    try {
      const updated = await prisma.$transaction(async (tx) => {
        // 자동 상태 전환: DRAFT → IN_PROGRESS
        const statusUpdate =
          isEmployee && review.status === 'DRAFT'
            ? { status: 'IN_PROGRESS' as const }
            : {}

        const updatedReview = await tx.quarterlyReview.update({
          where: { id: review.id },
          data: {
            ...reviewFields,
            ...statusUpdate,
          },
          include: reviewInclude,
        })

        // goalProgress 배치 업데이트
        if (goalProgress && goalProgress.length > 0) {
          if (isEmployee) {
            await Promise.all(
              goalProgress.map((gp) => {
                const item = gp as { goalProgressId: string; progressPct: number; employeeComment?: string }
                return tx.quarterlyGoalProgress.update({
                  where: { id: item.goalProgressId },
                  data: {
                    progressPct: item.progressPct,
                    employeeComment: item.employeeComment,
                  },
                })
              }),
            )
          } else {
            // manager or HR
            await Promise.all(
              goalProgress.map((gp) => {
                const item = gp as { goalProgressId: string; managerComment?: string; trackingStatus?: GoalTrackingStatus }
                return tx.quarterlyGoalProgress.update({
                  where: { id: item.goalProgressId },
                  data: {
                    managerComment: item.managerComment,
                    trackingStatus: item.trackingStatus,
                  },
                })
              }),
            )
          }
        }

        return updatedReview
      })

      // 7. 감사 로그
      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'performance.quarterly-review.update',
        resourceType: 'quarterlyReview',
        resourceId: updated.id,
        companyId: updated.companyId,
        changes: parsed.data,
        ip,
        userAgent,
      })

      // 8. 마스킹 적용 후 반환
      const masked = maskQuarterlyReview(updated, user)
      return apiSuccess(masked)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.PERFORMANCE, ACTION.CREATE),
)
