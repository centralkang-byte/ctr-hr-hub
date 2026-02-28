// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Benefit Policy List & Create
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { benefitPolicySearchSchema, benefitPolicyCreateSchema } from '@/lib/schemas/benefits'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/benefits/policies ──────────────────────
// Paginated list with category/isActive filters, company scoped

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = benefitPolicySearchSchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { page, limit, category, isActive } = parsed.data
    const companyId = user.companyId

    const where = {
      companyId,
      deletedAt: null,
      ...(category ? { category } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    }

    const [policies, total] = await Promise.all([
      prisma.benefitPolicy.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.benefitPolicy.count({ where }),
    ])

    const serialized = policies.map((p) => ({
      ...p,
      amount: p.amount ? Number(p.amount) : null,
    }))

    return apiPaginated(serialized, buildPagination(page, limit, total))
  },
  perm(MODULE.BENEFITS, ACTION.VIEW),
)

// ─── POST /api/v1/benefits/policies ─────────────────────
// Create a new benefit policy

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = benefitPolicyCreateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { effectiveFrom, effectiveTo, ...rest } = parsed.data

    try {
      const policy = await prisma.benefitPolicy.create({
        data: {
          companyId: user.companyId,
          ...rest,
          effectiveFrom: new Date(effectiveFrom),
          ...(effectiveTo ? { effectiveTo: new Date(effectiveTo) } : {}),
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'benefits.policy.create',
        resourceType: 'benefitPolicy',
        resourceId: policy.id,
        companyId: policy.companyId,
        changes: { name: rest.name, category: rest.category },
        ip,
        userAgent,
      })

      return apiSuccess(
        { ...policy, amount: policy.amount ? Number(policy.amount) : null },
        201,
      )
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.BENEFITS, ACTION.CREATE),
)
