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

      // 4. Generate schedule entries for each group and member
      let createdCount = 0
      let skippedCount = 0

      await prisma.$transaction(async (tx) => {
        for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
          const group = groups[groupIndex]
          const memberEmployeeIds = group.members.map((m) => m.employeeId)

          if (memberEmployeeIds.length === 0) continue

          for (const day of daysInMonth) {
            // Calculate the day's position in the cycle
            // Each group is offset by groupIndex to stagger shifts
            const dayOfYear = Math.floor(
              (day.getTime() - new Date(year, 0, 1).getTime()) / (1000 * 60 * 60 * 24),
            )
            const cyclePosition = (dayOfYear + groupIndex) % cycleDays

            // Determine which slot this day falls on
            // If cycleDays > slots.length, extra days are rest days (no schedule)
            const slotIndex = cyclePosition % slots.length
            const isRestDay = cyclePosition >= slots.length

            if (isRestDay) continue

            const slot = slots[slotIndex]
            const workDate = new Date(format(day, 'yyyy-MM-dd'))

            for (const employeeId of memberEmployeeIds) {
              try {
                await tx.shiftSchedule.upsert({
                  where: {
                    employeeId_workDate: {
                      employeeId,
                      workDate,
                    },
                  },
                  update: {
                    shiftPatternId: pattern.id,
                    shiftGroupId: group.id,
                    slotIndex,
                    slotName: slot.name,
                    startTime: slot.start,
                    endTime: slot.end,
                    breakMinutes: slot.breakMin ?? 0,
                    isNightShift: slot.nightPremium ?? false,
                    status: 'SCHEDULED',
                  },
                  create: {
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
                  },
                })
                createdCount++
              } catch {
                // Skip on unexpected conflicts
                skippedCount++
              }
            }
          }
        }
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
