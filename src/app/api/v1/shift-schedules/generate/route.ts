// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Shift Schedule Auto-Generate API
// POST /api/v1/shift-schedules/generate
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, notFound, isAppError, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { shiftScheduleGenerateSchema } from '@/lib/schemas/shift'
import { startOfMonth, endOfMonth, eachDayOfInterval, format } from 'date-fns'
import type { SessionUser } from '@/types'

interface ShiftSlot {
  name: string
  start: string
  end: string
  breakMin: number
  nightPremium: boolean
}

export const POST = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    try {
      const body = await req.json()
      const parsed = shiftScheduleGenerateSchema.safeParse(body)

      if (!parsed.success) {
        throw badRequest('입력값이 올바르지 않습니다.', {
          issues: parsed.error.issues,
        })
      }

      const { shiftPatternId, shiftGroupId, year, month } = parsed.data

      const companyFilter =
        user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }

      // 1. Load the shift pattern
      const pattern = await prisma.shiftPattern.findFirst({
        where: { id: shiftPatternId, isActive: true, ...companyFilter },
      })

      if (!pattern) {
        throw notFound('교대 패턴을 찾을 수 없습니다.')
      }

      const slots = pattern.slots as unknown as ShiftSlot[]
      if (!Array.isArray(slots) || slots.length === 0) {
        throw badRequest('교대 패턴에 슬롯이 설정되지 않았습니다.')
      }

      const cycleDays = pattern.cycleDays

      // 2. Load target groups
      const groupWhere = {
        shiftPatternId,
        isActive: true,
        ...(shiftGroupId ? { id: shiftGroupId } : {}),
      }

      const groups = await prisma.shiftGroup.findMany({
        where: groupWhere,
        include: {
          members: {
            where: { removedAt: null },
            select: { employeeId: true },
          },
        },
      })

      if (groups.length === 0) {
        throw badRequest('해당 패턴에 활성화된 교대 그룹이 없습니다.')
      }

      // 3. Build date range for the month
      const monthStart = startOfMonth(new Date(year, month - 1))
      const monthEnd = endOfMonth(new Date(year, month - 1))
      const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })

      // 4. Generate schedule entries — delete+createMany로 N+1 제거
      const allEmployeeIds = groups.flatMap((g) => g.members.map((m) => m.employeeId))

      // Build all schedule records in memory first
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const scheduleRecords: any[] = [] // eslint-disable-line @typescript-eslint/no-explicit-any -- dynamic array accumulator

      for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
        const group = groups[groupIndex]
        const memberEmployeeIds = group.members.map((m) => m.employeeId)
        if (memberEmployeeIds.length === 0) continue

        for (const day of daysInMonth) {
          const dayOfYear = Math.floor(
            (day.getTime() - new Date(year, 0, 1).getTime()) / (1000 * 60 * 60 * 24),
          )
          const cyclePosition = (dayOfYear + groupIndex) % cycleDays
          const isRestDay = cyclePosition >= slots.length
          if (isRestDay) continue

          const slotIndex = cyclePosition % slots.length
          const slot = slots[slotIndex]
          const workDate = new Date(format(day, 'yyyy-MM-dd'))

          for (const employeeId of memberEmployeeIds) {
            scheduleRecords.push({
              companyId: pattern.companyId,
              employeeId,
              shiftPatternId: pattern.id,
              shiftGroupId: group.id,
              workDate,
              slotIndex,
              slotName: slot.name,
              startTime: slot.start,
              endTime: slot.end,
              breakMinutes: slot.breakMin ?? 0,
              isNightShift: slot.nightPremium ?? false,
              status: 'SCHEDULED',
            })
          }
        }
      }

      let createdCount = 0
      const skippedCount = 0

      await prisma.$transaction(async (tx) => {
        // 기존 스케줄 삭제 후 재생성 (upsert N+1 대체)
        await tx.shiftSchedule.deleteMany({
          where: {
            employeeId: { in: allEmployeeIds },
            workDate: { gte: monthStart, lte: monthEnd },
          },
        })
        const result = await tx.shiftSchedule.createMany({
          data: scheduleRecords,
          skipDuplicates: true,
        })
        createdCount = result.count
      })

      return apiSuccess(
        {
          shiftPatternId,
          year,
          month,
          groupCount: groups.length,
          totalGenerated: createdCount,
          skipped: skippedCount,
        },
        201,
      )
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.ATTENDANCE, ACTION.CREATE),
)
