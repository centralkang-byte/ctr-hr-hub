// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Leave Type Defs API (B6-2)
// GET  /api/v1/leave/type-defs  — List leave type defs
// POST /api/v1/leave/type-defs  — Create leave type def
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { z } from 'zod'
import type { SessionUser } from '@/types'

const createSchema = z.object({
  companyId: z.string().uuid().nullable().optional(),
  code: z.string().min(1).max(30),
  name: z.string().min(1).max(100),
  nameEn: z.string().max(100).optional(),
  isPaid: z.boolean().default(true),
  allowHalfDay: z.boolean().default(true),
  requiresProof: z.boolean().default(false),
  maxConsecutiveDays: z.number().int().positive().optional(),
  minAdvanceDays: z.number().int().nonnegative().optional(),
  displayOrder: z.number().int().default(0),
  // 규정 필드
  category: z.string().max(30).optional(),
  subcategory: z.string().max(30).optional(),
  countingMethod: z.enum(['business_day', 'calendar_day']).default('business_day'),
  includesHolidays: z.boolean().default(false),
  isSplittable: z.boolean().default(false),
  splitDeadlineDays: z.number().int().positive().optional(),
  maxPerYear: z.number().int().positive().optional(),
  paidDaysPerYear: z.number().int().positive().optional(),
  condolenceAmount: z.number().int().nonnegative().optional(),
})

// ─── GET ─────────────────────────────────────────────────

export const GET = withPermission(
  async (req: NextRequest, _context, _user: SessionUser) => {
    const { searchParams } = new URL(req.url)
    const companyId = searchParams.get('companyId')

    const where = companyId
      ? { OR: [{ companyId }, { companyId: null }] }
      : {}

    const typeDefs = await prisma.leaveTypeDef.findMany({
      where: { ...where, deletedAt: null },
      include: {
        accrualRules: { where: { deletedAt: null }, take: 1 },
        _count: { select: { yearBalances: true } },
      },
      orderBy: [{ companyId: 'asc' }, { displayOrder: 'asc' }, { name: 'asc' }],
    })

    return apiSuccess(typeDefs)
  },
  perm(MODULE.LEAVE, ACTION.VIEW),
)

// ─── POST ────────────────────────────────────────────────

export const POST = withPermission(
  async (req: NextRequest, _context, _user: SessionUser) => {
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) throw badRequest(parsed.error.message)
    const data = parsed.data

    // 중복 코드 체크 (법인+코드 유니크)
    const existing = await prisma.leaveTypeDef.findFirst({
      where: { companyId: data.companyId ?? null, code: data.code },
    })
    if (existing) throw badRequest(`코드 '${data.code}'가 이미 존재합니다.`)

    const typeDef = await prisma.leaveTypeDef.create({
      data: {
        companyId: data.companyId ?? null,
        code: data.code,
        name: data.name,
        nameEn: data.nameEn,
        isPaid: data.isPaid,
        allowHalfDay: data.allowHalfDay,
        requiresProof: data.requiresProof,
        maxConsecutiveDays: data.maxConsecutiveDays,
        minAdvanceDays: data.minAdvanceDays,
        displayOrder: data.displayOrder,
        deletedAt: null,
        // 규정 필드
        category: data.category,
        subcategory: data.subcategory,
        countingMethod: data.countingMethod,
        includesHolidays: data.includesHolidays,
        isSplittable: data.isSplittable,
        splitDeadlineDays: data.splitDeadlineDays,
        maxPerYear: data.maxPerYear,
        paidDaysPerYear: data.paidDaysPerYear,
        condolenceAmount: data.condolenceAmount,
      },
    })

    return apiSuccess(typeDef, 201)
  },
  perm(MODULE.LEAVE, ACTION.CREATE),
)
