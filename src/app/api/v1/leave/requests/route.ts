// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Leave Requests API
// GET  /api/v1/leave/requests  — My leave requests
// POST /api/v1/leave/requests  — Create leave request
//
// F-3 Enhancements:
//   - Negative balance (마이너스 연차) support
//   - Advance booking + consecutive limit validation
//   - Team simultaneous absence warning
//   - Concurrency guard ($transaction)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { leaveRequestCreateSchema } from '@/lib/schemas/leave'
import { fetchPrimaryAssignment } from '@/lib/employee/assignment-helpers'
import type { SessionUser } from '@/types'

// ─── GET: My leave requests ──────────────────────────────

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const page = Math.max(1, Number(searchParams.get('page') ?? 1))
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 20)))
    const skip = (page - 1) * limit

    const where = {
      employeeId: user.employeeId,
      ...(status ? { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' } : {}),
    }

    const [requests, total] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        include: {
          policy: { select: { name: true, leaveType: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.leaveRequest.count({ where }),
    ])

    return apiPaginated(requests, buildPagination(page, limit, total))
  },
  perm(MODULE.LEAVE, ACTION.VIEW),
)

// ─── Helpers ─────────────────────────────────────────────

function differenceInBusinessDays(start: Date, end: Date): number {
  let count = 0
  const current = new Date(start)
  while (current <= end) {
    const day = current.getDay()
    if (day !== 0 && day !== 6) count++
    current.setDate(current.getDate() + 1)
  }
  return count
}

// ─── POST: Create leave request ──────────────────────────

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body = await req.json()
    const parsed = leaveRequestCreateSchema.safeParse(body)

    if (!parsed.success) {
      throw badRequest('입력값이 올바르지 않습니다.', {
        issues: parsed.error.issues,
      })
    }

    const startDate = new Date(parsed.data.startDate)
    const endDate = new Date(parsed.data.endDate)
    const now = new Date()
    const warnings: string[] = []

    // B-3h: 겸직자도 Primary Assignment의 법인 기준으로만 휴가 차감
    const primaryAssignment = await fetchPrimaryAssignment(user.employeeId)
    const primaryCompanyId = primaryAssignment?.companyId ?? user.companyId

    // ── F-3: LeaveTypeDef validation (minAdvanceDays, maxConsecutiveDays) ───

    // Try to get LeaveTypeDef via policy → leaveType matching
    const policy = await prisma.leavePolicy.findUnique({
      where: { id: parsed.data.policyId },
      select: { leaveType: true, companyId: true },
    })

    if (policy) {
      const leaveTypeDef = await prisma.leaveTypeDef.findFirst({
        where: {
          OR: [
            { companyId: policy.companyId, isActive: true },
            { companyId: null, isActive: true },
          ],
        },
        orderBy: { companyId: 'desc' }, // company-specific first
        select: { minAdvanceDays: true, maxConsecutiveDays: true },
      })

      if (leaveTypeDef) {
        // Rule 1: Minimum advance booking (사전 신청 기간)
        if (leaveTypeDef.minAdvanceDays && leaveTypeDef.minAdvanceDays > 0) {
          const daysUntilStart = Math.floor(
            (startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
          )
          if (daysUntilStart < leaveTypeDef.minAdvanceDays) {
            throw badRequest(
              `이 휴가 유형은 최소 ${leaveTypeDef.minAdvanceDays}일 전에 신청해야 합니다.`,
            )
          }
        }

        // Rule 2: Maximum consecutive days (연속 상한)
        if (leaveTypeDef.maxConsecutiveDays && leaveTypeDef.maxConsecutiveDays > 0) {
          const businessDays = differenceInBusinessDays(startDate, endDate)
          if (businessDays > leaveTypeDef.maxConsecutiveDays) {
            throw badRequest(
              `최대 연속 ${leaveTypeDef.maxConsecutiveDays}일까지 신청할 수 있습니다.`,
            )
          }
        }
      }
    }

    // ── F-3: Half-day duplicate warning (반차+반차=1일) ──

    if (parsed.data.halfDayType) {
      const existingHalfDay = await prisma.leaveRequest.findFirst({
        where: {
          employeeId: user.employeeId,
          startDate,
          status: { in: ['PENDING', 'APPROVED'] },
          halfDayType: { not: null },
        },
      })

      if (existingHalfDay && existingHalfDay.halfDayType !== parsed.data.halfDayType) {
        warnings.push('같은 날 오전/오후 반차가 모두 신청되어 종일 휴가로 합산됩니다.')
      }
    }

    // ── Balance check + Negative balance + Transaction ──────

    const result = await prisma.$transaction(async (tx) => {
      // 1. Read balance INSIDE transaction (isolation)
      const balance = await tx.employeeLeaveBalance.findFirst({
        where: {
          employeeId: user.employeeId,
          policyId: parsed.data.policyId,
          year: new Date().getFullYear(),
        },
      })

      if (!balance) {
        throw badRequest('해당 휴가 유형의 잔여일이 없습니다.')
      }

      const totalAvailable =
        Number(balance.grantedDays) +
        Number(balance.carryOverDays) -
        Number(balance.usedDays) -
        Number(balance.pendingDays)

      // 2. Check if request exceeds available
      if (parsed.data.days > totalAvailable) {
        // 3. Check negative balance policy (B-3h: Primary 법인 기준)
        const leaveSetting = await tx.leaveSetting.findFirst({
          where: { companyId: primaryCompanyId },
        })

        const allowNegative = leaveSetting?.allowNegativeBalance ?? false
        const negativeLimit = leaveSetting?.negativeBalanceLimit ?? 0

        if (!allowNegative) {
          throw badRequest(
            `잔여 휴가가 부족합니다. (잔여: ${totalAvailable}일, 신청: ${parsed.data.days}일)`,
          )
        }

        // 4. Check negative limit
        const wouldBeRemaining = totalAvailable - parsed.data.days // negative number
        if (wouldBeRemaining < negativeLimit) {
          throw badRequest(
            `마이너스 연차 한도(${Math.abs(negativeLimit)}일)를 초과합니다. 현재 사용 가능: ${totalAvailable + Math.abs(negativeLimit)}일`,
          )
        }

        // 5. Add warning for negative usage
        const negativeUsed = parsed.data.days - totalAvailable
        warnings.push(
          `마이너스 연차 ${negativeUsed}일이 사용됩니다. 다음 연도 부여 시 자동 차감됩니다.`,
        )
      }

      // 6. Create request (B-3h: Primary 법인 기준으로 생성)
      const request = await tx.leaveRequest.create({
        data: {
          employeeId: user.employeeId,
          companyId: primaryCompanyId,
          policyId: parsed.data.policyId,
          startDate,
          endDate,
          days: parsed.data.days,
          halfDayType: parsed.data.halfDayType ?? null,
          reason: parsed.data.reason,
          status: 'PENDING',
        },
      })

      // 7. Atomic increment pendingDays
      await tx.employeeLeaveBalance.update({
        where: { id: balance.id },
        data: { pendingDays: { increment: parsed.data.days } },
      })

      return request
    })

    // ── F-3: Team simultaneous absence warning ──────────────

    try {
      // Count team members on leave during the same period
      const teamAbsences = await prisma.leaveRequest.count({
        where: {
          companyId: primaryCompanyId,
          employeeId: { not: user.employeeId },
          status: { in: ['PENDING', 'APPROVED'] },
          startDate: { lte: endDate },
          endDate: { gte: startDate },
          // Same approver = same team
          approvedBy: {
            not: null,
          },
        },
      })

      if (teamAbsences >= 2) {
        warnings.push(
          `⚠️ 이 기간 다른 팀원 ${teamAbsences}명이 부재 예정입니다. 매니저의 반려 가능성이 있습니다.`,
        )
      }
    } catch {
      // Non-blocking: warning failure shouldn't block request creation
    }

    // ── Audit log ──

    const meta = extractRequestMeta(req.headers)
    logAudit({
      actorId: user.employeeId,
      action: 'leave.request.create',
      resourceType: 'LeaveRequest',
      resourceId: result.id,
      companyId: primaryCompanyId,
      changes: {
        policyId: parsed.data.policyId,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        days: parsed.data.days,
      },
      ...meta,
    })

    return apiSuccess(
      {
        ...result,
        warnings: warnings.length > 0 ? warnings : undefined,
      },
      201,
    )
  },
  perm(MODULE.LEAVE, ACTION.CREATE),
)
