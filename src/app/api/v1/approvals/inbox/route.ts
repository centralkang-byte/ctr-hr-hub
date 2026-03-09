// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/approvals/inbox
// Stage 5-B: 통합 승인함 API
//
// 설계 결정:
//   - manager-hub/pending-approvals 패턴 재사용
//   - LeaveRequest + MboGoal + PayrollRun을 하나의 ApprovalItem 형태로 통합
//   - status 쿼리: PENDING(default) | APPROVED | REJECTED | ALL
//   - module 쿼리: LEAVE | PERFORMANCE | PAYROLL | ALL(default)
//   - ?countOnly=true → 뱃지 카운트 전용 (빠른 응답)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'
import { unauthorized } from '@/lib/errors'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── Unified item shape ────────────────────────────────────

export interface ApprovalItem {
  id:            string
  module:        'LEAVE' | 'PERFORMANCE' | 'PAYROLL'
  type:          string
  title:         string
  description:   string
  requesterId:   string
  requesterName: string
  requesterDept: string
  createdAt:     string
  dueDate:       string | null
  priority:      'HIGH' | 'MEDIUM' | 'LOW'
  status:        'PENDING' | 'APPROVED' | 'REJECTED'
  metadata:      Record<string, unknown>
  actions: {
    approveUrl: string
    rejectUrl:  string
    detailUrl:  string
  }
}

// ─── Helper: get direct report employeeIds ────────────────

async function getDirectReportIds(employeeId: string): Promise<string[]> {
  const asgn = await prisma.employeeAssignment.findFirst({
    where: { employeeId, isPrimary: true, endDate: null },
    select: { positionId: true },
  })
  if (!asgn?.positionId) return []

  const reports = await prisma.employeeAssignment.findMany({
    where: {
      position: { reportsToPositionId: asgn.positionId },
      isPrimary: true,
      endDate: null,
    },
    select: { employeeId: true },
  })
  return reports.map((r) => r.employeeId)
}

// ─── Route Handler ────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return apiError(unauthorized())
    const user = session.user as SessionUser

    const { searchParams } = req.nextUrl
    const moduleFilter  = searchParams.get('module')  // LEAVE | PERFORMANCE | PAYROLL | null=ALL
    const statusFilter  = searchParams.get('status')  // PENDING | APPROVED | REJECTED | null=PENDING
    const countOnly     = searchParams.get('countOnly') === 'true'
    const historyDays   = parseInt(searchParams.get('days') ?? '30', 10)

    // default: show PENDING
    const showPending   = !statusFilter || statusFilter === 'PENDING'
    const showCompleted = statusFilter === 'APPROVED' || statusFilter === 'REJECTED' || statusFilter === 'ALL'

    const companyId     = user.companyId
    const employeeId    = user.employeeId
    const isHrUp        = [ROLE.HR_ADMIN, ROLE.SUPER_ADMIN].includes(user.role as never)
    const isManagerUp   = [ROLE.MANAGER, ROLE.EXECUTIVE, ROLE.HR_ADMIN, ROLE.SUPER_ADMIN].includes(user.role as never)

    // Direct reports (for MANAGER — only see their team's requests)
    const reportIds = isManagerUp && !isHrUp
      ? await getDirectReportIds(employeeId)
      : null   // HR_ADMIN sees all

    const items: ApprovalItem[] = []

    // ── 1. Leave Requests ─────────────────────────────────

    if (!moduleFilter || moduleFilter === 'LEAVE') {
      const leaveStatuses: string[] = []
      if (showPending)   leaveStatuses.push('PENDING')
      if (showCompleted) { leaveStatuses.push('APPROVED', 'REJECTED') }

      if (leaveStatuses.length > 0) {
        const cutoff = showCompleted && !showPending
          ? new Date(Date.now() - historyDays * 86400_000)
          : undefined

        const leaves = await prisma.leaveRequest.findMany({
          where: {
            companyId,
            status: { in: leaveStatuses as ('PENDING' | 'APPROVED' | 'REJECTED')[] },
            ...(reportIds ? { employeeId: { in: reportIds } } : {}),
            ...(cutoff ? { updatedAt: { gte: cutoff } } : {}),
          },
          include: {
            employee: {
              select: {
                name: true,
                assignments: {
                  where: { isPrimary: true, endDate: null },
                  select: { department: { select: { name: true } } },
                  take: 1,
                },
              },
            },
            policy: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 100,
        })

        for (const lr of leaves) {
          const dept = lr.employee.assignments?.[0]?.department?.name ?? '-'
          const start = new Date(lr.startDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
          const end   = new Date(lr.endDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
          const days  = Number(lr.days)

          items.push({
            id:            `leave:${lr.id}`,
            module:        'LEAVE',
            type:          'LEAVE_REQUEST',
            title:         `${lr.employee.name} — ${lr.policy.name} ${days}일 (${start}~${end})`,
            description:   lr.reason ?? '사유 없음',
            requesterId:   lr.employeeId,
            requesterName: lr.employee.name,
            requesterDept: dept,
            createdAt:     lr.createdAt.toISOString(),
            dueDate:       lr.startDate.toISOString(),
            priority:      days >= 3 ? 'HIGH' : 'MEDIUM',
            status:        lr.status as 'PENDING' | 'APPROVED' | 'REJECTED',
            metadata:      { leaveRequestId: lr.id, days, policyName: lr.policy.name },
            actions: {
              approveUrl: `/api/v1/leave/requests/${lr.id}/approve`,
              rejectUrl:  `/api/v1/leave/requests/${lr.id}/reject`,
              detailUrl:  `/leave/team`,
            },
          })
        }
      }
    }

    // ── 2. MBO Goals (Performance review) ────────────────

    if (!moduleFilter || moduleFilter === 'PERFORMANCE') {
      const goalStatuses: string[] = []
      if (showPending)   goalStatuses.push('PENDING_APPROVAL')
      if (showCompleted) goalStatuses.push('APPROVED', 'REJECTED')

      if (goalStatuses.length > 0) {
        const cutoff = showCompleted && !showPending
          ? new Date(Date.now() - historyDays * 86400_000)
          : undefined

        const goals = await prisma.mboGoal.findMany({
          where: {
            companyId,
            status: { in: goalStatuses as never[] },
            ...(reportIds ? { employeeId: { in: reportIds } } : {}),
            ...(cutoff ? { updatedAt: { gte: cutoff } } : {}),
          },
          select: {
            id:         true,
            title:      true,
            weight:     true,
            status:     true,
            employeeId: true,
            createdAt:  true,
            updatedAt:  true,
            employee: {
              select: {
                name: true,
                assignments: {
                  where: { isPrimary: true, endDate: null },
                  select: { department: { select: { name: true } } },
                  take: 1,
                },
              },
            },
            cycle: { select: { name: true, evalEnd: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 100,
        })

        for (const g of goals) {
          const dept = g.employee.assignments?.[0]?.department?.name ?? '-'
          const rawStatus = g.status as string
          const mappedStatus: 'PENDING' | 'APPROVED' | 'REJECTED' =
            rawStatus === 'PENDING_APPROVAL' ? 'PENDING'
            : rawStatus === 'APPROVED' ? 'APPROVED'
            : 'REJECTED'

          items.push({
            id:            `goal:${g.id}`,
            module:        'PERFORMANCE',
            type:          'MBO_GOAL_REVIEW',
            title:         `${g.employee.name} — MBO 목표 검토 (${g.cycle.name})`,
            description:   g.title,
            requesterId:   g.employeeId,
            requesterName: g.employee.name,
            requesterDept: dept,
            createdAt:     g.createdAt.toISOString(),
            dueDate:       g.cycle.evalEnd?.toISOString() ?? null,
            priority:      'MEDIUM',
            status:        mappedStatus,
            metadata:      { goalId: g.id, cycleName: g.cycle.name, weight: Number(g.weight) },
            actions: {
              approveUrl: `/api/v1/performance/goals/${g.id}/approve`,
              rejectUrl:  `/api/v1/performance/goals/${g.id}/reject`,
              detailUrl:  `/performance/goals`,
            },
          })
        }
      }
    }


    // ── 3. Payroll Runs (HR_ADMIN only) ──────────────────

    if (isHrUp && (!moduleFilter || moduleFilter === 'PAYROLL')) {
      const payrollStatuses: string[] = []
      if (showPending)   payrollStatuses.push('REVIEW')
      if (showCompleted) payrollStatuses.push('APPROVED', 'PAID')

      if (payrollStatuses.length > 0) {
        const runs = await prisma.payrollRun.findMany({
          where: {
            companyId,
            status: { in: payrollStatuses as never[] },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        })

        for (const run of runs) {
          const rawStatus = run.status as string
          const mappedStatus: 'PENDING' | 'APPROVED' | 'REJECTED' =
            rawStatus === 'REVIEW' ? 'PENDING'
            : rawStatus === 'APPROVED' || rawStatus === 'PAID' ? 'APPROVED'
            : 'REJECTED'

          items.push({
            id:            `payroll:${run.id}`,
            module:        'PAYROLL',
            type:          'PAYROLL_APPROVAL',
            title:         `${run.yearMonth} 급여 승인`,
            description:   `급여 실행 승인 대기 중`,
            requesterId:   run.approvedBy ?? '',
            requesterName: '급여팀',
            requesterDept: 'HR',
            createdAt:     run.createdAt.toISOString(),
            dueDate:       null,
            priority:      'HIGH',
            status:        mappedStatus,
            metadata:      { payrollRunId: run.id, yearMonth: run.yearMonth },
            actions: {
              approveUrl: `/api/v1/payroll/runs/${run.id}/approve`,
              rejectUrl:  `/api/v1/payroll/runs/${run.id}/reject`,
              detailUrl:  `/payroll/runs/${run.id}`,
            },
          })
        }
      }
    }

    // ── Count-only mode (for sidebar badge) ──────────────

    const pendingCount = items.filter((i) => i.status === 'PENDING').length

    if (countOnly) {
      return apiSuccess({ count: pendingCount })
    }

    // Sort: PENDING first, then by createdAt desc
    items.sort((a, b) => {
      if (a.status === 'PENDING' && b.status !== 'PENDING') return -1
      if (b.status === 'PENDING' && a.status !== 'PENDING') return 1
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    return apiSuccess({ items, pendingCount })
  } catch (error) {
    return apiError(error)
  }
}
