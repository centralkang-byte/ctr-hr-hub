// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET/PUT/DELETE /api/v1/rewards/[id]
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── Update Schema ────────────────────────────────────────

const updateSchema = z.object({
  rewardType: z.enum([
    'COMMENDATION', 'BONUS_AWARD', 'PROMOTION_RECOMMENDATION',
    'LONG_SERVICE', 'INNOVATION', 'SAFETY_AWARD', 'CTR_VALUE_AWARD', 'OTHER',
  ]).optional(),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  amount: z.number().min(0).nullable().optional(),
  awardedDate: z.string().optional(),
  documentKey: z.string().nullable().optional(),
  ctrValue: z.string().nullable().optional(),
  serviceYears: z.number().int().min(0).nullable().optional(),
})

// ─── GET /api/v1/rewards/[id] ─────────────────────────────

export const GET = withPermission(
  async (_req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params

    const companyFilter = user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

    const record = await prisma.rewardRecord.findFirst({
      where: { id, ...companyFilter },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeNo: true,
            department: { select: { id: true, name: true } },
            jobGrade: { select: { id: true, name: true } },
          },
        },
        issuer: { select: { id: true, name: true } },
      },
    })

    if (!record) {
      throw notFound('포상 기록을 찾을 수 없습니다.')
    }

    return apiSuccess(record)
  },
  perm(MODULE.DISCIPLINE, ACTION.VIEW),
)

// ─── PUT /api/v1/rewards/[id] ─────────────────────────────

export const PUT = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params

    const companyFilter = user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

    const existing = await prisma.rewardRecord.findFirst({
      where: { id, ...companyFilter },
    })

    if (!existing) {
      throw notFound('포상 기록을 찾을 수 없습니다.')
    }

    const body: unknown = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const data = parsed.data

    try {
      const updated = await prisma.rewardRecord.update({
        where: { id },
        data: {
          ...(data.rewardType !== undefined ? { rewardType: data.rewardType } : {}),
          ...(data.title !== undefined ? { title: data.title } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.amount !== undefined ? { amount: data.amount } : {}),
          ...(data.awardedDate !== undefined ? { awardedDate: new Date(data.awardedDate) } : {}),
          ...(data.documentKey !== undefined ? { documentKey: data.documentKey } : {}),
          ...(data.ctrValue !== undefined ? { ctrValue: data.ctrValue } : {}),
          ...(data.serviceYears !== undefined ? { serviceYears: data.serviceYears } : {}),
        },
        include: {
          employee: { select: { id: true, name: true, employeeNo: true } },
          issuer: { select: { id: true, name: true } },
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'reward.update',
        resourceType: 'reward_record',
        resourceId: id,
        companyId: existing.companyId,
        changes: JSON.parse(JSON.stringify(data)),
        ip,
        userAgent,
      })

      return apiSuccess(updated)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.DISCIPLINE, ACTION.UPDATE),
)

// ─── DELETE /api/v1/rewards/[id] ──────────────────────────

export const DELETE = withPermission(
  async (req: NextRequest, context, user: SessionUser) => {
    const { id } = await context.params

    const companyFilter = user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

    const existing = await prisma.rewardRecord.findFirst({
      where: { id, ...companyFilter },
    })

    if (!existing) {
      throw notFound('포상 기록을 찾을 수 없습니다.')
    }

    try {
      await prisma.rewardRecord.delete({
        where: { id },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'reward.delete',
        resourceType: 'reward_record',
        resourceId: id,
        companyId: existing.companyId,
        ip,
        userAgent,
      })

      return apiSuccess({ id })
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.DISCIPLINE, ACTION.DELETE),
)
