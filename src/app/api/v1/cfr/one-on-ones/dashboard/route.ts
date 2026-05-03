// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 1:1 Meeting Dashboard (Manager View)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withAuth } from '@/lib/permissions'
import { forbidden } from '@/lib/errors'
import { getDirectReportIds } from '@/lib/employee/direct-reports'
import type { SessionUser } from '@/types'

// Route-local allowlist (Session 187 pattern). Original guard was
// perm(PERFORMANCE, APPROVE='manage'); MANAGER's seed perms (seed.ts:151)
// only include performance_read/create/update — no _manage — so the 1:1
// dashboard, semantically a manager view, 403'd. Explicit allowlist avoids
// expanding module-wide 'manage' perm to other performance routes.
const ONE_ON_ONE_DASHBOARD_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'EXECUTIVE'] as const

// ─── GET /api/v1/cfr/one-on-ones/dashboard ───────────────

export const GET = withAuth(
  async (_req: NextRequest, _context, user: SessionUser) => {
    if (!ONE_ON_ONE_DASHBOARD_ROLES.includes(user.role as typeof ONE_ON_ONE_DASHBOARD_ROLES[number])) {
      throw forbidden()
    }
    // Get direct reports via position hierarchy
    const reportIds = await getDirectReportIds(user.employeeId)
    const teamMembers = await prisma.employee.findMany({
      where: {
        id: { in: reportIds },
        assignments: {
          some: {
            companyId: user.companyId,
            isPrimary: true,
            endDate: null,
            status: 'ACTIVE',
          },
        },
      },
      select: { id: true, name: true, employeeNo: true },
    })

    const memberIds = teamMembers.map((m) => m.id)

    // Get all 1:1 meetings for the last 6 months
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const meetings = await prisma.oneOnOne.findMany({
      where: {
        managerId: user.employeeId,
        companyId: user.companyId,
        employeeId: { in: memberIds },
        status: 'COMPLETED',
        completedAt: { gte: sixMonthsAgo },
      },
      select: { employeeId: true, completedAt: true },
      orderBy: { completedAt: 'desc' },
    })

    // Build monthly counts per team member
    const now = new Date()
    const teamStats = teamMembers.map((member) => {
      const memberMeetings = meetings.filter((m) => m.employeeId === member.id)
      const monthlyCounts: Record<string, number> = {}

      for (let i = 0; i < 6; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        monthlyCounts[key] = 0
      }

      for (const m of memberMeetings) {
        if (m.completedAt) {
          const key = `${m.completedAt.getFullYear()}-${String(m.completedAt.getMonth() + 1).padStart(2, '0')}`
          if (key in monthlyCounts) monthlyCounts[key]++
        }
      }

      const lastMeeting = memberMeetings[0]?.completedAt ?? null
      const daysSinceLast = lastMeeting
        ? Math.floor((now.getTime() - lastMeeting.getTime()) / (1000 * 60 * 60 * 24))
        : 999

      return {
        employeeId: member.id,
        name: member.name,
        monthlyCounts,
        lastOneOnOneDate: lastMeeting?.toISOString() ?? null,
        overdue: daysSinceLast > 30,
      }
    })

    // Get pending action items from all completed meetings
    const recentMeetings = await prisma.oneOnOne.findMany({
      where: {
        managerId: user.employeeId,
        companyId: user.companyId,
        status: 'COMPLETED',
        actionItems: { not: null as unknown as undefined },
      },
      select: { employeeId: true, actionItems: true },
      orderBy: { completedAt: 'desc' },
      take: 50,
    })

    type ActionItem = { item: string; assignee: string; dueDate?: string; completed: boolean }
    const pendingActions: { employeeName: string; item: string; dueDate: string }[] = []
    const memberMap = new Map(teamMembers.map((m) => [m.id, m.name]))

    for (const m of recentMeetings) {
      const items = m.actionItems as ActionItem[] | null
      if (!items) continue
      for (const ai of items) {
        if (!ai.completed) {
          pendingActions.push({
            employeeName: memberMap.get(m.employeeId) ?? '',
            item: ai.item,
            dueDate: ai.dueDate ?? '',
          })
        }
      }
    }

    return apiSuccess({
      teamMembers: teamStats,
      pendingActionItems: pendingActions.slice(0, 20),
    })
  },
)
