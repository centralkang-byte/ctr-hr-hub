// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Analytics Attendance API
// GET /api/v1/analytics/attendance — 근태 분석
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { apiSuccess } from '@/lib/api'
import { withPermission, perm } from '@/lib/permissions'
import { MODULE, ACTION } from '@/lib/constants'
import { attendanceQuerySchema } from '@/lib/schemas/analytics'
import {
  getAttendanceWeekly,
  getOvertimeByDepartment,
  getAttendanceIssues,
  getOver52hCount,
} from '@/lib/analytics/queries'
import type { AttendanceData } from '@/lib/analytics/types'

export const GET = withPermission(
  async (req: NextRequest) => {
    const { searchParams } = new URL(req.url)
    const { company_id: companyId, weeks } = attendanceQuerySchema.parse({
      company_id: searchParams.get('company_id') ?? undefined,
      weeks: searchParams.get('weeks') ?? undefined,
    })

    const [weeklyRows, deptRows, issueRows, over52Rows] = await Promise.all([
      getAttendanceWeekly(companyId, weeks),
      getOvertimeByDepartment(companyId),
      getAttendanceIssues(companyId, weeks),
      getOver52hCount(companyId),
    ])

    const data: AttendanceData = {
      weeklyTrend: weeklyRows.map((r) => ({
        week_start: new Date(r.week_start).toISOString().slice(0, 10),
        avg_total_hours: Number(r.avg_total_hours),
        avg_overtime_hours: Number(r.avg_overtime_hours),
      })),
      overtimeByDept: deptRows.map((r) => ({
        department_name: r.department_name,
        avg_overtime_hours: Number(r.avg_overtime_hours),
      })),
      issuesTrend: issueRows.map((r) => ({
        week_start: new Date(r.week_start).toISOString().slice(0, 10),
        late_count: Number(r.late_count),
        absent_count: Number(r.absent_count),
        early_out_count: Number(r.early_out_count),
      })),
      over52hCount: Number(over52Rows[0]?.count ?? 0),
    }

    return apiSuccess(data)
  },
  perm(MODULE.ANALYTICS, ACTION.VIEW),
)
