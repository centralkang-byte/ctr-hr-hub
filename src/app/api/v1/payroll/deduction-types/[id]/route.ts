import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { payDeductionTypeUpdateSchema } from '@/lib/schemas/payroll'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/payroll/deduction-types/[id] ────────────
// Single deduction type detail

export const GET = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const companyFilter = user.role === 'SUPER_ADMIN' ? {} : { companyId: user.companyId }

    const item = await prisma.payDeductionType.findFirst({
      where: { id, ...companyFilter },
    })

    if (!item) throw notFound('공제 유형을 찾을 수 없습니다.')

    return apiSuccess(item)
  },
  perm(MODULE.PAYROLL, ACTION.VIEW),
)

// ─── PUT /api/v1/payroll/deduction-types/[id] ────────────
// Partial update

export const PUT = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const body: unknown = await req.json()
    const parsed = payDeductionTypeUpdateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const companyFilter = user.role === 'SUPER_ADMIN' ? {} : { companyId: user.companyId }

    try {
      const existing = await prisma.payDeductionType.findFirst({
        where: { id, ...companyFilter },
      })
      if (!existing) throw notFound('공제 유형을 찾을 수 없습니다.')

      const result = await prisma.payDeductionType.update({
        where: { id },
        data: parsed.data,
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'payroll.deduction-type.update',
        resourceType: 'payDeductionType',
        resourceId: result.id,
        companyId: result.companyId,
        ip,
        userAgent,
      })

      return apiSuccess(result)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.PAYROLL, ACTION.UPDATE),
)

// ─── DELETE /api/v1/payroll/deduction-types/[id] ─────────
// Soft delete (set isActive = false)

export const DELETE = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const companyFilter = user.role === 'SUPER_ADMIN' ? {} : { companyId: user.companyId }

    try {
      const existing = await prisma.payDeductionType.findFirst({
        where: { id, ...companyFilter },
      })
      if (!existing) throw notFound('공제 유형을 찾을 수 없습니다.')

      const result = await prisma.payDeductionType.update({
        where: { id },
        data: { deletedAt: new Date() },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'payroll.deduction-type.delete',
        resourceType: 'payDeductionType',
        resourceId: result.id,
        companyId: result.companyId,
        ip,
        userAgent,
      })

      return apiSuccess({ id: result.id, deletedAt: new Date() })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.PAYROLL, ACTION.DELETE),
)
