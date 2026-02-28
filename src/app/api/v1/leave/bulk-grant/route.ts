import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { leaveBalanceBulkGrantSchema } from '@/lib/schemas/leave'
import type { SessionUser } from '@/types'

// ─── POST /api/v1/leave/bulk-grant ───────────────────────
// Bulk grant leave balances to multiple employees

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

    try {
      const result = await prisma.$transaction(async (tx) => {
        const results = []

        for (const employeeId of parsed.data.employeeIds) {
          // Check if balance already exists for this employee+policy+year
          const existing = await tx.employeeLeaveBalance.findFirst({
            where: {
              employeeId,
              policyId: parsed.data.policyId,
              year: parsed.data.year,
            },
          })

          if (existing) {
            // Add to existing balance
            const updated = await tx.employeeLeaveBalance.update({
              where: { id: existing.id },
              data: { grantedDays: { increment: parsed.data.days } },
            })
            results.push(updated)
          } else {
            // Create new balance
            const created = await tx.employeeLeaveBalance.create({
              data: {
                employeeId,
                policyId: parsed.data.policyId,
                year: parsed.data.year,
                grantedDays: parsed.data.days,
                usedDays: 0,
                pendingDays: 0,
                carryOverDays: 0,
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
        resourceType: 'employeeLeaveBalance',
        resourceId: parsed.data.policyId,
        companyId: policy.companyId,
        changes: {
          policyId: parsed.data.policyId,
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
