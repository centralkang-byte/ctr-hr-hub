// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/my/tasks
// Unified Task API: 서버 사이드 집계 (5개 소스)
// Architecture Decision: API Aggregation (새 DB 모델 없음)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withAuth } from '@/lib/permissions'
import type { SessionUser } from '@/types'

interface UnifiedTask {
  type: string
  id: string
  title: string
  dueDate: Date | null
}

// ─── GET /api/v1/my/tasks ────────────────────────────────

export const GET = withAuth(
  async (_req: NextRequest, _context, user: SessionUser) => {
    const employeeId = user.employeeId

    // 5개 소스에서 병렬로 pending tasks 집계
    const [
      leaveRequests,
      onboardingTasks,
      offboardingTasks,
      performanceReviews,
      attendanceSteps,
    ] = await Promise.all([
      // 1. 휴가 승인 대기 — 같은 회사 PENDING 요청 (매니저/HR용)
      prisma.leaveRequest.findMany({
        where: {
          companyId: user.companyId,
          status: 'PENDING',
          employee: {
            assignments: {
              some: {
                isPrimary: true,
                endDate: null,
                department: {
                  positions: {
                    some: {
                      directReports: {
                        some: {
                          assignments: {
                            some: {
                              employeeId,
                              isPrimary: true,
                              endDate: null,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        select: {
          id: true,
          startDate: true,
          employee: { select: { name: true } },
        },
        take: 20,
      }).catch(() => []),

      // 2. 온보딩 할당 태스크
      prisma.employeeOnboardingTask.findMany({
        where: {
          assigneeId: employeeId,
          status: { not: 'DONE' },
          employeeOnboarding: { planType: 'ONBOARDING' },
        },
        select: {
          id: true,
          dueDate: true,
          task: { select: { title: true } },
        },
        take: 20,
      }).catch(() => []),

      // 3. 오프보딩 할당 태스크
      prisma.employeeOnboardingTask.findMany({
        where: {
          assigneeId: employeeId,
          status: { not: 'DONE' },
          employeeOnboarding: { planType: 'OFFBOARDING' },
        },
        select: {
          id: true,
          dueDate: true,
          task: { select: { title: true } },
        },
        take: 20,
      }).catch(() => []),

      // 4. 성과 평가 — 본인 미완료 리뷰
      prisma.performanceReview.findMany({
        where: {
          employeeId,
          status: { in: ['NOT_STARTED', 'SELF_EVAL', 'GOAL_SETTING'] },
        },
        select: {
          id: true,
          status: true,
          cycle: { select: { name: true } },
        },
        take: 20,
      }).catch(() => []),

      // 5. 근태 승인 대기
      prisma.attendanceApprovalStep.findMany({
        where: {
          approverId: employeeId,
          status: 'pending',
        },
        select: {
          id: true,
          request: {
            select: {
              id: true,
              requestType: true,
              title: true,
              createdAt: true,
            },
          },
        },
        take: 20,
      }).catch(() => []),
    ])

    // 통합 형태로 변환
    const tasks: UnifiedTask[] = [
      ...leaveRequests.map((l) => ({
        type: 'LEAVE_APPROVAL',
        id: l.id,
        title: `${l.employee.name} 휴가 승인`,
        dueDate: l.startDate,
      })),
      ...onboardingTasks.map((t) => ({
        type: 'ONBOARDING',
        id: t.id,
        title: t.task?.title ?? '온보딩 태스크',
        dueDate: t.dueDate,
      })),
      ...offboardingTasks.map((t) => ({
        type: 'OFFBOARDING',
        id: t.id,
        title: t.task?.title ?? '오프보딩 태스크',
        dueDate: t.dueDate,
      })),
      ...performanceReviews.map((p) => ({
        type: 'PERFORMANCE',
        id: p.id,
        title: `${p.cycle?.name ?? '성과'} 평가 (${p.status})`,
        dueDate: null,
      })),
      ...attendanceSteps.map((a) => ({
        type: 'ATTENDANCE',
        id: a.request?.id ?? a.id,
        title: a.request?.title ?? `근태 승인`,
        dueDate: a.request?.createdAt ?? null,
      })),
    ].sort((a, b) => {
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    })

    return apiSuccess({ tasks, total: tasks.length })
  },
)
