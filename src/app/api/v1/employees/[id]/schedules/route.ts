import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, handlePrismaError, isAppError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { logAudit, extractRequestMeta } from '@/lib/audit'
import { MODULE, ACTION } from '@/lib/constants'
import { employeeScheduleAssignSchema } from '@/lib/schemas/shift'
import type { SessionUser } from '@/types'

// GET /api/v1/employees/[id]/schedules — Get employee's schedule assignments
export const GET = withPermission(
  async (_req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params

    // Verify employee exists and belongs to user's company
    const employee = await prisma.employee.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(user.role !== 'SUPER_ADMIN' ? { companyId: user.companyId } : {}),
      },
    })
    if (!employee) throw notFound('직원을 찾을 수 없습니다.')

    // Get all schedule assignments
    const schedules = await prisma.employeeSchedule.findMany({
      where: { employeeId: id },
      include: { schedule: true },
      orderBy: { effectiveFrom: 'desc' },
    })

    return apiSuccess(schedules)
  },
  perm(MODULE.ATTENDANCE, ACTION.VIEW)
)

// POST /api/v1/employees/[id]/schedules — Assign schedule to employee
export const POST = withPermission(
  async (req: NextRequest, context: { params: Promise<Record<string, string>> }, user: SessionUser) => {
    const { id } = await context.params
    const body: unknown = await req.json()
    const parsed = employeeScheduleAssignSchema.safeParse({ ...(body as Record<string, unknown>), employeeId: id })
    if (!parsed.success) throw badRequest('잘못된 요청 데이터입니다.', { issues: parsed.error.issues })

    try {
      // 1. Verify employee exists
      const employee = await prisma.employee.findFirst({
        where: {
          id,
          deletedAt: null,
          ...(user.role !== 'SUPER_ADMIN' ? { companyId: user.companyId } : {}),
        },
      })
      if (!employee) throw notFound('직원을 찾을 수 없습니다.')

      // 2. Verify schedule exists
      const schedule = await prisma.workSchedule.findFirst({
        where: { id: parsed.data.scheduleId },
      })
      if (!schedule) throw notFound('근무일정을 찾을 수 없습니다.')

      // 3. Check for overlapping period
      const overlap = await prisma.employeeSchedule.findFirst({
        where: {
          employeeId: id,
          effectiveFrom: { lte: parsed.data.effectiveTo ?? new Date('9999-12-31') },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: new Date(parsed.data.effectiveFrom) } },
          ],
        },
      })
      if (overlap) throw badRequest('해당 기간에 이미 배정된 스케줄이 있습니다.')

      // 4. Create assignment
      const assignment = await prisma.employeeSchedule.create({
        data: {
          employeeId: id,
          scheduleId: parsed.data.scheduleId,
          shiftGroup: parsed.data.shiftGroup,
          effectiveFrom: new Date(parsed.data.effectiveFrom),
          effectiveTo: parsed.data.effectiveTo ? new Date(parsed.data.effectiveTo) : null,
        },
        include: { schedule: true },
      })

      // 5. Audit log
      const { ip, userAgent } = extractRequestMeta(req.headers)
      logAudit({
        actorId: user.employeeId,
        action: 'attendance.employee-schedule.assign',
        resourceType: 'employee_schedule',
        resourceId: assignment.id,
        companyId: employee.companyId,
        ip,
        userAgent,
      })

      return apiSuccess(assignment, 201)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.ATTENDANCE, ACTION.CREATE)
)
