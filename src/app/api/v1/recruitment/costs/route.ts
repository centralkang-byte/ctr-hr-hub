// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET/POST /api/v1/recruitment/costs
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { recruitmentCostCreateSchema, recruitmentCostListSchema } from '@/lib/schemas/recruitment-cost'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/recruitment/costs ───────────────────────

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = recruitmentCostListSchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { page, limit, postingId, applicantSource, costType } = parsed.data

    const companyFilter = user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

    const where = {
      ...companyFilter,
      ...(postingId ? { postingId } : {}),
      ...(applicantSource ? { applicantSource } : {}),
      ...(costType ? { costType } : {}),
    }

    const [items, total] = await Promise.all([
      prisma.recruitmentCost.findMany({
        where,
        include: {
          posting: { select: { id: true, title: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.recruitmentCost.count({ where }),
    ])

    // Convert Decimal fields to number
    const serialized = items.map((item) => ({
      ...item,
      amount: Number(item.amount),
    }))

    return apiPaginated(serialized, buildPagination(page, limit, total))
  },
  perm(MODULE.RECRUITMENT, ACTION.VIEW),
)

// ─── POST /api/v1/recruitment/costs ──────────────────────

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = recruitmentCostCreateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const data = parsed.data

    try {
      const record = await prisma.recruitmentCost.create({
        data: {
          postingId: data.postingId ?? null,
          applicantSource: data.applicantSource,
          costType: data.costType,
          amount: data.amount,
          currency: data.currency,
          description: data.description ?? null,
          vendorName: data.vendorName ?? null,
          invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : null,
          companyId: user.companyId,
          createdBy: user.employeeId,
        },
        include: {
          posting: { select: { id: true, title: true } },
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'recruitment.cost.create',
        resourceType: 'recruitment_cost',
        resourceId: record.id,
        companyId: user.companyId,
        ip,
        userAgent,
      })

      return apiSuccess({ ...record, amount: Number(record.amount) }, 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.RECRUITMENT, ACTION.CREATE),
)
