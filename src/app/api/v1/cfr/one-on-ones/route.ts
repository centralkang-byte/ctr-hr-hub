// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 1:1 Meeting List & Create
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiPaginated, apiSuccess, buildPagination } from '@/lib/api'
import { badRequest, handlePrismaError, notFound } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION, DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '@/lib/constants'
import { EMPLOYEE_MINIMAL_SELECT, toMinimalEmployee } from '@/lib/employee-utils'
import type { SessionUser } from '@/types'
import type { OneOnOneStatus, OneOnOneType } from '@/generated/prisma/client'

// ─── Schemas ──────────────────────────────────────────────

const searchSchema = z.object({
  status: z.enum(['SCHEDULED', 'COMPLETED', 'ALL']).default('ALL'),
  employeeId: z.string().optional(),
  page: z.coerce.number().int().positive().default(DEFAULT_PAGE),
  limit: z.coerce.number().int().positive().max(100).default(DEFAULT_PAGE_SIZE),
})

const createSchema = z.object({
  employeeId: z.string(),
  scheduledAt: z.string().datetime(),
  meetingType: z.enum(['REGULAR', 'AD_HOC', 'GOAL_REVIEW', 'DEVELOPMENT']).default('REGULAR'),
  agenda: z.string().max(2000).optional(),
})

// ─── GET /api/v1/cfr/one-on-ones ─────────────────────────

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = searchSchema.safeParse(params)
    if (!parsed.success) throw badRequest('잘못된 파라미터입니다.', { issues: parsed.error.issues })

    const { status, employeeId, page, limit } = parsed.data

    // Manager sees team meetings, employee sees own meetings
    // TODO: implement proper manager hierarchy via position reportsTo
    const isManager = await prisma.employee.count({
      where: {
        assignments: {
          some: {
            companyId: user.companyId,
            isPrimary: true,
            endDate: null,
            status: 'ACTIVE',
          },
        },
      },
    })

    const where = {
      companyId: user.companyId,
      ...(status !== 'ALL' ? { status: status as OneOnOneStatus } : {}),
      ...(isManager > 0
        ? {
            ...(employeeId
              ? { employeeId, managerId: user.employeeId }
              : { managerId: user.employeeId }),
          }
        : {
            employeeId: user.employeeId,
          }),
    }

    const [meetings, total] = await Promise.all([
      prisma.oneOnOne.findMany({
        where,
        orderBy: { scheduledAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          employee: { select: { ...EMPLOYEE_MINIMAL_SELECT } },
          manager: { select: { id: true, name: true } },
        },
      }),
      prisma.oneOnOne.count({ where }),
    ])

    return apiPaginated(
      meetings.map((m) => ({ ...m, employee: toMinimalEmployee(m.employee as any) })),
      buildPagination(page, limit, total)
    )
  },
  perm(MODULE.PERFORMANCE, ACTION.VIEW),
)

// ─── POST /api/v1/cfr/one-on-ones ────────────────────────

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const body: unknown = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })

    const { employeeId, scheduledAt, meetingType, agenda } = parsed.data

    // Verify the target employee is in the same company
    // TODO: implement proper manager hierarchy via position reportsTo
    const employee = await prisma.employee.findFirst({
      where: {
        id: employeeId,
        assignments: {
          some: { companyId: user.companyId, isPrimary: true, endDate: null },
        },
      },
    })
    if (!employee) throw notFound('해당 팀원을 찾을 수 없습니다.')

    try {
      const meeting = await prisma.$transaction(async (tx) => {
        const m = await tx.oneOnOne.create({
          data: {
            employeeId,
            managerId: user.employeeId,
            scheduledAt: new Date(scheduledAt),
            meetingType: meetingType as OneOnOneType,
            agenda,
            status: 'SCHEDULED',
            companyId: user.companyId,
          },
          include: {
            employee: { select: { id: true, name: true } },
          },
        })

        // Create notification for the employee
        await tx.notification.create({
          data: {
            employeeId,
            triggerType: 'ONE_ON_ONE_SCHEDULED',
            title: '1:1 미팅 예약',
            body: `${user.name ?? '매니저'}님이 1:1 미팅을 예약했습니다.`,
            channel: 'IN_APP',
            link: `/performance/one-on-one`,
          },
        })

        return m
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'cfr.one_on_one.create',
        resourceType: 'oneOnOne',
        resourceId: meeting.id,
        companyId: user.companyId,
        changes: { employeeId, scheduledAt, meetingType },
        ip,
        userAgent,
      })

      return apiSuccess(meeting, 201)
    } catch (error) {
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.PERFORMANCE, ACTION.CREATE),
)
