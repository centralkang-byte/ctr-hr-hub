// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Designated Leave Days API (지정연차)
// GET  /api/v1/leave/designated-days — 법인별 지정연차 목록
// POST /api/v1/leave/designated-days — 지정연차 추가
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

const searchSchema = z.object({
  year: z.coerce.number().optional(),
  companyId: z.string().uuid().optional(),
})

const createSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().min(1).max(100),
  companyId: z.string().uuid().optional(),
})

// ─── GET ─────────────────────────────────────────────────

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = searchSchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const year = parsed.data.year ?? new Date().getFullYear()
    const companyId = parsed.data.companyId ?? user.companyId

    const days = await prisma.designatedLeaveDay.findMany({
      where: { companyId, year },
      orderBy: { date: 'asc' },
    })

    return apiSuccess(days)
  },
  perm(MODULE.LEAVE, ACTION.VIEW),
)

// ─── POST ────────────────────────────────────────────────

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    const companyId = user.role === 'SUPER_ADMIN'
      ? parsed.data.companyId ?? user.companyId
      : user.companyId

    const date = new Date(parsed.data.date)
    const year = date.getFullYear()

    try {
      const created = await prisma.designatedLeaveDay.create({
        data: {
          companyId,
          date,
          name: parsed.data.name,
          year,
        },
      })

      const meta = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'leave.designated_day.create',
        resourceType: 'DesignatedLeaveDay',
        resourceId: created.id,
        companyId,
        changes: { date: parsed.data.date, name: parsed.data.name },
        ...meta,
      })

      return apiSuccess(created, 201)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.LEAVE, ACTION.CREATE),
)
