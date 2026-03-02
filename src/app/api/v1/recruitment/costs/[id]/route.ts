// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET/PUT/DELETE /api/v1/recruitment/costs/[id]
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { recruitmentCostUpdateSchema } from '@/lib/schemas/recruitment-cost'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/recruitment/costs/[id] ──────────────────

export const GET = withPermission(
  async (_req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params

    const companyFilter = user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

    const record = await prisma.recruitmentCost.findFirst({
      where: { id, ...companyFilter },
      include: {
        posting: { select: { id: true, title: true } },
      },
    })

    if (!record) {
      throw notFound('채용 비용 기록을 찾을 수 없습니다.')
    }

    return apiSuccess({ ...record, amount: Number(record.amount) })
  },
  perm(MODULE.RECRUITMENT, ACTION.VIEW),
)

// ─── PUT /api/v1/recruitment/costs/[id] ──────────────────

export const PUT = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params

    const companyFilter = user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

    const existing = await prisma.recruitmentCost.findFirst({
      where: { id, ...companyFilter },
    })

    if (!existing) {
      throw notFound('채용 비용 기록을 찾을 수 없습니다.')
    }

    const body: unknown = await req.json()
    const parsed = recruitmentCostUpdateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const data = parsed.data

    try {
      const updated = await prisma.recruitmentCost.update({
        where: { id },
        data: {
          ...(data.postingId !== undefined ? { postingId: data.postingId ?? null } : {}),
          ...(data.applicantSource !== undefined ? { applicantSource: data.applicantSource } : {}),
          ...(data.costType !== undefined ? { costType: data.costType } : {}),
          ...(data.amount !== undefined ? { amount: data.amount } : {}),
          ...(data.currency !== undefined ? { currency: data.currency } : {}),
          ...(data.description !== undefined ? { description: data.description ?? null } : {}),
          ...(data.vendorName !== undefined ? { vendorName: data.vendorName ?? null } : {}),
          ...(data.invoiceDate !== undefined
            ? { invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : null }
            : {}),
        },
        include: {
          posting: { select: { id: true, title: true } },
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'recruitment.cost.update',
        resourceType: 'recruitment_cost',
        resourceId: id,
        companyId: existing.companyId,
        changes: JSON.parse(JSON.stringify(data)),
        ip,
        userAgent,
      })

      return apiSuccess({ ...updated, amount: Number(updated.amount) })
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.RECRUITMENT, ACTION.UPDATE),
)

// ─── DELETE /api/v1/recruitment/costs/[id] ───────────────

export const DELETE = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params

    const companyFilter = user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

    const existing = await prisma.recruitmentCost.findFirst({
      where: { id, ...companyFilter },
    })

    if (!existing) {
      throw notFound('채용 비용 기록을 찾을 수 없습니다.')
    }

    await prisma.recruitmentCost.delete({
      where: { id },
    })

    const { ip, userAgent } = extractRequestMeta(req.headers)
    logAudit({
      actorId: user.employeeId,
      action: 'recruitment.cost.delete',
      resourceType: 'recruitment_cost',
      resourceId: id,
      companyId: existing.companyId,
      ip,
      userAgent,
    })

    return apiSuccess({ id })
  },
  perm(MODULE.RECRUITMENT, ACTION.DELETE),
)
