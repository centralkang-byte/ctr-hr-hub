// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Leave Admin Dashboard API (HR)
// GET /api/v1/leave/admin
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const { searchParams } = new URL(req.url)

    // 1. Determine target company and year
    const queryCompanyId = searchParams.get('companyId')
    const companyId =
      user.role === ROLE.SUPER_ADMIN && queryCompanyId
        ? queryCompanyId
        : user.companyId
    const yearParam = searchParams.get('year')
    const year = yearParam ? Number(yearParam) : new Date().getFullYear()

    const companyFilter = user.role === ROLE.SUPER_ADMIN ? {} : { companyId: user.companyId }
    const effectiveCompanyFilter = { companyId }

    // 2. Leave request stats by status for the year
    const yearStart = new Date(year, 0, 1)
    const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999)

    const statusCounts = await prisma.leaveRequest.groupBy({
      by: ['status'],
      where: {
        ...effectiveCompanyFilter,
        createdAt: { gte: yearStart, lte: yearEnd },
      },
      _count: { id: true },
    })

    const stats = {
      PENDING: 0,
      APPROVED: 0,
      REJECTED: 0,
      CANCELLED: 0,
    }
    for (const row of statusCounts) {
      const status = row.status as keyof typeof stats
      if (status in stats) {
        stats[status] = row._count.id
      }
    }

    // 3. Department-level usage for charts
    // Get all departments for this company
    const departments = await prisma.department.findMany({
      where: {
        ...effectiveCompanyFilter,
        deletedAt: null,
        isActive: true,
      },
      select: { id: true, name: true },
    })

    // Get all employees grouped by department
    const employees = await prisma.employee.findMany({
      where: {
        ...effectiveCompanyFilter,
        deletedAt: null,
      },
      select: { id: true, departmentId: true },
    })

    // Build employee → department map
    const empDeptMap = new Map<string, string>()
    for (const emp of employees) {
      empDeptMap.set(emp.id, emp.departmentId)
    }

    // Get all leave balances for the year
    const balances = await prisma.employeeLeaveBalance.findMany({
      where: {
        employeeId: { in: employees.map((e) => e.id) },
        year,
      },
    })

    // Aggregate by department
    const deptUsageMap = new Map<
      string,
      { totalGranted: number; totalUsed: number }
    >()

    for (const b of balances) {
      const deptId = empDeptMap.get(b.employeeId)
      if (!deptId) continue

      const existing = deptUsageMap.get(deptId) ?? { totalGranted: 0, totalUsed: 0 }
      existing.totalGranted += Number(b.grantedDays) + Number(b.carryOverDays)
      existing.totalUsed += Number(b.usedDays)
      deptUsageMap.set(deptId, existing)
    }

    // Build department name map
    const deptNameMap = new Map(departments.map((d) => [d.id, d.name]))

    const departmentUsage = Array.from(deptUsageMap.entries()).map(
      ([deptId, usage]) => ({
        departmentId: deptId,
        departmentName: deptNameMap.get(deptId) ?? 'Unknown',
        totalGranted: usage.totalGranted,
        totalUsed: usage.totalUsed,
        usageRate:
          usage.totalGranted > 0
            ? Math.round((usage.totalUsed / usage.totalGranted) * 100 * 10) / 10
            : 0,
      }),
    )

    return apiSuccess({ year, stats, departmentUsage })
  },
  perm(MODULE.LEAVE, ACTION.APPROVE),
)
