// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Leave Accrual Rules API (B6-2)
// GET /api/v1/leave/type-defs/[id]/accrual-rules
// PUT /api/v1/leave/type-defs/[id]/accrual-rules  — upsert (replace all)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { z } from 'zod'
import type { SessionUser } from '@/types'

const accrualRuleTierSchema = z.object({
  minTenureMonths: z.number().int().min(0).optional(),
  maxTenureMonths: z.number().int().nullable().optional(),
  daysPerYear: z.number().min(0).optional(),
  daysPerMonth: z.number().min(0).optional(),
  bonusPerTwoYears: z.number().min(0).optional(),
  maxDays: z.number().min(0).optional(),
  type: z.string().optional(),
})

const upsertSchema = z.object({
  accrualType: z.enum(['annual', 'monthly', 'manual']).default('annual'),
  accrualBasis: z.enum(['calendar_year', 'hire_date_anniversary']).default('calendar_year'),
  rules: z.array(accrualRuleTierSchema),
  carryOverType: z.enum(['none', 'limited', 'unlimited']).default('none'),
  carryOverMaxDays: z.number().int().nullable().optional(),
  carryOverExpiryMonths: z.number().int().nullable().optional(),
})

export const GET = withPermission(
  async (_req: NextRequest, context, _user: SessionUser) => {
    const { id: leaveTypeDefId } = await context.params
    const rules = await prisma.leaveAccrualRule.findMany({
      where: { leaveTypeDefId, deletedAt: null },
    })
    return apiSuccess(rules)
  },
  perm(MODULE.SETTINGS, ACTION.VIEW),
)

export const PUT = withPermission(
  async (req: NextRequest, context, _user: SessionUser) => {
    const { id: leaveTypeDefId } = await context.params
    const body = await req.json()
    const parsed = upsertSchema.safeParse(body)
    if (!parsed.success) throw badRequest(parsed.error.message)
    const data = parsed.data

    // soft-delete 기존 규칙 → 신규 생성
    const result = await prisma.$transaction(async (tx) => {
      await tx.leaveAccrualRule.updateMany({
        where: { leaveTypeDefId },
        data: { deletedAt: new Date() },
      })
      const created = await tx.leaveAccrualRule.create({
        data: {
          leaveTypeDefId,
          accrualType: data.accrualType,
          accrualBasis: data.accrualBasis,
          rules: data.rules,
          carryOverType: data.carryOverType,
          carryOverMaxDays: data.carryOverMaxDays ?? null,
          carryOverExpiryMonths: data.carryOverExpiryMonths ?? null,
          deletedAt: null,
        },
      })
      return created
    })

    return apiSuccess(result)
  },
  perm(MODULE.SETTINGS, ACTION.UPDATE),
)
