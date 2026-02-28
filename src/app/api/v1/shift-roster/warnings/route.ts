// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/shift-roster/warnings
// 근무 배정 경고 (주 52시간 초과 등)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { isAppError, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

// ─── GET — 경고 목록 ────────────────────────────────────────

export const GET = withPermission(
  async (_req: NextRequest, _context, user: SessionUser) => {
    try {
      const companyFilter =
        user.role === 'SUPER_ADMIN' ? {} : { companyId: user.companyId }

      // SHIFT 타입 스케줄이 배정된 직원 조회
      const shiftSchedules = await prisma.employeeSchedule.findMany({
        where: {
          employee: companyFilter,
          schedule: { scheduleType: { in: ['SHIFT_2', 'SHIFT_3'] } },
        },
        include: {
          employee: {
            select: { id: true, name: true, employeeNo: true },
          },
          schedule: {
            select: { name: true, weeklyHours: true },
          },
        },
      })

      const warnings: {
        employeeId: string
        employeeName: string
        type: string
        message: string
      }[] = []

      for (const entry of shiftSchedules) {
        // weeklyHours는 Decimal 타입이므로 Number로 변환
        const weeklyHours = Number(entry.schedule.weeklyHours)

        if (weeklyHours > 52) {
          warnings.push({
            employeeId: entry.employee.id,
            employeeName: entry.employee.name,
            type: 'WEEKLY_HOURS_EXCEEDED',
            message: `${entry.employee.name}: 주 ${weeklyHours}시간 초과 (최대 52시간)`,
          })
        }
      }

      return apiSuccess({ warnings })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.ATTENDANCE, ACTION.VIEW),
)
