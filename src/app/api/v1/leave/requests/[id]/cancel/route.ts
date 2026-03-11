// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Leave Request Cancel API (F-3 Enhanced)
// PUT /api/v1/leave/requests/[id]/cancel
//
// 3 scenarios:
//   A. PENDING → anyone (employee self / HR)
//   B. APPROVED, before start → employee + HR
//   C. APPROVED, after start  → HR only, partial restore
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, forbidden } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { eventBus, DOMAIN_EVENTS } from '@/lib/events'
import type { SessionUser } from '@/types'

// ─── Helper: HR_ADMIN or above ───────────────────────────

function isHrOrAbove(role: string): boolean {
  return (['HR_ADMIN', 'EXECUTIVE', 'SUPER_ADMIN'] as string[]).includes(role)
}

// ─── Helper: Calculate business days used (for partial cancel) ───

function calculateActualUsedDays(startDate: Date, untilDate: Date): number {
  let count = 0
  const current = new Date(startDate)
  const end = new Date(untilDate)
  // Don't count today (partially used)
  end.setDate(end.getDate() - 1)
  while (current <= end) {
    const day = current.getDay()
    if (day !== 0 && day !== 6) count++
    current.setDate(current.getDate() + 1)
  }
  return Math.max(count, 0)
}

// ─── PUT Handler ─────────────────────────────────────────

export const PUT = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const body = await req.json().catch(() => ({}))
    const cancelReason = (body as { reason?: string })?.reason ?? null

    // 1. Find request (no ownership filter — HR can cancel others')
    const request = await prisma.leaveRequest.findFirst({
      where: { id },
    })

    if (!request) {
      throw notFound('휴가 신청을 찾을 수 없습니다.')
    }

    // 2. Already terminal status
    if (request.status === 'CANCELLED' || request.status === 'REJECTED') {
      throw badRequest('이미 취소되었거나 반려된 신청은 취소할 수 없습니다.')
    }

    const now = new Date()
    const requestStart = new Date(request.startDate)
    const isOwner = request.employeeId === user.employeeId
    const isHr = isHrOrAbove(user.role)

    // ── Scenario A: PENDING ─────────────────────────────

    if (request.status === 'PENDING') {
      if (!isOwner && !isHr) {
        throw forbidden('본인의 신청만 취소할 수 있습니다.')
      }

      // PENDING → no usedDays change, only pendingDays decrement
      const updated = await prisma.$transaction(async (tx) => {
        const cancelled = await tx.leaveRequest.update({
          where: { id },
          data: {
            status: 'CANCELLED',
            cancelledBy: user.employeeId,
            cancelNote: cancelReason,
          },
        })

        // Restore pendingDays
        const balance = await findBalance(tx, request)
        if (balance) {
          await tx.employeeLeaveBalance.update({
            where: { id: balance.id },
            data: { pendingDays: { decrement: Number(request.days) } },
          })
        }

        return cancelled
      })

      // Fire event
      const ctx = { companyId: request.companyId, actorId: user.employeeId, occurredAt: now }
      void eventBus.publish(DOMAIN_EVENTS.LEAVE_CANCELLED, {
        ctx,
        requestId: request.id,
        employeeId: request.employeeId,
        policyId: request.policyId,
        balanceId: '',
        days: Number(request.days),
        previousStatus: 'PENDING' as const,
      })

      await auditCancel(req, user, request, 'PENDING_CANCEL', 0)

      return apiSuccess({
        ...updated,
        cancelType: 'PENDING_CANCEL',
        balanceRestored: 0,
        message: '대기 중인 신청이 취소되었습니다.',
      })
    }

    // ── Scenario B: APPROVED, before start date ──────────

    if (request.status === 'APPROVED' && requestStart > now) {
      if (!isOwner && !isHr) {
        throw forbidden('본인의 신청만 취소할 수 있습니다.')
      }

      const daysToRestore = Number(request.days)

      const updated = await prisma.$transaction(async (tx) => {
        const cancelled = await tx.leaveRequest.update({
          where: { id },
          data: {
            status: 'CANCELLED',
            cancelledBy: user.employeeId,
            cancelNote: cancelReason ?? `시작 전 취소: ${daysToRestore}일 전액 복구`,
          },
        })

        // Restore full usedDays
        const balance = await findBalance(tx, request)
        if (balance) {
          await tx.employeeLeaveBalance.update({
            where: { id: balance.id },
            data: { usedDays: { decrement: daysToRestore } },
          })
        }

        return cancelled
      })

      const ctx = { companyId: request.companyId, actorId: user.employeeId, occurredAt: now }
      void eventBus.publish(DOMAIN_EVENTS.LEAVE_CANCELLED, {
        ctx,
        requestId: request.id,
        employeeId: request.employeeId,
        policyId: request.policyId,
        balanceId: '',
        days: Number(request.days),
        previousStatus: 'APPROVED' as const,
      })

      await auditCancel(req, user, request, 'PRE_START_CANCEL', daysToRestore)

      return apiSuccess({
        ...updated,
        cancelType: 'PRE_START_CANCEL',
        balanceRestored: daysToRestore,
        message: `승인된 휴가가 취소되었습니다. ${daysToRestore}일이 복구되었습니다.`,
      })
    }

    // ── Scenario C: APPROVED, after start date (HR only) ─

    if (request.status === 'APPROVED' && requestStart <= now) {
      if (!isHr) {
        throw forbidden('휴가 시작 후에는 HR 관리자만 취소할 수 있습니다.')
      }

      const actualUsed = calculateActualUsedDays(requestStart, now)
      const totalDays = Number(request.days)
      const unusedDays = Math.max(totalDays - actualUsed, 0)

      const updated = await prisma.$transaction(async (tx) => {
        const cancelled = await tx.leaveRequest.update({
          where: { id },
          data: {
            status: 'CANCELLED',
            cancelledBy: user.employeeId,
            cancelNote: cancelReason ?? `시작 후 취소: ${actualUsed}일 사용, ${unusedDays}일 복구`,
          },
        })

        // Partial restore: only unused portion
        if (unusedDays > 0) {
          const balance = await findBalance(tx, request)
          if (balance) {
            await tx.employeeLeaveBalance.update({
              where: { id: balance.id },
              data: { usedDays: { decrement: unusedDays } },
            })
          }
        }

        return cancelled
      })

      const ctx = { companyId: request.companyId, actorId: user.employeeId, occurredAt: now }
      void eventBus.publish(DOMAIN_EVENTS.LEAVE_CANCELLED, {
        ctx,
        requestId: request.id,
        employeeId: request.employeeId,
        policyId: request.policyId,
        balanceId: '',
        days: Number(request.days),
        previousStatus: 'APPROVED' as const,
      })

      await auditCancel(req, user, request, 'POST_START_CANCEL', unusedDays)

      return apiSuccess({
        ...updated,
        cancelType: 'POST_START_CANCEL',
        actualUsed,
        balanceRestored: unusedDays,
        message: `시작 후 취소: ${actualUsed}일 사용 처리, ${unusedDays}일 복구되었습니다.`,
      })
    }

    throw badRequest('취소할 수 없는 상태입니다.')
  },
  perm(MODULE.LEAVE, ACTION.VIEW),
)

// ─── Internal Helpers ────────────────────────────────────

type TxPrisma = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

async function findBalance(
  tx: TxPrisma,
  request: { employeeId: string; policyId: string; startDate: Date; endDate: Date },
) {
  const startYear = new Date(request.startDate).getFullYear()
  const endYear = new Date(request.endDate).getFullYear()

  let balance = await tx.employeeLeaveBalance.findFirst({
    where: {
      employeeId: request.employeeId,
      policyId: request.policyId,
      year: startYear,
    },
  })

  if (!balance && endYear !== startYear) {
    balance = await tx.employeeLeaveBalance.findFirst({
      where: {
        employeeId: request.employeeId,
        policyId: request.policyId,
        year: endYear,
      },
    })
  }

  return balance
}

async function auditCancel(
  req: NextRequest,
  user: SessionUser,
  request: { id: string; status: string; companyId: string },
  cancelType: string,
  balanceRestored: number,
) {
  const meta = extractRequestMeta(req.headers)
  logAudit({
    actorId: user.employeeId,
    action: 'leave.request.cancel',
    resourceType: 'LeaveRequest',
    resourceId: request.id,
    companyId: request.companyId,
    changes: {
      previousStatus: request.status,
      status: 'CANCELLED',
      cancelType,
      balanceRestored,
      cancelledBy: user.employeeId,
    },
    ...meta,
  })
}
