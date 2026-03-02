import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { z } from 'zod'
import type { SessionUser } from '@/types'

// ─── Update schema (inline, only updatable fields) ───────

const payItemUpdateSchema = z.object({
  amount: z.number().optional(),
  effectiveTo: z.string().date().optional().nullable(),
  note: z.string().max(500).optional().nullable(),
})

// ─── PUT /api/v1/payroll/employees/[id]/pay-items/[itemId]
// Update amount, effectiveTo, note

export const PUT = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id: employeeId, itemId } = await context.params
    const body: unknown = await req.json()
    const parsed = payItemUpdateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const companyFilter = user.role === 'SUPER_ADMIN' ? {} : { companyId: user.companyId }

    try {
      const existing = await prisma.employeePayItem.findFirst({
        where: { id: itemId, employeeId, ...companyFilter },
      })
      if (!existing) throw notFound('급여 항목을 찾을 수 없습니다.')

      const result = await prisma.employeePayItem.update({
        where: { id: itemId },
        data: {
          ...(parsed.data.amount !== undefined && { amount: parsed.data.amount }),
          ...(parsed.data.effectiveTo !== undefined && {
            effectiveTo: parsed.data.effectiveTo ? new Date(parsed.data.effectiveTo) : null,
          }),
          ...(parsed.data.note !== undefined && { note: parsed.data.note }),
        },
        include: {
          allowanceType: {
            select: { id: true, code: true, name: true, category: true },
          },
          deductionType: {
            select: { id: true, code: true, name: true, category: true },
          },
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'payroll.employee-pay-item.update',
        resourceType: 'employeePayItem',
        resourceId: result.id,
        companyId: result.companyId,
        ip,
        userAgent,
        changes: { targetEmployeeId: employeeId },
      })

      return apiSuccess(result)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.PAYROLL, ACTION.UPDATE),
)

// ─── DELETE /api/v1/payroll/employees/[id]/pay-items/[itemId]
// Hard delete the pay item

export const DELETE = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id: employeeId, itemId } = await context.params
    const companyFilter = user.role === 'SUPER_ADMIN' ? {} : { companyId: user.companyId }

    try {
      const existing = await prisma.employeePayItem.findFirst({
        where: { id: itemId, employeeId, ...companyFilter },
      })
      if (!existing) throw notFound('급여 항목을 찾을 수 없습니다.')

      await prisma.employeePayItem.delete({
        where: { id: itemId },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'payroll.employee-pay-item.delete',
        resourceType: 'employeePayItem',
        resourceId: itemId,
        companyId: existing.companyId,
        ip,
        userAgent,
        changes: { targetEmployeeId: employeeId },
      })

      return apiSuccess({ id: itemId })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.PAYROLL, ACTION.DELETE),
)
