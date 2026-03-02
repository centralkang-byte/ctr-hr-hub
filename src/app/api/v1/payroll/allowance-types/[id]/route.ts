import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { payAllowanceTypeUpdateSchema } from '@/lib/schemas/payroll'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/payroll/allowance-types/[id] ────────────
// Single allowance type detail

export const GET = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const companyFilter = user.role === 'SUPER_ADMIN' ? {} : { companyId: user.companyId }

    const item = await prisma.payAllowanceType.findFirst({
      where: { id, ...companyFilter },
    })

    if (!item) throw notFound('수당 유형을 찾을 수 없습니다.')

    return apiSuccess(item)
  },
  perm(MODULE.PAYROLL, ACTION.VIEW),
)

// ─── PUT /api/v1/payroll/allowance-types/[id] ────────────
// Partial update

export const PUT = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const body: unknown = await req.json()
    const parsed = payAllowanceTypeUpdateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const companyFilter = user.role === 'SUPER_ADMIN' ? {} : { companyId: user.companyId }

    try {
      const existing = await prisma.payAllowanceType.findFirst({
        where: { id, ...companyFilter },
      })
      if (!existing) throw notFound('수당 유형을 찾을 수 없습니다.')

      const result = await prisma.payAllowanceType.update({
        where: { id },
        data: parsed.data,
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'payroll.allowance-type.update',
        resourceType: 'payAllowanceType',
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

// ─── DELETE /api/v1/payroll/allowance-types/[id] ─────────
// Soft delete (set isActive = false)

export const DELETE = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const companyFilter = user.role === 'SUPER_ADMIN' ? {} : { companyId: user.companyId }

    try {
      const existing = await prisma.payAllowanceType.findFirst({
        where: { id, ...companyFilter },
      })
      if (!existing) throw notFound('수당 유형을 찾을 수 없습니다.')

      const result = await prisma.payAllowanceType.update({
        where: { id },
        data: { isActive: false },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'payroll.allowance-type.delete',
        resourceType: 'payAllowanceType',
        resourceId: result.id,
        companyId: result.companyId,
        ip,
        userAgent,
      })

      return apiSuccess({ id: result.id, isActive: false })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.PAYROLL, ACTION.DELETE),
)
