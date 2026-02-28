// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET/POST /api/v1/settings/notification-triggers
// 알림 트리거 목록 + 생성
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiPaginated, apiError, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { paginationSchema } from '@/lib/schemas/common'
import { notificationTriggerCreateSchema } from '@/lib/schemas/notification'
import type { SessionUser } from '@/types'

// ─── GET — 트리거 목록 ───────────────────────────────────

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = paginationSchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })
    }

    const { page, limit } = parsed.data

    const where = {
      OR: [
        { companyId: user.companyId },
        { companyId: null },
      ],
    }

    const [triggers, total] = await Promise.all([
      prisma.notificationTrigger.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notificationTrigger.count({ where }),
    ])

    return apiPaginated(triggers, buildPagination(page, limit, total))
  },
  perm(MODULE.SETTINGS, ACTION.VIEW),
)

// ─── POST — 트리거 생성 ──────────────────────────────────

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = notificationTriggerCreateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    try {
      const result = await prisma.notificationTrigger.create({
        data: {
          eventType: parsed.data.eventType,
          template: parsed.data.template,
          channels: parsed.data.channels,
          isActive: parsed.data.isActive,
          companyId: user.companyId,
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'settings.notification_trigger.create',
        resourceType: 'notification_trigger',
        resourceId: result.id,
        companyId: user.companyId,
        ip,
        userAgent,
      })

      return apiSuccess(result, 201)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.SETTINGS, ACTION.CREATE),
)
