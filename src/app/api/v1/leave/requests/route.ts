// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Leave Requests API
// GET  /api/v1/leave/requests  — My leave requests
// POST /api/v1/leave/requests  — Create leave request
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { leaveRequestCreateSchema } from '@/lib/schemas/leave'
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

    // 1. Check leave balance
    const balance = await prisma.employeeLeaveBalance.findFirst({
      where: {
        employeeId: user.employeeId,
        policyId: parsed.data.policyId,
        year: new Date().getFullYear(),
      },
    })

    if (!balance) {
      throw badRequest('해당 휴가 유형의 잔여일이 없습니다.')
    }

    const remaining =
      Number(balance.grantedDays) +
      Number(balance.carryOverDays) -
      Number(balance.usedDays) -
      Number(balance.pendingDays)

    if (remaining < parsed.data.days) {
      throw badRequest(
        `잔여 휴가가 부족합니다. (잔여: ${remaining}일, 신청: ${parsed.data.days}일)`,
      )
    }

    // 2. Create request + increment pendingDays in transaction
    const result = await prisma.$transaction(async (tx) => {
      const request = await tx.leaveRequest.create({
        data: {
          employeeId: user.employeeId,
          companyId: user.companyId,
          policyId: parsed.data.policyId,
          startDate: new Date(parsed.data.startDate),
          endDate: new Date(parsed.data.endDate),
          days: parsed.data.days,
          halfDayType: parsed.data.halfDayType ?? null,
          reason: parsed.data.reason,
          status: 'PENDING',
        },
      })

      await tx.employeeLeaveBalance.update({
        where: { id: balance.id },
        data: { pendingDays: { increment: parsed.data.days } },
      })

      return request
    })

    // 3. Audit log
    const meta = extractRequestMeta(req.headers)
    logAudit({
      actorId: user.employeeId,
      action: 'leave.request.create',
      resourceType: 'LeaveRequest',
      resourceId: result.id,
      companyId: user.companyId,
      changes: {
        policyId: parsed.data.policyId,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        days: parsed.data.days,
      },
      ...meta,
    })

    return apiSuccess(result, 201)
  },
  perm(MODULE.LEAVE, ACTION.CREATE),
)
