// ═══════════════════════════════════════════════════════════
// CTR HR Hub — GET /api/v1/attendance/admin/trends
// HR 근태 추세 탭 — 부서별 30일 비교 + 출근시각 분포 + 근태유형 추이.
// 전부 Attendance/LeaveRequest 행 SQL 집계 (출근율% 분모 엔진은 PR-4b 분리).
// RBAC·멀티테넌트 게이트는 /attendance/admin/weekly 와 동일. 미캐시(실시간 형제 정합).
// ═══════════════════════════════════════════════════════════

import { type NextRequest } from 'next/server'
import { apiSuccess } from '@/lib/api'
import { forbidden } from '@/lib/errors'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION, ROLE } from '@/lib/constants'
import { resolveCompanyId } from '@/lib/api/companyFilter'
import { getAttendanceTrends } from '@/lib/attendance/trends'
import type { SessionUser } from '@/types'

export const GET = withPermission(
  async (
    req: NextRequest,
    _context: { params: Promise<Record<string, string>> },
    user: SessionUser,
  ) => {
    // 전사 근태 추세 = HR 전용 (라이브 /attendance/admin·weekly 스코프와 정합 — EXECUTIVE 제외, att-05)
    if (user.role !== ROLE.HR_ADMIN && user.role !== ROLE.SUPER_ADMIN) {
      throw forbidden('전체 근태 추세 조회 권한이 없습니다.')
    }

    const { searchParams } = new URL(req.url)
    // 멀티테넌트: 비-SUPER는 자기 법인 강제 (resolveCompanyId SSOT)
    const companyId = resolveCompanyId(user, searchParams.get('companyId'))

    const trends = await getAttendanceTrends(companyId, new Date())
    return apiSuccess(trends)
  },
  // /attendance/admin·weekly 와 동일 게이트(att-05): HR 전용
  perm(MODULE.ATTENDANCE, ACTION.APPROVE),
)
