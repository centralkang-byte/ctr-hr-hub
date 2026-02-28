// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Benefit Enrollment Update (Status Change)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { enrollmentUpdateSchema } from '@/lib/schemas/benefits'
import type { SessionUser } from '@/types'

// ─── PUT /api/v1/benefits/enrollments/[id] ──────────────

export const PUT = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const body: unknown = await req.json()
    const parsed = enrollmentUpdateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    try {
      const existing = await prisma.employeeBenefit.findFirst({
        where: { id },
        include: { policy: { select: { companyId: true } } },
      })
      if (!existing || existing.policy.companyId !== user.companyId) {
        throw notFound('복리후생 신청을 찾을 수 없습니다.')
      }

      const data = parsed.data
      const result = await prisma.employeeBenefit.update({
        where: { id },
        data: {
          status: data.status,
          ...(data.note !== undefined && { note: data.note }),
          ...(data.expiredAt !== undefined && { expiredAt: data.expiredAt ? new Date(data.expiredAt) : null }),
        },
        include: {
          employee: { select: { id: true, name: true, employeeNo: true } },
          policy: { select: { id: true, name: true, category: true } },
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'benefits.enrollment.update',
        resourceType: 'employeeBenefit',
        resourceId: result.id,
        companyId: user.companyId,
        changes: { status: data.status },
        ip,
        userAgent,
      })

      return apiSuccess(result)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.BENEFITS, ACTION.APPROVE),
)
