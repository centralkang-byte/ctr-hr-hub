// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Succession Plan List & Create
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { planSearchSchema, planCreateSchema } from '@/lib/schemas/succession'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/succession/plans ───────────────────────

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = planSearchSchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { page, limit, criticality, status, departmentId } = parsed.data

    const where = {
      companyId: user.companyId,
      ...(criticality ? { criticality } : {}),
      ...(status ? { status } : {}),
      ...(departmentId ? { departmentId } : {}),
    }

    const [plans, total] = await Promise.all([
      prisma.successionPlan.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          department: { select: { id: true, name: true } },
          currentHolder: { select: { id: true, name: true } },
          _count: { select: { candidates: true } },
        },
      }),
      prisma.successionPlan.count({ where }),
    ])

    return apiPaginated(plans, buildPagination(page, limit, total))
  },
  perm(MODULE.SUCCESSION, ACTION.VIEW),
)

// ─── POST /api/v1/succession/plans ──────────────────────

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = planCreateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    try {
      const plan = await prisma.successionPlan.create({
        data: {
          companyId: user.companyId,
          createdBy: user.employeeId,
          status: 'PLAN_DRAFT',
          ...parsed.data,
        },
        include: {
          department: { select: { id: true, name: true } },
          currentHolder: { select: { id: true, name: true } },
          _count: { select: { candidates: true } },
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'succession.plan.create',
        resourceType: 'successionPlan',
        resourceId: plan.id,
        companyId: user.companyId,
        changes: { positionTitle: parsed.data.positionTitle, criticality: parsed.data.criticality },
        ip,
        userAgent,
      })

      return apiSuccess(plan, 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.SUCCESSION, ACTION.CREATE),
)
