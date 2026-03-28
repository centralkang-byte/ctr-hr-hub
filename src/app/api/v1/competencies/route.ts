// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Competency List / Create
// GET /api/v1/competencies?categoryCode=core_value
// POST /api/v1/competencies
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

const listSchema = z.object({
  categoryCode: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
})

const createSchema = z.object({
  categoryId: z.string(),
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  nameEn: z.string().max(100).optional(),
  description: z.string().optional(),
  displayOrder: z.number().int().default(0),
})

export const GET = withPermission(
  async (req: NextRequest, _ctx: { params: Promise<Record<string, string>> }, _user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = listSchema.safeParse(params)
    if (!parsed.success) throw badRequest('잘못된 파라미터', { issues: parsed.error.issues })

    const { categoryCode, isActive, page, limit } = parsed.data

    const where = {
      ...(categoryCode ? { category: { code: categoryCode } } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    }

    const [items, total] = await Promise.all([
      prisma.competency.findMany({
        where,
        orderBy: [{ category: { displayOrder: 'asc' } }, { displayOrder: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          category: { select: { id: true, code: true, name: true } },
          _count: { select: { indicators: { where: { deletedAt: null } }, levels: true } },
        },
      }),
      prisma.competency.count({ where }),
    ])

    return apiPaginated(items, buildPagination(page, limit, total))
  },
  perm(MODULE.SETTINGS, ACTION.VIEW),
)

export const POST = withPermission(
  async (req: NextRequest, _ctx: { params: Promise<Record<string, string>> }, _user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) throw badRequest('잘못된 요청 데이터', { issues: parsed.error.issues })

    try {
      const item = await prisma.competency.create({ data: parsed.data })
      return apiSuccess(item, 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.SETTINGS, ACTION.CREATE),
)
