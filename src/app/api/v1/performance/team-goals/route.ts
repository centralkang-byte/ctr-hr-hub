// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Team Goals (Manager View)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { badRequest, forbidden } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { getDirectReportIds } from '@/lib/employee/direct-reports'
import type { SessionUser } from '@/types'

// ─── Manager+ only roles ────────────────────────────────
const MANAGER_UP: Set<string> = new Set([ROLE.SUPER_ADMIN, ROLE.HR_ADMIN, ROLE.EXECUTIVE, ROLE.MANAGER])

// ─── Schema ──────────────────────────────────────────────

const querySchema = z.object({
  cycleId: z.string().uuid(),
})

// ─── GET /api/v1/performance/team-goals ──────────────────
// Manager's team goals view: goals grouped by direct report

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    if (!MANAGER_UP.has(user.role as string)) {
      throw forbidden('매니저 이상 권한이 필요합니다.')
    }

    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = querySchema.safeParse(params)
    if (!parsed.success) {
      throw badRequest('cycleId 파라미터가 필요합니다.', { issues: parsed.error.issues })
    }

    const { cycleId } = parsed.data

    // Find direct reports via position hierarchy
    const reportIds = await getDirectReportIds(user.employeeId)
    const directReports = await prisma.employee.findMany({
      where: {
        id: { in: reportIds },
        deletedAt: null,
        assignments: {
          some: { companyId: user.companyId, isPrimary: true, endDate: null },
        },
      },
      select: {
        id: true,
        name: true,
        employeeNo: true,
        email: true,
        assignments: {
          where: { isPrimary: true, endDate: null },
          take: 1,
          include: {
            department: { select: { id: true, name: true } },
            jobGrade: { select: { id: true, name: true } },
          },
        },
      },
    })

    if (directReports.length === 0) {
      return apiSuccess([])
    }

    const directReportIds = directReports.map((r) => r.id)

    // Get goals for all direct reports in this cycle
    const goals = await prisma.mboGoal.findMany({
      where: {
        cycleId,
        employeeId: { in: directReportIds },
        companyId: user.companyId,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        progress: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { progressPct: true, createdAt: true },
        },
      },
    })

    // Group goals by employee
    const goalsByEmployee = new Map<string, typeof goals>()
    for (const goal of goals) {
      const existing = goalsByEmployee.get(goal.employeeId) ?? []
      existing.push(goal)
      goalsByEmployee.set(goal.employeeId, existing)
    }

    // Build response grouped by employee
    const result = directReports.map((emp) => {
      const empGoals = goalsByEmployee.get(emp.id) ?? []
      const totalWeight = empGoals.reduce((sum, g) => sum + Number(g.weight), 0)
      const avgProgress = empGoals.length > 0
        ? empGoals.reduce((sum, g) => {
            const latest = g.progress[0]
            return sum + (latest?.progressPct ?? 0)
          }, 0) / empGoals.length
        : 0

      return {
        employee: emp,
        goals: empGoals.map((g) => ({
          ...g,
          weight: Number(g.weight),
          achievementScore: g.achievementScore ? Number(g.achievementScore) : null,
        })),
        totalWeight,
        avgProgress: Math.round(avgProgress * 100) / 100,
      }
    })

    return apiSuccess(result)
  },
  perm(MODULE.PERFORMANCE, ACTION.VIEW),
)
