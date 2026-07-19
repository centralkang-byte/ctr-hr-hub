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
        ...(user.role !== 'SUPER_ADMIN'
          ? { assignments: { some: { companyId: user.companyId, isPrimary: true, endDate: null } } }
          : {}),
      },
    })
    if (!employee) throw notFound('직원을 찾을 수 없습니다.')

    // Get all schedule assignments
    const schedules = await prisma.employeeSchedule.findMany({
      where: {
        employeeId: id,
        ...(user.role !== 'SUPER_ADMIN'
          ? { schedule: { companyId: user.companyId } }
          : {}),
      },
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
      const effectiveFrom = new Date(parsed.data.effectiveFrom)
      const effectiveTo = parsed.data.effectiveTo ? new Date(parsed.data.effectiveTo) : null

      // 1. Resolve the schedule's tenant first. Non-SUPER users may only use
      // schedules owned by their session company.
      const schedule = await prisma.workSchedule.findFirst({
        where: {
          id: parsed.data.scheduleId,
          ...(user.role !== 'SUPER_ADMIN' ? { companyId: user.companyId } : {}),
        },
      })
      if (!schedule) throw notFound('근무일정을 찾을 수 없습니다.')

      // 2. The same primary assignment must cover the requested schedule period.
      // EmployeeAssignment intervals are half-open: [effectiveDate, endDate).
      const assignmentFence = {
        companyId: schedule.companyId,
        isPrimary: true,
        effectiveDate: { lte: effectiveFrom },
        ...(effectiveTo
          ? { OR: [{ endDate: null }, { endDate: { gt: effectiveTo } }] }
          : { endDate: null }),
      }
      const employee = await prisma.employee.findFirst({
        where: {
          id,
          deletedAt: null,
          assignments: { some: assignmentFence },
        },
        select: { id: true },
      })
      if (!employee) throw notFound('해당 기간에 법인 소속인 직원을 찾을 수 없습니다.')

      // 3. Check for overlapping period
      const overlap = await prisma.employeeSchedule.findFirst({
        where: {
          employeeId: id,
          effectiveFrom: { lte: effectiveTo ?? new Date('9999-12-31') },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: effectiveFrom } },
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
          effectiveFrom,
          effectiveTo,
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
        companyId: schedule.companyId,
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
