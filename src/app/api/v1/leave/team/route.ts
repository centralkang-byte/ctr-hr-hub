// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Team Leave Calendar API (Manager View)
// GET /api/v1/leave/team
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const { searchParams } = new URL(req.url)

    // 1. Determine target month
    const monthParam = searchParams.get('month') // YYYY-MM
    const now = new Date()
    const targetMonth = monthParam ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    const [year, month] = targetMonth.split('-').map(Number)
    const monthStart = new Date(year, month - 1, 1)
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999)

    // 2. Get manager's department
    const manager = await prisma.employee.findUnique({
      where: { id: user.employeeId },
      select: { departmentId: true },
    })

    if (!manager?.departmentId) {
      return apiSuccess({ month: targetMonth, members: [] })
    }

    // 3. Get team members
    const teamMembers = await prisma.employee.findMany({
      where: {
        departmentId: manager.departmentId,
        companyId: user.companyId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        employeeNo: true,
        jobGrade: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    })

    if (teamMembers.length === 0) {
      return apiSuccess({ month: targetMonth, members: [] })
    }

    // 4. Get all leave requests for the month (PENDING + APPROVED)
    const employeeIds = teamMembers.map((emp) => emp.id)
    const leaveRequests = await prisma.leaveRequest.findMany({
      where: {
        employeeId: { in: employeeIds },
        status: { in: ['PENDING', 'APPROVED'] },
        startDate: { lte: monthEnd },
        endDate: { gte: monthStart },
      },
      include: {
        policy: { select: { leaveType: true } },
      },
    })

    // 5. Build lookup map by employeeId
    const requestMap = new Map<string, typeof leaveRequests>()
    for (const r of leaveRequests) {
      const existing = requestMap.get(r.employeeId) ?? []
      existing.push(r)
      requestMap.set(r.employeeId, existing)
    }

    // 6. Combine and return
    const members = teamMembers.map((emp) => {
      const empRequests = requestMap.get(emp.id) ?? []
      return {
        employeeId: emp.id,
        name: emp.name,
        requests: empRequests.map((r) => ({
          id: r.id,
          startDate: r.startDate,
          endDate: r.endDate,
          days: r.days,
          status: r.status,
          leaveType: r.policy?.leaveType ?? 'UNKNOWN',
        })),
      }
    })

    return apiSuccess({ month: targetMonth, members })
  },
  perm(MODULE.LEAVE, ACTION.VIEW),
)
