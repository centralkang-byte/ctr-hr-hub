// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/attendance/work-hour-alerts (B6-1)
// 법인 내 52시간 경고 목록 (HR Admin용)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { apiSuccess } from '@/lib/api'
import { isAppError, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { getCompanyAlerts } from '@/lib/attendance/workHourAlert'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (
    req: NextRequest,
    _context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    try {
      const { searchParams } = new URL(req.url)
      const resolved = searchParams.get('resolved') === 'true'

      const alerts = await getCompanyAlerts(user.companyId, resolved)
      return apiSuccess(alerts)
    } catch (error) {
      if (isAppError(error)) throw error
      throw handlePrismaError(error)
    }
  },
  perm(MODULE.ATTENDANCE, ACTION.VIEW),
)
