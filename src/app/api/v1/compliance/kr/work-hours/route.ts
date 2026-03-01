// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 52-Hour Work Hours Dashboard
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { apiSuccess } from '@/lib/api'
import { badRequest } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { workHoursQuerySchema } from '@/lib/schemas/compliance'
import { getWeeklyWorkHoursSummary } from '@/lib/compliance/kr'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (req: NextRequest, _context, user: SessionUser) => {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = workHoursQuerySchema.safeParse(params)
    if (!parsed.success) throw badRequest('Invalid parameters', { issues: parsed.error.issues })

    // Default to current week's Monday
    let weekStart: Date
    if (parsed.data.weekStart) {
      weekStart = new Date(parsed.data.weekStart)
    } else {
      weekStart = new Date()
      const day = weekStart.getDay()
      const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1)
      weekStart.setDate(diff)
      weekStart.setHours(0, 0, 0, 0)
    }

    const summary = await getWeeklyWorkHoursSummary(user.companyId, weekStart)
    return apiSuccess(summary)
  },
  perm(MODULE.COMPLIANCE, ACTION.VIEW),
)
