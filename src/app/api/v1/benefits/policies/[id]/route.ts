// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Benefit Policy Detail, Update & Delete
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { benefitPolicyUpdateSchema } from '@/lib/schemas/benefits'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/benefits/policies/[id] ─────────────────

export const GET = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params

    const policy = await prisma.benefitPolicy.findFirst({
      where: { id, companyId: user.companyId, deletedAt: null },
    })

    if (!policy) throw notFound('복리후생 정책을 찾을 수 없습니다.')

    return apiSuccess({ ...policy, amount: policy.amount ? Number(policy.amount) : null })
  },
  perm(MODULE.BENEFITS, ACTION.VIEW),
)

// ─── PUT /api/v1/benefits/policies/[id] ─────────────────

export const PUT = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const body: unknown = await req.json()
    const parsed = benefitPolicyUpdateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    try {
      const existing = await prisma.benefitPolicy.findFirst({
        where: { id, companyId: user.companyId, deletedAt: null },
      })
      if (!existing) throw notFound('복리후생 정책을 찾을 수 없습니다.')

      const data = parsed.data
      const result = await prisma.benefitPolicy.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.category !== undefined && { category: data.category }),
          ...(data.amount !== undefined && { amount: data.amount }),
          ...(data.frequency !== undefined && { frequency: data.frequency }),
          ...(data.currency !== undefined && { currency: data.currency }),
          ...(data.eligibilityRules !== undefined && { eligibilityRules: data.eligibilityRules }),
          ...(data.isTaxable !== undefined && { isTaxable: data.isTaxable }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
          ...(data.effectiveFrom !== undefined && { effectiveFrom: new Date(data.effectiveFrom) }),
          ...(data.effectiveTo !== undefined && { effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null }),
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'benefits.policy.update',
        resourceType: 'benefitPolicy',
        resourceId: result.id,
        companyId: result.companyId,
        ip,
        userAgent,
      })

      return apiSuccess({ ...result, amount: result.amount ? Number(result.amount) : null })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.BENEFITS, ACTION.UPDATE),
)

// ─── DELETE /api/v1/benefits/policies/[id] ──────────────

export const DELETE = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params

    try {
      const existing = await prisma.benefitPolicy.findFirst({
        where: { id, companyId: user.companyId, deletedAt: null },
      })
      if (!existing) throw notFound('복리후생 정책을 찾을 수 없습니다.')

      const result = await prisma.benefitPolicy.update({
        where: { id },
        data: { deletedAt: new Date() },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'benefits.policy.delete',
        resourceType: 'benefitPolicy',
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
  perm(MODULE.BENEFITS, ACTION.DELETE),
)
