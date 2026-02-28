// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/work-schedules  +  POST /api/v1/work-schedules
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import {
  workScheduleSearchSchema,
  workScheduleCreateSchema,
} from '@/lib/schemas/shift'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/work-schedules ─────────────────────────

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = workScheduleSearchSchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { page, limit, scheduleType } = parsed.data

    // Company scope: SUPER_ADMIN sees all, others only their company
    const companyFilter =
      user.role === 'SUPER_ADMIN'
        ? params.companyId
          ? { companyId: params.companyId }
          : {}
        : { companyId: user.companyId }

    const where = {
      deletedAt: null,
      ...companyFilter,
      ...(scheduleType ? { scheduleType } : {}),
    }

    const [items, total] = await Promise.all([
      prisma.workSchedule.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      prisma.workSchedule.count({ where }),
    ])

    return apiPaginated(items, buildPagination(page, limit, total))
  },
  perm(MODULE.ATTENDANCE, ACTION.VIEW),
)

// ─── POST /api/v1/work-schedules ────────────────────────

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = workScheduleCreateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    try {
      // Non-SUPER_ADMIN always uses own companyId
      const companyId =
        user.role === 'SUPER_ADMIN'
          ? ((body as Record<string, unknown>).companyId as string) ?? user.companyId
          : user.companyId

      const result = await prisma.workSchedule.create({
        data: {
          companyId,
          name: parsed.data.name,
          scheduleType: parsed.data.scheduleType,
          weeklyHours: parsed.data.weeklyHours,
          dailyConfig: parsed.data.dailyConfig,
          shiftConfig: parsed.data.shiftConfig ?? undefined,
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'attendance.work-schedule.create',
        resourceType: 'work_schedule',
        resourceId: result.id,
        companyId: result.companyId,
        ip,
        userAgent,
      })

      return apiSuccess(result, 201)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.ATTENDANCE, ACTION.CREATE),
)
