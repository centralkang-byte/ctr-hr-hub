import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { leaveBalanceBulkGrantSchema } from '@/lib/schemas/leave'
import { resolveLeaveTypeDefId } from '@/lib/leave/resolveLeaveTypeDefId'
import type { SessionUser } from '@/types'

// ─── POST /api/v1/leave/bulk-grant ───────────────────────
// Bulk grant leave balances to multiple employees (LeaveYearBalance)

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = leaveBalanceBulkGrantSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    // Verify the policy exists and belongs to user's company
    const companyFilter = user.role === 'SUPER_ADMIN' ? {} : { companyId: user.companyId }
    const policy = await prisma.leavePolicy.findFirst({
      where: {
        id: parsed.data.policyId,
        ...companyFilter,
        deletedAt: null,
      },
    })
    if (!policy) {
      throw badRequest('해당 휴가 정책을 찾을 수 없습니다.')
    }

    // Resolve policyId → leaveTypeDefId
    const leaveTypeDefId = await resolveLeaveTypeDefId(parsed.data.policyId)
    if (!leaveTypeDefId) {
      throw badRequest('해당 휴가 유형 정의를 찾을 수 없습니다.')
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const results = []

        for (const employeeId of parsed.data.employeeIds) {
          // Check if balance already exists (LeaveYearBalance)
          const existing = await tx.leaveYearBalance.findFirst({
            where: {
              employeeId,
              leaveTypeDefId,
              year: parsed.data.year,
            },
          })

          if (existing) {
            // adjusted 필드로 수동 부여분 추가
            const updated = await tx.leaveYearBalance.update({
              where: { id: existing.id },
              data: { adjusted: { increment: parsed.data.days } },
            })
            results.push(updated)
          } else {
            // Create new balance
            const created = await tx.leaveYearBalance.create({
              data: {
                employeeId,
                leaveTypeDefId,
                year: parsed.data.year,
                entitled: parsed.data.days,
                used: 0,
                pending: 0,
                carriedOver: 0,
                adjusted: 0,
              },
            })
            results.push(created)
          }
        }

        return results
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'leave.bulk_grant',
        resourceType: 'LeaveYearBalance',
        resourceId: leaveTypeDefId,
        companyId: policy.companyId,
        changes: {
          policyId: parsed.data.policyId,
          leaveTypeDefId,
          year: parsed.data.year,
          days: parsed.data.days,
          employeeCount: result.length,
        },
        ip,
        userAgent,
      })

      return apiSuccess({ grantedCount: result.length })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.LEAVE, ACTION.APPROVE),
)
