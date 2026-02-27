// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET/POST /api/v1/onboarding/templates
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, DEFAULT_PAGE_SIZE, DEFAULT_PAGE } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── Schemas ─────────────────────────────────────────────

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  targetType: z.enum(['NEW_HIRE', 'TRANSFER', 'REHIRE']),
  companyId: z.string().uuid().optional(),
})

// ─── GET /api/v1/onboarding/templates ────────────────────

export const GET = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    const p = Object.fromEntries(req.nextUrl.searchParams)
    const page = Number(p.page ?? DEFAULT_PAGE)
    const limit = Number(p.limit ?? DEFAULT_PAGE_SIZE)
    const companyId =
      user.role === 'SUPER_ADMIN' ? (p.companyId ?? undefined) : user.companyId

    const where = {
      deletedAt: null,
      ...(companyId ? { companyId } : {}),
    }

    const [total, templates] = await Promise.all([
      prisma.onboardingTemplate.count({ where }),
      prisma.onboardingTemplate.findMany({
        where,
        include: { _count: { select: { onboardingTasks: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    return apiPaginated(templates, buildPagination(page, limit, total))
  },
  perm(MODULE.ONBOARDING, ACTION.VIEW),
)

// ─── POST /api/v1/onboarding/templates ───────────────────

export const POST = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청입니다.', { issues: parsed.error.issues })
    }

    const { name, description, targetType, companyId: reqCompanyId } = parsed.data
    const companyId =
      user.role === 'SUPER_ADMIN' ? (reqCompanyId ?? user.companyId) : user.companyId

    const template = await prisma.onboardingTemplate.create({
      data: { name, description, targetType, companyId, isActive: true },
    })

    return apiSuccess(template, 201)
  },
  perm(MODULE.ONBOARDING, ACTION.CREATE),
)
