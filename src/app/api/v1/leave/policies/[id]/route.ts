import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { leavePolicyUpdateSchema } from '@/lib/schemas/leave'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/leave/policies/[id] ─────────────────────
// Leave policy detail

export const GET = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const companyFilter = user.role === 'SUPER_ADMIN' ? {} : { companyId: user.companyId }

    const policy = await prisma.leavePolicy.findFirst({
      where: {
        id,
        ...companyFilter,
        deletedAt: null,
      },
    })

    if (!policy) throw notFound('휴가 정책을 찾을 수 없습니다.')

    return apiSuccess(policy)
  },
  perm(MODULE.LEAVE, ACTION.VIEW),
)

// ─── PUT /api/v1/leave/policies/[id] ─────────────────────
// Update leave policy

export const PUT = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const body: unknown = await req.json()
    const parsed = leavePolicyUpdateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const companyFilter = user.role === 'SUPER_ADMIN' ? {} : { companyId: user.companyId }

    try {
      const existing = await prisma.leavePolicy.findFirst({
        where: {
          id,
          ...companyFilter,
          deletedAt: null,
        },
      })
      if (!existing) throw notFound('휴가 정책을 찾을 수 없습니다.')

      const result = await prisma.leavePolicy.update({
        where: { id },
        data: {
          ...(parsed.data.name !== undefined && { name: parsed.data.name }),
          ...(parsed.data.leaveType !== undefined && { leaveType: parsed.data.leaveType as never }),
          ...(parsed.data.defaultDays !== undefined && { defaultDays: parsed.data.defaultDays }),
          ...(parsed.data.isPaid !== undefined && { isPaid: parsed.data.isPaid }),
          ...(parsed.data.carryOverAllowed !== undefined && {
            carryOverAllowed: parsed.data.carryOverAllowed,
          }),
          ...(parsed.data.maxCarryOverDays !== undefined && {
            maxCarryOverDays: parsed.data.maxCarryOverDays,
          }),
          ...(parsed.data.minTenureMonths !== undefined && {
            minTenureMonths: parsed.data.minTenureMonths,
          }),
          ...(parsed.data.minUnit !== undefined && { minUnit: parsed.data.minUnit }),
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'leave.policy.update',
        resourceType: 'leavePolicy',
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
  perm(MODULE.LEAVE, ACTION.APPROVE),
)

// ─── DELETE /api/v1/leave/policies/[id] ──────────────────
// Soft delete leave policy

export const DELETE = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const companyFilter = user.role === 'SUPER_ADMIN' ? {} : { companyId: user.companyId }

    try {
      const existing = await prisma.leavePolicy.findFirst({
        where: {
          id,
          ...companyFilter,
          deletedAt: null,
        },
      })
      if (!existing) throw notFound('휴가 정책을 찾을 수 없습니다.')

      const result = await prisma.leavePolicy.update({
        where: { id },
        data: { deletedAt: new Date() },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'leave.policy.delete',
        resourceType: 'leavePolicy',
        resourceId: result.id,
        companyId: result.companyId,
        ip,
        userAgent,
      })

      return apiSuccess({ id: result.id })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.LEAVE, ACTION.DELETE),
)
