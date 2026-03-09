// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Shift Cell API
// GET  /api/v1/attendance/shifts  — board data (employees + schedules)
// POST /api/v1/attendance/shifts  — upsert a single shift cell
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, isAppError, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { format, parseISO, startOfDay } from 'date-fns'
import type { SessionUser } from '@/types'

// ─── Types ──────────────────────────────────────────────────

interface ShiftSlot {
  name: string
  start: string
  end: string
  breakMin: number
  nightPremium: boolean
}

// ─── GET — board data ────────────────────────────────────────

export const GET = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    try {
      const { searchParams } = new URL(req.url)
      const startDate = searchParams.get('startDate')
      const endDate = searchParams.get('endDate')

      if (!startDate || !endDate) {
        throw badRequest('startDate, endDate 파라미터가 필요합니다.')
      }

      const dateRe = /^\d{4}-\d{2}-\d{2}$/
      if (!dateRe.test(startDate) || !dateRe.test(endDate)) {
        throw badRequest('날짜 형식은 YYYY-MM-DD 이어야 합니다.')
      }

      const start = startOfDay(parseISO(startDate))
      const end = startOfDay(parseISO(endDate))

      const companyId =
        user.role === ROLE.SUPER_ADMIN ? null : user.companyId

      // 1. Employees: prefer shift-group members; fall back to all company employees
      const groupMembers = await prisma.shiftGroupMember.findMany({
        where: {
          removedAt: null,
          shiftGroup: companyId ? { companyId } : undefined,
        },
        select: {
          employeeId: true,
          shiftGroup: { select: { name: true, color: true } },
          employee: {
            select: {
              id: true,
              name: true,
              employeeNo: true,
              photoUrl: true,
              assignments: {
                where: { isPrimary: true, endDate: null },
                take: 1,
                select: { department: { select: { name: true } } },
              },
            },
          },
        },
        orderBy: { employee: { name: 'asc' } },
      })

      let employees: {
        id: string
        name: string
        employeeNo: string
        photoUrl: string | null
        department: string | null
        groupName: string | null
        groupColor: string | null
      }[]

      if (groupMembers.length > 0) {
        // De-duplicate by employeeId (employee may be in multiple groups)
        const seen = new Set<string>()
        employees = groupMembers
          .filter((m) => {
            if (seen.has(m.employee.id)) return false
            seen.add(m.employee.id)
            return true
          })
          .map((m) => ({
            id: m.employee.id,
            name: m.employee.name,
            employeeNo: m.employee.employeeNo,
            photoUrl: m.employee.photoUrl ?? null,
            department: m.employee.assignments[0]?.department?.name ?? null,
            groupName: m.shiftGroup.name,
            groupColor: m.shiftGroup.color ?? null,
          }))
      } else {
        // Fallback: all active employees in the company
        const empRows = await prisma.employee.findMany({
          where: companyId
            ? {
                assignments: {
                  some: { companyId, isPrimary: true, endDate: null },
                },
              }
            : undefined,
          select: {
            id: true,
            name: true,
            employeeNo: true,
            photoUrl: true,
            assignments: {
              where: { isPrimary: true, endDate: null },
              take: 1,
              select: { department: { select: { name: true } } },
            },
          },
          orderBy: { name: 'asc' },
          take: 50,
        })

        employees = empRows.map((e) => ({
          id: e.id,
          name: e.name,
          employeeNo: e.employeeNo,
          photoUrl: e.photoUrl ?? null,
          department: e.assignments[0]?.department?.name ?? null,
          groupName: null,
          groupColor: null,
        }))
      }

      // 2. Schedules for the date range
      const schedules = await prisma.shiftSchedule.findMany({
        where: {
          ...(companyId ? { companyId } : {}),
          workDate: { gte: start, lte: end },
        },
        select: {
          id: true,
          employeeId: true,
          workDate: true,
          slotName: true,
          startTime: true,
          endTime: true,
          isNightShift: true,
          status: true,
        },
      })

      const formattedSchedules = schedules.map((s) => ({
        id: s.id,
        employeeId: s.employeeId,
        workDate: format(s.workDate, 'yyyy-MM-dd'),
        slotName: s.slotName ?? null,
        startTime: s.startTime,
        endTime: s.endTime,
        isNightShift: s.isNightShift,
        status: s.status,
      }))

      return apiSuccess({ employees, schedules: formattedSchedules })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.ATTENDANCE, ACTION.VIEW),
)

// ─── POST — upsert single shift cell ────────────────────────

const postSchema = z.object({
  employeeId: z.string().uuid(),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식이어야 합니다.'),
  slotName: z.enum(['morning', 'night', 'off']),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  note: z.string().optional(),
})

export const POST = withPermission(
  async (req: NextRequest, _ctx, user: SessionUser) => {
    try {
      const body: unknown = await req.json()
      const parsed = postSchema.safeParse(body)

      if (!parsed.success) {
        throw badRequest('입력값이 올바르지 않습니다.', {
          issues: parsed.error.issues as unknown as Record<string, unknown>,
        })
      }

      const { employeeId, workDate, slotName, startTime, endTime, note } =
        parsed.data

      // Resolve companyId from the employee's current assignment
      const assignment = await prisma.employeeAssignment.findFirst({
        where: { employeeId, isPrimary: true, endDate: null },
        select: { companyId: true },
      })

      if (!assignment) {
        throw badRequest('해당 직원의 현재 발령 정보를 찾을 수 없습니다.')
      }

      // RBAC check — non-SUPER_ADMIN can only manage own company
      if (
        user.role !== ROLE.SUPER_ADMIN &&
        assignment.companyId !== user.companyId
      ) {
        throw badRequest('다른 법인 직원의 근무를 수정할 수 없습니다.')
      }

      const workDateObj = startOfDay(parseISO(workDate))

      // 'off' → delete any existing schedule
      if (slotName === 'off') {
        await prisma.shiftSchedule.deleteMany({
          where: { employeeId, workDate: workDateObj },
        })
        return apiSuccess({ action: 'deleted', employeeId, workDate })
      }

      // Find the company's first active shift pattern
      const pattern = await prisma.shiftPattern.findFirst({
        where: { companyId: assignment.companyId, isActive: true },
        orderBy: { createdAt: 'asc' },
      })

      if (!pattern) {
        // Graceful degradation — return success but note that no pattern was saved
        // The UI optimistic update still stands; backend persistence requires a pattern.
        return apiSuccess({
          action: 'optimistic_only',
          employeeId,
          workDate,
          warning:
            '교대 패턴이 설정되지 않아 서버에 저장되지 않았습니다. 먼저 교대 패턴을 생성해주세요.',
        })
      }

      const slots = pattern.slots as unknown as ShiftSlot[]
      const isNight = slotName === 'night'
      const nightSlotIdx = slots.findIndex((s) => s.nightPremium)
      const slotIndex = isNight && nightSlotIdx >= 0 ? nightSlotIdx : 0
      const slot = slots[slotIndex] ?? slots[0]

      const upsertData = {
        companyId: assignment.companyId,
        employeeId,
        shiftPatternId: pattern.id,
        workDate: workDateObj,
        slotIndex,
        slotName: slotName === 'morning' ? '주간' : '야간',
        startTime: startTime ?? slot?.start ?? '08:00',
        endTime: endTime ?? slot?.end ?? '17:00',
        breakMinutes: slot?.breakMin ?? 60,
        isNightShift: isNight,
        status: 'SCHEDULED' as const,
        note: note ?? null,
      }

      const schedule = await prisma.shiftSchedule.upsert({
        where: { employeeId_workDate: { employeeId, workDate: workDateObj } },
        create: upsertData,
        update: {
          slotIndex: upsertData.slotIndex,
          slotName: upsertData.slotName,
          startTime: upsertData.startTime,
          endTime: upsertData.endTime,
          isNightShift: isNight,
          note: note ?? null,
          updatedAt: new Date(),
        },
      })

      return apiSuccess({
        action: 'saved',
        id: schedule.id,
        employeeId,
        workDate,
        slotName: upsertData.slotName,
        startTime: upsertData.startTime,
        endTime: upsertData.endTime,
        isNightShift: isNight,
      })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.ATTENDANCE, ACTION.APPROVE),
)
