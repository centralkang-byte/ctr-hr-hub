// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Severance Interim Detail & Review
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { severanceInterimUpdateSchema } from '@/lib/schemas/compliance'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (_req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const payment = await prisma.severanceInterimPayment.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        employee: { select: { id: true, name: true, employeeNo: true, hireDate: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    })
    if (!payment) throw badRequest('Payment not found')

    return apiSuccess({
      ...payment,
      amount: payment.amount ? Number(payment.amount) : null,
      yearsOfService: payment.yearsOfService ? Number(payment.yearsOfService) : null,
      avgSalary: payment.avgSalary ? Number(payment.avgSalary) : null,
    })
  },
  perm(MODULE.COMPLIANCE, ACTION.VIEW),
)

export const PUT = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const body: unknown = await req.json()
    const parsed = severanceInterimUpdateSchema.safeParse(body)
    if (!parsed.success) throw badRequest('Invalid request data', { issues: parsed.error.issues })

    const existing = await prisma.severanceInterimPayment.findFirst({
      where: { id, companyId: user.companyId },
    })
    if (!existing) throw badRequest('Payment not found')

    try {
      const updated = await prisma.severanceInterimPayment.update({
        where: { id },
        data: {
          status: parsed.data.status,
          rejectionReason: parsed.data.rejectionReason,
          ...(parsed.data.status === 'SIP_APPROVED' ? {
            approvedById: user.employeeId,
            approvedAt: new Date(),
          } : {}),
          ...(parsed.data.status === 'SIP_PAID' ? {
            paidAt: new Date(),
          } : {}),
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'compliance.kr.severance-interim.review',
        resourceType: 'severanceInterimPayment',
        resourceId: id,
        companyId: user.companyId,
        changes: { status: parsed.data.status },
        ip, userAgent,
      })

      return apiSuccess({
        ...updated,
        amount: updated.amount ? Number(updated.amount) : null,
        yearsOfService: updated.yearsOfService ? Number(updated.yearsOfService) : null,
        avgSalary: updated.avgSalary ? Number(updated.avgSalary) : null,
      })
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.COMPLIANCE, ACTION.APPROVE),
)
