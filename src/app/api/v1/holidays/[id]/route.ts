import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { holidayUpdateSchema } from '@/lib/schemas/holiday'
import type { SessionUser } from '@/types'

// ─── GET /api/v1/holidays/[id] ────────────────────────────
// Holiday detail

export const GET = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params

    const holiday = await prisma.holiday.findFirst({
      where: {
        id,
        companyId: user.companyId,
      },
    })

    if (!holiday) throw notFound('공휴일을 찾을 수 없습니다.')

    return apiSuccess(holiday)
  },
  perm(MODULE.ATTENDANCE, ACTION.VIEW),
)

// ─── PUT /api/v1/holidays/[id] ────────────────────────────
// Update holiday

export const PUT = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const body: unknown = await req.json()
    const parsed = holidayUpdateSchema.safeParse(body)
    if (!parsed.success) {
      throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })
    }

    try {
      // Verify existence & company scope
      const existing = await prisma.holiday.findFirst({
        where: {
          id,
          companyId: user.companyId,
        },
      })
      if (!existing) throw notFound('공휴일을 찾을 수 없습니다.')

      const result = await prisma.holiday.update({
        where: { id },
        data: {
          ...(parsed.data.name !== undefined && { name: parsed.data.name }),
          ...(parsed.data.date !== undefined && { date: new Date(parsed.data.date) }),
          ...(parsed.data.isSubstitute !== undefined && { isSubstitute: parsed.data.isSubstitute }),
        },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'attendance.holiday.update',
        resourceType: 'holiday',
        resourceId: result.id,
        companyId: result.companyId,
        ip,
        userAgent,
      })

      return apiSuccess(result)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.ATTENDANCE, ACTION.UPDATE),
)

// ─── DELETE /api/v1/holidays/[id] ─────────────────────────
// Hard delete

export const DELETE = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params

    try {
      // Verify existence & company scope
      const existing = await prisma.holiday.findFirst({
        where: {
          id,
          companyId: user.companyId,
        },
      })
      if (!existing) throw notFound('공휴일을 찾을 수 없습니다.')

      const result = await prisma.holiday.delete({
        where: { id },
      })

      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'attendance.holiday.delete',
        resourceType: 'holiday',
        resourceId: result.id,
        companyId: result.companyId,
        ip,
        userAgent,
      })

      return apiSuccess({ id: result.id })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.ATTENDANCE, ACTION.DELETE),
)
