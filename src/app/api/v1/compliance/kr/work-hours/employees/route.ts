// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Employee Weekly Work Hours List
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { apiPaginated, buildPagination } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { workHoursEmployeesSchema } from '@/lib/schemas/compliance'
import { getEmployeeWorkHours } from '@/lib/compliance/kr'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = workHoursEmployeesSchema.safeParse(params)
    if (!parsed.success) throw badRequest('Invalid parameters', { issues: parsed.error.issues })

    const { page, limit, weekStart, status } = parsed.data

    let startDate: Date
    if (weekStart) {
      startDate = new Date(weekStart)
    } else {
      startDate = new Date()
      const day = startDate.getDay()
      const diff = startDate.getDate() - day + (day === 0 ? -6 : 1)
      startDate.setDate(diff)
      startDate.setHours(0, 0, 0, 0)
    }

    const result = await getEmployeeWorkHours(user.companyId, startDate, page, limit)

    const filtered = status
      ? result.data.filter((e) => e.status === status)
      : result.data

    return apiPaginated(filtered, buildPagination(page, limit, result.total))
  },
  perm(MODULE.COMPLIANCE, ACTION.VIEW),
)
