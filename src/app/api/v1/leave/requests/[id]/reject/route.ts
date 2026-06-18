// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Leave Request Reject API
// PUT /api/v1/leave/requests/[id]/reject
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
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
import { getLeaveBalanceYear } from '@/lib/leave/leaveBalanceYear'
import type { SessionUser } from '@/types'

const rejectionSchema = z.object({
  rejectionReason: z.string().min(1, '반려 사유를 입력해주세요').max(500),
})

export const PUT = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params

    // 1. Parse rejection reason
    const body = await req.json()
    const parsed = rejectionSchema.safeParse(body)

    if (!parsed.success) {
      throw badRequest('반려 사유를 입력해주세요.', {
        issues: parsed.error.issues,
      })
    }

    // 2. Find PENDING request — scope to caller's company (prevents IDOR)
    const request = await prisma.leaveRequest.findFirst({
      where: { id, status: 'PENDING', companyId: user.companyId },
    })

    if (!request) {
      throw notFound('승인 대기 중인 휴가 신청을 찾을 수 없습니다.')
    }

    // F-2: Delegation check
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
        throw badRequest('이 휴가 신청에 대한 반려 권한이 없습니다.')
      }
      delegatedById = user.employeeId
    }

    // 3. Resolve leaveTypeDefId + find balance (LeaveYearBalance)
    const leaveTypeDefId = request.leaveTypeDefId
      ?? await resolveLeaveTypeDefId(request.policyId)

    if (!leaveTypeDefId) {
      throw badRequest('해당 휴가 유형 정의를 찾을 수 없습니다.')
    }

    // 적립형(잔액 추적) vs 이벤트형 판별 — 이벤트형은 잔액 복구 없이 반려
    const usesBalance = await leaveTypeUsesBalance(leaveTypeDefId)
    const days = Number(request.days)

    let updated: Awaited<ReturnType<typeof prisma.leaveRequest.update>>
    let updatedBalance: Awaited<ReturnType<typeof prisma.leaveYearBalance.findUnique>> = null

    if (usesBalance) {
      // 잔액 복구는 시작일의 연도 행 (approve/create와 일관 — SSOT)
      const balance = await prisma.leaveYearBalance.findFirst({
        where: {
          employeeId: request.employeeId,
          leaveTypeDefId,
          year: getLeaveBalanceYear(request.startDate),
        },
      })

      if (!balance) {
        throw badRequest('해당 휴가 유형의 잔여일 정보를 찾을 수 없습니다.')
      }

      // Transaction: claim(PENDING→REJECTED) + restore pending (direct, not via event)
      updated = await prisma.$transaction(async (tx) => {
        // Claim — status 조건이 동시/이중 반려를 직렬화 (pending 이중 복구 방지)
        const claim = await tx.leaveRequest.updateMany({
          where: { id, status: 'PENDING', companyId: user.companyId },
          data: {
            status:          'REJECTED',
            rejectionReason: parsed.data.rejectionReason,
            approvedById:    request.approvedById ?? user.employeeId,
            approvedAt:      new Date(),
            delegatedById:   delegatedById,
          },
        })
        if (claim.count === 0) {
          throw badRequest('이미 처리된 휴가 신청입니다.')
        }

        // Restore pending (used unchanged for rejection)
        await tx.leaveYearBalance.update({
          where: { id: balance.id },
          data: { pending: { decrement: days } },
        })

        const rejected = await tx.leaveRequest.findUnique({ where: { id } })
        if (!rejected) {
          throw notFound('휴가 신청을 찾을 수 없습니다.')
        }
        return rejected
      })

      // Fetch updated balance for response
      updatedBalance = await prisma.leaveYearBalance.findUnique({
        where: { id: balance.id },
      })
    } else {
      // 이벤트형: 잔액 없음. status 조건부 전이(updateMany)로 이중 처리 방지
      const res = await prisma.leaveRequest.updateMany({
        where: { id, status: 'PENDING', companyId: user.companyId },
        data: {
          status:          'REJECTED',
          rejectionReason: parsed.data.rejectionReason,
          approvedById:    request.approvedById ?? user.employeeId,
          approvedAt:      new Date(),
          delegatedById:   delegatedById,
        },
      })
      if (res.count === 0) {
        throw badRequest('이미 처리된 휴가 신청입니다.')
      }
      const refreshed = await prisma.leaveRequest.findUnique({ where: { id } })
      if (!refreshed) {
        throw notFound('휴가 신청을 찾을 수 없습니다.')
      }
      updated = refreshed
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
      action:       'leave.request.reject',
      resourceType: 'LeaveRequest',
      resourceId:   id,
      companyId:    request.companyId,
      changes: {
        status:          'REJECTED',
        rejectionReason: parsed.data.rejectionReason,
        approvedById:      user.employeeId,
      },
      ...meta,
    })

    // 7. Fire-and-forget notification (sent directly to avoid double balance update)
    void sendNotification({
      employeeId:  request.employeeId,
      triggerType: 'leave_rejected',
      title:       '휴가 신청이 반려되었습니다',
      body:        `반려 사유: ${parsed.data.rejectionReason}`,
      titleKey:    'notifications.leaveRejected.title',
      bodyKey:     'notifications.leaveRejected.body',
      bodyParams:  { reason: parsed.data.rejectionReason },
      link:        '/leave',
      priority:    'normal',
    })

    // 캐시 무효화
    void invalidateMultiple(
      [CACHE_STRATEGY.DASHBOARD_KPI, CACHE_STRATEGY.SIDEBAR],
      request.companyId,
    )

    return apiSuccess({
      request: updated,
      // 이벤트형은 잔액 미추적 → balance: null (영값으로 remaining 0 오해 방지)
      balance: updatedBalance
        ? {
            entitled:  updatedBalance.entitled,
            used:      updatedBalance.used,
            pending:   updatedBalance.pending,
            remaining,
          }
        : null,
    })
  },
  perm(MODULE.LEAVE, ACTION.UPDATE),
)
