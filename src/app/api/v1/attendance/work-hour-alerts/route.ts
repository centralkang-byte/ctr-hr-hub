// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/attendance/work-hour-alerts (B6-1)
// 법인 내 52시간 경고 목록 (HR Admin용)
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { apiSuccess } from '@/lib/api'
import { forbidden, isAppError, handlePrismaError } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { getCompanyAlerts } from '@/lib/attendance/workHourAlert'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (
    req: NextRequest,
    _context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    try {
      // 법인 전체 52h 경고(이름·이메일 포함)는 HR 전용 — EMPLOYEE 직접 호출 차단 (att-04)
      if (user.role !== ROLE.HR_ADMIN && user.role !== ROLE.SUPER_ADMIN) {
        throw forbidden('52시간 경고 목록 조회 권한이 없습니다.')
      }

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
