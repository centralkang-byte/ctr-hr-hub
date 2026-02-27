// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/rewards + POST /api/v1/rewards
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, ROLE, DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── Validation Schemas ──────────────────────────────────

const searchSchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(100).default(DEFAULT_PAGE_SIZE),
  search: z.string().optional(),
  rewardType: z.enum([
    'COMMENDATION', 'BONUS_AWARD', 'PROMOTION_RECOMMENDATION',
    'LONG_SERVICE', 'INNOVATION', 'SAFETY_AWARD', 'CTR_VALUE_AWARD', 'OTHER',
  ]).optional(),
})

const createSchema = z.object({
  employeeId: z.string().uuid(),
  rewardType: z.enum([
    'COMMENDATION', 'BONUS_AWARD', 'PROMOTION_RECOMMENDATION',
    'LONG_SERVICE', 'INNOVATION', 'SAFETY_AWARD', 'CTR_VALUE_AWARD', 'OTHER',
  ]),
  title: z.string().min(1),
  description: z.string().optional(),
  amount: z.number().min(0).optional(),
  awardedDate: z.string(),
  documentKey: z.string().optional(),
  ctrValue: z.string().optional(),
  serviceYears: z.number().int().min(0).optional(),
})

// ─── GET /api/v1/rewards ──────────────────────────────────

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = searchSchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { page, limit, search, rewardType } = parsed.data

    const companyFilter = user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

    const where = {
      ...companyFilter,
      ...(rewardType ? { rewardType } : {}),
      ...(search
        ? {
            OR: [
              { employee: { name: { contains: search, mode: 'insensitive' as const } } },
              { title: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    }

    const [items, total] = await Promise.all([
      prisma.rewardRecord.findMany({
        where,
        include: {
          employee: { select: { id: true, name: true, employeeNo: true } },
          issuer: { select: { id: true, name: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.rewardRecord.count({ where }),
    ])

    return apiPaginated(items, buildPagination(page, limit, total))
  },
  perm(MODULE.DISCIPLINE, ACTION.VIEW),
)

// ─── POST /api/v1/rewards ─────────────────────────────────

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const data = parsed.data

    try {
      const record = await prisma.rewardRecord.create({
        data: {
          employeeId: data.employeeId,
          companyId: user.companyId,
          rewardType: data.rewardType,
          title: data.title,
          description: data.description ?? null,
          amount: data.amount ?? null,
          awardedDate: new Date(data.awardedDate),
          awardedBy: user.employeeId,
          documentKey: data.documentKey ?? null,
          ctrValue: data.ctrValue ?? null,
          serviceYears: data.serviceYears ?? null,
        },
        include: {
          employee: { select: { id: true, name: true, employeeNo: true } },
          issuer: { select: { id: true, name: true } },
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'reward.create',
        resourceType: 'reward_record',
        resourceId: record.id,
        companyId: user.companyId,
        ip,
        userAgent,
      })

      return apiSuccess(record, 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.DISCIPLINE, ACTION.CREATE),
)
