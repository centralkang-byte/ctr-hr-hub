// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /api/v1/org/restructure-plans
// B8-1 Task 6: 조직 개편 Plans CRUD
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── Schemas ────────────────────────────────────────────────

const createPlanSchema = z.object({
  companyId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  changes: z.array(z.record(z.string(), z.unknown())),
  status: z.enum(['draft', 'review', 'approved']).default('draft'),
})

// ─── GET /api/v1/org/restructure-plans ──────────────────────

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const companyId = searchParams.get('companyId')
    const status = searchParams.get('status')
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))

    // Non-SUPER_ADMIN forced to own company
    const resolvedCompanyId =
      user.role === ROLE.SUPER_ADMIN ? (companyId ?? undefined) : user.companyId

    const where = {
      ...(resolvedCompanyId ? { companyId: resolvedCompanyId } : {}),
      ...(status ? { status } : {}),
    }

    const [total, plans] = await Promise.all([
      prisma.orgRestructurePlan.count({ where }),
      prisma.orgRestructurePlan.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          companyId: true,
          title: true,
          description: true,
          effectiveDate: true,
          status: true,
          createdBy: true,
          approvedBy: true,
          approvedAt: true,
          appliedAt: true,
          createdAt: true,
          updatedAt: true,
          company: { select: { id: true, name: true } },
        },
      }),
    ])

    return apiPaginated(plans, buildPagination(page, limit, total))
  },
  perm(MODULE.ORG, ACTION.VIEW),
)

// ─── POST /api/v1/org/restructure-plans ─────────────────────

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = createPlanSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const { companyId: rawCompanyId, title, description, effectiveDate, changes, status } =
      parsed.data

    const companyId =
      user.role === ROLE.SUPER_ADMIN ? rawCompanyId : user.companyId

    try {
      const plan = await prisma.orgRestructurePlan.create({
        data: {
          companyId,
          title,
          description: description ?? null,
          effectiveDate: new Date(effectiveDate),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          changes: changes as any // eslint-disable-line @typescript-eslint/no-explicit-any -- Prisma Json field,
          status,
          createdBy: user.employeeId,
        },
      })

      return apiSuccess(plan, 201)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.ORG, ACTION.UPDATE),
)
