// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Leave Request Approve API
// PUT /api/v1/leave/requests/[id]/approve
//
// Phase 6: LeaveYearBalance 기반으로 전환 (EmployeeLeaveBalance 탈피)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { sendNotification } from '@/lib/notifications'
import { checkDelegation } from '@/lib/delegation/resolve-delegatee'
import { invalidateMultiple, CACHE_STRATEGY } from '@/lib/cache'
import { resolveLeaveTypeDefId } from '@/lib/leave/resolveLeaveTypeDefId'
import { leaveTypeUsesBalance } from '@/lib/leave/eventBasedLeave'
import type { SessionUser } from '@/types'

export const PUT = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params

    // 1. Find PENDING request — scope to caller's company (prevents IDOR)
    const request = await prisma.leaveRequest.findFirst({
      where: { id, status: 'PENDING', companyId: user.companyId },
    })

    if (!request) {
      throw notFound('승인 대기 중인 휴가 신청을 찾을 수 없습니다.')
    }

    // F-2: Delegation check — if current user is not direct approver, check delegation
    let delegatedById: string | null = null
    const isDirectApprover =
      !request.approvedById ||
      request.approvedById === user.employeeId ||
      ['HR_ADMIN', 'SUPER_ADMIN'].includes(user.role)

    if (!isDirectApprover) {
      const delegationResult = await checkDelegation(
        user.employeeId,
        request.approvedById!,
        user.companyId,
        'LEAVE_ONLY',
      )
      if (!delegationResult.isDelegatee) {
        throw badRequest('이 휴가 신청에 대한 승인 권한이 없습니다.')
      }
      delegatedById = user.employeeId
    }

    // 3. Resolve leaveTypeDefId (직접 또는 policyId 경유)
    const leaveTypeDefId = request.leaveTypeDefId
      ?? await resolveLeaveTypeDefId(request.policyId)

    if (!leaveTypeDefId) {
      throw badRequest('해당 휴가 유형 정의를 찾을 수 없습니다.')
    }

    // 4. 적립형(잔액 추적) vs 이벤트형 판별 — 이벤트형은 잔액 차감 없이 승인
    const usesBalance = await leaveTypeUsesBalance(leaveTypeDefId)
    const days = Number(request.days)
    const startYear = new Date(request.startDate).getFullYear()
    const endYear   = new Date(request.endDate).getFullYear()

    let approved: Awaited<ReturnType<typeof prisma.leaveRequest.update>>
    let updatedBalance: Awaited<ReturnType<typeof prisma.leaveYearBalance.findUnique>> = null

    if (usesBalance) {
      // Atomic UPDATE: WHERE 조건이 PostgreSQL row-level lock으로 동시 승인 직렬화
      const deductResult = await prisma.$queryRaw<Array<{ id: string }>>`
        UPDATE leave_year_balances
        SET used = used + ${days},
            pending = GREATEST(pending - ${days}, 0),
            updated_at = NOW()
        WHERE employee_id = ${request.employeeId}
          AND leave_type_def_id = ${leaveTypeDefId}
          AND year IN (${startYear}, ${endYear})
          AND (used + ${days}) <= (entitled + carried_over + adjusted)
        RETURNING id
      `

      if (deductResult.length === 0) {
        const balanceExists = await prisma.leaveYearBalance.findFirst({
          where: {
            employeeId: request.employeeId,
            leaveTypeDefId,
            year: { in: [startYear, endYear] },
          },
        })
        if (!balanceExists) {
          throw badRequest('해당 휴가 유형의 잔여일 정보를 찾을 수 없습니다.')
        }
        throw badRequest('잔여 휴가일이 부족하여 승인할 수 없습니다.')
      }

      const balanceId = deductResult[0].id

      // Now approve the request (balance already deducted atomically)
      approved = await prisma.leaveRequest.update({
        where: { id },
        data: {
          status:      'APPROVED',
          approvedById:  request.approvedById ?? user.employeeId,
          approvedAt:  new Date(),
          delegatedById: delegatedById,
        },
      })

      // 5. Fetch updated balance for response
      updatedBalance = await prisma.leaveYearBalance.findUnique({
        where: { id: balanceId },
      })
    } else {
      // 이벤트형: 잔액 없음. status 조건부 전이(updateMany)로 이중 승인 직렬화
      const res = await prisma.leaveRequest.updateMany({
        where: { id, status: 'PENDING', companyId: user.companyId },
        data: {
          status:        'APPROVED',
          approvedById:  request.approvedById ?? user.employeeId,
          approvedAt:    new Date(),
          delegatedById: delegatedById,
        },
      })
      if (res.count === 0) {
        throw badRequest('이미 처리된 휴가 신청입니다.')
      }
      const refreshed = await prisma.leaveRequest.findUnique({ where: { id } })
      if (!refreshed) {
        throw notFound('휴가 신청을 찾을 수 없습니다.')
      }
      approved = refreshed
    }

    const remaining = updatedBalance
      ? updatedBalance.entitled +
        updatedBalance.carriedOver +
        updatedBalance.adjusted -
        updatedBalance.used -
        updatedBalance.pending
      : 0

    // 6. Audit log
    const meta = extractRequestMeta(req.headers)
    logAudit({
      actorId:      user.employeeId,
      action:       'leave.request.approve',
      resourceType: 'LeaveRequest',
      resourceId:   id,
      companyId:    request.companyId,
      changes: {
        status:     'APPROVED',
        approvedById: user.employeeId,
      },
      ...meta,
    })

    // 7. 캐시 무효화 — 승인자/신청자 대시보드 + 사이드바 즉시 반영
    void invalidateMultiple(
      [CACHE_STRATEGY.DASHBOARD_KPI, CACHE_STRATEGY.SIDEBAR],
      request.companyId,
    )

    // 8. Fire-and-forget notification
    void sendNotification({
      employeeId:  request.employeeId,
      triggerType: 'leave_approved',
      title:       '휴가 신청이 승인되었습니다',
      body:        `${request.startDate.toISOString().slice(0, 10)} ~ ${request.endDate.toISOString().slice(0, 10)} 휴가가 승인되었습니다.`,
      titleKey:    'notifications.leaveApproved.title',
      bodyKey:     'notifications.leaveApproved.body',
      bodyParams:  { startDate: request.startDate.toISOString().slice(0, 10), endDate: request.endDate.toISOString().slice(0, 10) },
      link:        '/leave',
      priority:    'normal',
    })

    return apiSuccess({
      request: approved,
      balance: {
        entitled:  updatedBalance?.entitled ?? 0,
        used:      updatedBalance?.used ?? 0,
        pending:   updatedBalance?.pending ?? 0,
        remaining,
      },
    })
  },
  perm(MODULE.LEAVE, ACTION.UPDATE),
)
