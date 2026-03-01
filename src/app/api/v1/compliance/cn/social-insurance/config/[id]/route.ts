// ═══════════════════════════════════════════════════════════
// CTR HR Hub — CN Social Insurance Config Update
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { socialInsuranceConfigUpdateSchema } from '@/lib/schemas/compliance'
import type { SessionUser } from '@/types'

// ─── PUT /api/v1/compliance/cn/social-insurance/config/[id] ─
// Update a social insurance config

export const PUT = withPermission(
  async (
    req: NextRequest,
    context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    const { id } = await context.params
    const body: unknown = await req.json()
    const parsed = socialInsuranceConfigUpdateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    try {
      const existing = await prisma.socialInsuranceConfig.findFirst({
        where: { id, companyId: user.companyId },
      })
      if (!existing) throw notFound('사회보험 설정을 찾을 수 없습니다.')

      const data = parsed.data

      const updated = await prisma.socialInsuranceConfig.update({
        where: { id },
        data: {
          ...(data.insuranceType !== undefined && { insuranceType: data.insuranceType }),
          ...(data.city !== undefined && { city: data.city }),
          ...(data.employerRate !== undefined && { employerRate: data.employerRate }),
          ...(data.employeeRate !== undefined && { employeeRate: data.employeeRate }),
          ...(data.baseMin !== undefined && { baseMin: data.baseMin }),
          ...(data.baseMax !== undefined && { baseMax: data.baseMax }),
          ...(data.effectiveFrom !== undefined && { effectiveFrom: new Date(data.effectiveFrom) }),
          ...(data.effectiveTo !== undefined && {
            effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
          }),
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'compliance.cn.socialInsuranceConfig.update',
        resourceType: 'socialInsuranceConfig',
        resourceId: updated.id,
        companyId: updated.companyId,
        ip,
        userAgent,
      })

      return apiSuccess({
        ...updated,
        employerRate: Number(updated.employerRate),
        employeeRate: Number(updated.employeeRate),
        baseMin: Number(updated.baseMin),
        baseMax: Number(updated.baseMax),
      })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.COMPLIANCE, ACTION.UPDATE),
)
