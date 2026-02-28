import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { isAppError, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (
    _req: NextRequest,
    _context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    try {
      const companyId = user.companyId
      const managerId = user.employeeId
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

      const teamMembers = await prisma.employee.findMany({
        where: { managerId, companyId, status: 'ACTIVE' },
        select: { id: true },
      })
      const teamIds = teamMembers.map((m) => m.id)
      const teamSize = teamIds.length

      if (teamSize === 0) {
        return apiSuccess({
          dimensions: [
            { name: '출근율', value: 0, fullMark: 100 },
            { name: '초과근무 준수', value: 0, fullMark: 100 },
            { name: '1:1 완료율', value: 0, fullMark: 100 },
            { name: '목표 진행률', value: 0, fullMark: 100 },
            { name: '칭찬 횟수', value: 0, fullMark: 100 },
          ],
        })
      }

      // 1. Attendance rate (working days with clock-in / total working days)
      const workingDays = Math.max(
        1,
        Math.ceil(
          (now.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24),
        ),
      )
      const attendanceCount = await prisma.attendance.count({
        where: {
          employeeId: { in: teamIds },
          workDate: { gte: monthStart },
          clockIn: { not: null },
        },
      })
      const attendanceRate = Math.min(
        100,
        Math.round(
          (attendanceCount / (teamSize * workingDays)) * 100,
        ),
      )

      // 2. Overtime compliance (% of team under 52h/week average)
      const overtimeRecords = await prisma.attendance.findMany({
        where: {
          employeeId: { in: teamIds },
          workDate: { gte: monthStart },
        },
        select: { employeeId: true, overtimeMinutes: true },
      })
      const overtimeByEmployee = new Map<string, number>()
      for (const r of overtimeRecords) {
        const curr = overtimeByEmployee.get(r.employeeId) ?? 0
        overtimeByEmployee.set(r.employeeId, curr + (r.overtimeMinutes ?? 0))
      }
      const weeks = Math.max(1, workingDays / 7)
      let compliantCount = 0
      for (const id of teamIds) {
        const totalMin = overtimeByEmployee.get(id) ?? 0
        const weeklyHours = totalMin / 60 / weeks
        if (weeklyHours <= 12) compliantCount++ // 52h - 40h = 12h overtime
      }
      const overtimeCompliance = Math.round(
        (compliantCount / teamSize) * 100,
      )

      // 3. 1:1 completion rate
      const [totalOneOnOnes, completedOneOnOnes] = await Promise.all([
        prisma.oneOnOne.count({
          where: {
            managerId,
            companyId,
            scheduledAt: { gte: monthStart },
          },
        }),
        prisma.oneOnOne.count({
          where: {
            managerId,
            companyId,
            status: 'COMPLETED',
            scheduledAt: { gte: monthStart },
          },
        }),
      ])
      const oneOnOneRate =
        totalOneOnOnes > 0
          ? Math.round((completedOneOnOnes / totalOneOnOnes) * 100)
          : 100

      // 4. Goal progress (average achievement score of approved goals)
      const goals = await prisma.mboGoal.findMany({
        where: {
          employeeId: { in: teamIds },
          companyId,
          status: 'APPROVED',
          achievementScore: { not: null },
        },
        select: { achievementScore: true },
      })
      const goalProgress =
        goals.length > 0
          ? Math.round(
              goals.reduce(
                (sum, g) => sum + Number(g.achievementScore),
                0,
              ) / goals.length,
            )
          : 0

      // 5. Praise count (normalized to 100)
      const praiseCount = await prisma.recognition.count({
        where: {
          receiverId: { in: teamIds },
          createdAt: { gte: monthStart },
        },
      })
      const praiseScore = Math.min(
        100,
        Math.round((praiseCount / teamSize) * 20),
      ) // 5 praises per person = 100

      return apiSuccess({
        dimensions: [
          { name: '출근율', value: attendanceRate, fullMark: 100 },
          { name: '초과근무 준수', value: overtimeCompliance, fullMark: 100 },
          { name: '1:1 완료율', value: oneOnOneRate, fullMark: 100 },
          { name: '목표 진행률', value: goalProgress, fullMark: 100 },
          { name: '칭찬 횟수', value: praiseScore, fullMark: 100 },
        ],
      })
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.EMPLOYEES, ACTION.VIEW),
)
