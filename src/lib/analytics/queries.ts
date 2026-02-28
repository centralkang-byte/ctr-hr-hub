// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Analytics MV Query Helpers
// 모든 Materialized View에 대한 raw query 함수
// ═══════════════════════════════════════════════════════════

import { prisma } from '@/lib/prisma'
import type {
  HeadcountRow,
  AttendanceWeeklyRow,
  PerformanceSummaryRow,
  RecruitmentFunnelRow,
  BurnoutRiskRow,
  TeamHealthRow,
  ExitReasonMonthlyRow,
  CompaRatioRow,
} from './types'

// ─── Helper: company filter clause ──────────────────────

function companyWhere(companyId?: string, alias = ''): { clause: string; params: string[] } {
  const col = alias ? `${alias}.company_id` : 'company_id'
  if (!companyId) return { clause: '', params: [] }
  return { clause: `AND ${col} = $1`, params: [companyId] }
}

// ─── Headcount ──────────────────────────────────────────

export async function getHeadcountSummary(companyId?: string) {
  const { clause, params } = companyWhere(companyId)
  return prisma.$queryRawUnsafe<
    { total_headcount: bigint; new_hires_30d: bigint; resignations_30d: bigint }[]
  >(
    `SELECT
      SUM(headcount)::bigint AS total_headcount,
      SUM(new_hires_30d)::bigint AS new_hires_30d,
      SUM(resignations_30d)::bigint AS resignations_30d
    FROM mv_headcount_daily
    WHERE 1=1 ${clause}`,
    ...params,
  )
}

export async function getHeadcountByDepartment(companyId?: string) {
  const { clause, params } = companyWhere(companyId, 'h')
  return prisma.$queryRawUnsafe<
    { department_id: string; department_name: string; headcount: bigint }[]
  >(
    `SELECT h.department_id, d.name AS department_name, SUM(h.headcount)::bigint AS headcount
    FROM mv_headcount_daily h
    JOIN departments d ON d.id = h.department_id
    WHERE 1=1 ${clause}
    GROUP BY h.department_id, d.name
    ORDER BY headcount DESC`,
    ...params,
  )
}

export async function getHeadcountByEmploymentType(companyId?: string) {
  const { clause, params } = companyWhere(companyId)
  return prisma.$queryRawUnsafe<
    { employment_type: string; headcount: bigint }[]
  >(
    `SELECT employment_type, SUM(headcount)::bigint AS headcount
    FROM mv_headcount_daily
    WHERE 1=1 ${clause}
    GROUP BY employment_type
    ORDER BY headcount DESC`,
    ...params,
  )
}

export async function getHeadcountByGrade(companyId?: string) {
  const { clause, params } = companyWhere(companyId, 'e')
  return prisma.$queryRawUnsafe<
    { grade_code: string; grade_name: string; headcount: bigint }[]
  >(
    `SELECT jg.code AS grade_code, jg.name AS grade_name, COUNT(*)::bigint AS headcount
    FROM employees e
    JOIN job_grades jg ON jg.id = e.job_grade_id
    WHERE e.status IN ('ACTIVE', 'ON_LEAVE') AND e.deleted_at IS NULL ${clause}
    GROUP BY jg.code, jg.name
    ORDER BY jg.code`,
    ...params,
  )
}

// ─── Attendance ─────────────────────────────────────────

export async function getAttendanceWeekly(companyId?: string, weeks = 12) {
  const { clause, params } = companyWhere(companyId, 'e')
  return prisma.$queryRawUnsafe<
    { week_start: Date; avg_total_hours: number; avg_overtime_hours: number }[]
  >(
    `SELECT a.week_start,
      ROUND(AVG(a.total_hours)::numeric, 1) AS avg_total_hours,
      ROUND(AVG(a.overtime_hours)::numeric, 1) AS avg_overtime_hours
    FROM mv_attendance_weekly a
    JOIN employees e ON e.id = a.employee_id
    WHERE a.week_start >= CURRENT_DATE - INTERVAL '${weeks} weeks' ${clause}
    GROUP BY a.week_start
    ORDER BY a.week_start`,
    ...params,
  )
}

export async function getOvertimeByDepartment(companyId?: string) {
  const { clause, params } = companyWhere(companyId, 'e')
  return prisma.$queryRawUnsafe<
    { department_name: string; avg_overtime_hours: number }[]
  >(
    `SELECT d.name AS department_name,
      ROUND(AVG(a.overtime_hours)::numeric, 1) AS avg_overtime_hours
    FROM mv_attendance_weekly a
    JOIN employees e ON e.id = a.employee_id
    JOIN departments d ON d.id = e.department_id
    WHERE a.week_start >= CURRENT_DATE - INTERVAL '4 weeks' ${clause}
    GROUP BY d.name
    ORDER BY avg_overtime_hours DESC
    LIMIT 10`,
    ...params,
  )
}

export async function getAttendanceIssues(companyId?: string, weeks = 12) {
  const { clause, params } = companyWhere(companyId, 'e')
  return prisma.$queryRawUnsafe<
    { week_start: Date; late_count: bigint; absent_count: bigint; early_out_count: bigint }[]
  >(
    `SELECT a.week_start,
      SUM(a.late_count)::bigint AS late_count,
      SUM(a.absent_count)::bigint AS absent_count,
      SUM(a.early_out_count)::bigint AS early_out_count
    FROM mv_attendance_weekly a
    JOIN employees e ON e.id = a.employee_id
    WHERE a.week_start >= CURRENT_DATE - INTERVAL '${weeks} weeks' ${clause}
    GROUP BY a.week_start
    ORDER BY a.week_start`,
    ...params,
  )
}

export async function getOver52hCount(companyId?: string) {
  const { clause, params } = companyWhere(companyId, 'e')
  return prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(DISTINCT a.employee_id)::bigint AS count
    FROM mv_attendance_weekly a
    JOIN employees e ON e.id = a.employee_id
    WHERE a.week_start >= CURRENT_DATE - INTERVAL '1 week'
      AND a.total_hours > 52 ${clause}`,
    ...params,
  )
}

// ─── Performance ────────────────────────────────────────

export async function getPerformanceSummary(cycleId?: string, companyId?: string) {
  const params: string[] = []
  let paramIdx = 0
  let cycleClause = ''
  let companyClause = ''

  if (cycleId) {
    paramIdx++
    cycleClause = `AND ps.cycle_id = $${paramIdx}`
    params.push(cycleId)
  }
  if (companyId) {
    paramIdx++
    companyClause = `AND d.company_id = $${paramIdx}`
    params.push(companyId)
  }

  return prisma.$queryRawUnsafe<PerformanceSummaryRow[]>(
    `SELECT ps.cycle_id, ps.department_id, ps.ems_block,
      ps.employee_count::int, ps.avg_performance_score, ps.avg_competency_score
    FROM mv_performance_summary ps
    JOIN departments d ON d.id = ps.department_id
    WHERE 1=1 ${cycleClause} ${companyClause}
    ORDER BY ps.department_id, ps.ems_block`,
    ...params,
  )
}

export async function getEmsBlockDistribution(cycleId?: string, companyId?: string) {
  const params: string[] = []
  let paramIdx = 0
  let cycleClause = ''
  let companyClause = ''

  if (cycleId) {
    paramIdx++
    cycleClause = `AND ps.cycle_id = $${paramIdx}`
    params.push(cycleId)
  }
  if (companyId) {
    paramIdx++
    companyClause = `AND d.company_id = $${paramIdx}`
    params.push(companyId)
  }

  return prisma.$queryRawUnsafe<
    { ems_block: string; employee_count: bigint }[]
  >(
    `SELECT ps.ems_block, SUM(ps.employee_count)::bigint AS employee_count
    FROM mv_performance_summary ps
    JOIN departments d ON d.id = ps.department_id
    WHERE 1=1 ${cycleClause} ${companyClause}
    GROUP BY ps.ems_block
    ORDER BY ps.ems_block`,
    ...params,
  )
}

export async function getPerformanceByDepartment(cycleId?: string, companyId?: string) {
  const params: string[] = []
  let paramIdx = 0
  let cycleClause = ''
  let companyClause = ''

  if (cycleId) {
    paramIdx++
    cycleClause = `AND ps.cycle_id = $${paramIdx}`
    params.push(cycleId)
  }
  if (companyId) {
    paramIdx++
    companyClause = `AND d.company_id = $${paramIdx}`
    params.push(companyId)
  }

  return prisma.$queryRawUnsafe<
    { department_name: string; avg_score: number }[]
  >(
    `SELECT d.name AS department_name,
      ROUND(AVG(ps.avg_performance_score)::numeric, 2) AS avg_score
    FROM mv_performance_summary ps
    JOIN departments d ON d.id = ps.department_id
    WHERE 1=1 ${cycleClause} ${companyClause}
    GROUP BY d.name
    ORDER BY avg_score DESC`,
    ...params,
  )
}

// ─── Recruitment ────────────────────────────────────────

export async function getRecruitmentFunnel(companyId?: string) {
  const { clause, params } = companyWhere(companyId)
  return prisma.$queryRawUnsafe<
    { stage: string; candidate_count: bigint }[]
  >(
    `SELECT stage, SUM(candidate_count)::bigint AS candidate_count
    FROM mv_recruitment_funnel
    WHERE 1=1 ${clause}
    GROUP BY stage
    ORDER BY candidate_count DESC`,
    ...params,
  )
}

export async function getRecruitmentByPosting(companyId?: string) {
  const { clause, params } = companyWhere(companyId)
  return prisma.$queryRawUnsafe<RecruitmentFunnelRow[]>(
    `SELECT posting_id, company_id, posting_title, stage,
      candidate_count::int, avg_screening_score
    FROM mv_recruitment_funnel
    WHERE 1=1 ${clause}
    ORDER BY posting_title, stage`,
    ...params,
  )
}

// ─── Burnout Risk ───────────────────────────────────────

export async function getBurnoutRiskList(companyId?: string) {
  const { clause, params } = companyWhere(companyId)
  return prisma.$queryRawUnsafe<BurnoutRiskRow[]>(
    `SELECT employee_id, name, company_id, department, job_category_code,
      consecutive_high_weeks::int, unused_days::int, days_since_last_one_on_one::int,
      is_burnout_warning, is_burnout_critical
    FROM mv_burnout_risk
    WHERE (is_burnout_warning = true OR is_burnout_critical = true) ${clause}
    ORDER BY is_burnout_critical DESC, consecutive_high_weeks DESC`,
    ...params,
  )
}

export async function getBurnoutRiskCount(companyId?: string) {
  const { clause, params } = companyWhere(companyId)
  return prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*)::bigint AS count
    FROM mv_burnout_risk
    WHERE (is_burnout_warning = true OR is_burnout_critical = true) ${clause}`,
    ...params,
  )
}

// ─── Team Health ────────────────────────────────────────

export async function getTeamHealthList(companyId?: string) {
  const { clause, params } = companyWhere(companyId)
  return prisma.$queryRawUnsafe<TeamHealthRow[]>(
    `SELECT department_id, department_name, company_id,
      team_size::int,
      ROUND(avg_performance_score::numeric, 2) AS avg_performance_score,
      ROUND(avg_competency_score::numeric, 2) AS avg_competency_score,
      ROUND(avg_late_count_4w::numeric, 1) AS avg_late_count_4w,
      ROUND(avg_overtime_hours_4w::numeric, 1) AS avg_overtime_hours_4w,
      ROUND(avg_unused_leave_days::numeric, 1) AS avg_unused_leave_days,
      one_on_one_coverage_pct
    FROM mv_team_health
    WHERE 1=1 ${clause}
    ORDER BY department_name`,
    ...params,
  )
}

// ─── Exit Reasons ───────────────────────────────────────

export async function getExitReasonTrend(companyId?: string, months = 12) {
  const { clause, params } = companyWhere(companyId)
  return prisma.$queryRawUnsafe<ExitReasonMonthlyRow[]>(
    `SELECT month, resign_type, primary_reason, company_id, count::int
    FROM mv_exit_reason_monthly
    WHERE month >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '${months} months') ${clause}
    ORDER BY month DESC`,
    ...params,
  )
}

export async function getExitReasonSummary(companyId?: string, months = 12) {
  const { clause, params } = companyWhere(companyId)
  return prisma.$queryRawUnsafe<
    { primary_reason: string; count: bigint }[]
  >(
    `SELECT COALESCE(primary_reason, '미분류') AS primary_reason, SUM(count)::bigint AS count
    FROM mv_exit_reason_monthly
    WHERE month >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '${months} months') ${clause}
    GROUP BY primary_reason
    ORDER BY count DESC`,
    ...params,
  )
}

export async function getExitByResignType(companyId?: string, months = 12) {
  const { clause, params } = companyWhere(companyId)
  return prisma.$queryRawUnsafe<
    { resign_type: string; count: bigint }[]
  >(
    `SELECT resign_type, SUM(count)::bigint AS count
    FROM mv_exit_reason_monthly
    WHERE month >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '${months} months') ${clause}
    GROUP BY resign_type
    ORDER BY count DESC`,
    ...params,
  )
}

export async function getMonthlyResignations(companyId?: string, months = 12) {
  const { clause, params } = companyWhere(companyId)
  return prisma.$queryRawUnsafe<
    { month: Date; resignations: bigint }[]
  >(
    `SELECT month, SUM(count)::bigint AS resignations
    FROM mv_exit_reason_monthly
    WHERE month >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '${months} months') ${clause}
    GROUP BY month
    ORDER BY month`,
    ...params,
  )
}

// ─── Compa Ratio ────────────────────────────────────────

export async function getCompaRatioDistribution(companyId?: string) {
  const { clause, params } = companyWhere(companyId)
  return prisma.$queryRawUnsafe<CompaRatioRow[]>(
    `SELECT company_id, job_category_code, grade_code, grade_name,
      employee_count::int, avg_compa_ratio, p25, median, p75
    FROM mv_compa_ratio_distribution
    WHERE 1=1 ${clause}
    ORDER BY grade_code`,
    ...params,
  )
}

export async function getCompaRatioByGrade(companyId?: string) {
  const { clause, params } = companyWhere(companyId)
  return prisma.$queryRawUnsafe<
    { grade_code: string; grade_name: string; avg_compa_ratio: number }[]
  >(
    `SELECT grade_code, grade_name,
      ROUND(AVG(avg_compa_ratio)::numeric, 3) AS avg_compa_ratio
    FROM mv_compa_ratio_distribution
    WHERE avg_compa_ratio IS NOT NULL ${clause}
    GROUP BY grade_code, grade_name
    ORDER BY grade_code`,
    ...params,
  )
}

export async function getCompaBandFit(companyId?: string) {
  const { clause, params } = companyWhere(companyId)
  return prisma.$queryRawUnsafe<
    { under: bigint; in_band: bigint; over: bigint }[]
  >(
    `SELECT
      SUM(CASE WHEN avg_compa_ratio < 0.9 THEN employee_count ELSE 0 END)::bigint AS under,
      SUM(CASE WHEN avg_compa_ratio >= 0.9 AND avg_compa_ratio <= 1.1 THEN employee_count ELSE 0 END)::bigint AS in_band,
      SUM(CASE WHEN avg_compa_ratio > 1.1 THEN employee_count ELSE 0 END)::bigint AS over
    FROM mv_compa_ratio_distribution
    WHERE avg_compa_ratio IS NOT NULL ${clause}`,
    ...params,
  )
}

// ─── MV Refresh ─────────────────────────────────────────

const MV_NAMES = [
  'mv_headcount_daily',
  'mv_attendance_weekly',
  'mv_performance_summary',
  'mv_recruitment_funnel',
  'mv_burnout_risk',
  'mv_team_health',
  'mv_exit_reason_monthly',
  'mv_compa_ratio_distribution',
]

export async function refreshAllMVs() {
  const results: { name: string; status: string }[] = []
  for (const mv of MV_NAMES) {
    try {
      await prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${mv}`)
      results.push({ name: mv, status: 'OK' })
    } catch {
      results.push({ name: mv, status: 'FAILED' })
    }
  }
  return results
}

// ─── Average Overtime (for KPI) ──────────────────────────

export async function getAvgOvertimeHours(companyId?: string) {
  const { clause, params } = companyWhere(companyId, 'e')
  return prisma.$queryRawUnsafe<{ avg_overtime_hours: number }[]>(
    `SELECT ROUND(AVG(a.overtime_hours)::numeric, 1) AS avg_overtime_hours
    FROM mv_attendance_weekly a
    JOIN employees e ON e.id = a.employee_id
    WHERE a.week_start >= CURRENT_DATE - INTERVAL '4 weeks' ${clause}`,
    ...params,
  )
}

// ─── Turnover Rate by Department ────────────────────────

export async function getTurnoverByDepartment(companyId?: string, months = 12) {
  const { clause, params } = companyWhere(companyId, 'e')
  return prisma.$queryRawUnsafe<
    { department_name: string; turnover_rate: number; resignations: bigint }[]
  >(
    `SELECT d.name AS department_name,
      COUNT(DISTINCT CASE WHEN eo.status = 'COMPLETED' THEN eo.employee_id END)::bigint AS resignations,
      ROUND(
        100.0 * COUNT(DISTINCT CASE WHEN eo.status = 'COMPLETED' THEN eo.employee_id END)
        / NULLIF(COUNT(DISTINCT e.id), 0)::numeric,
        1
      ) AS turnover_rate
    FROM employees e
    JOIN departments d ON d.id = e.department_id
    LEFT JOIN employee_offboarding eo ON eo.employee_id = e.id
      AND eo.last_working_date >= CURRENT_DATE - INTERVAL '${months} months'
    WHERE e.deleted_at IS NULL ${clause}
    GROUP BY d.name
    HAVING COUNT(DISTINCT CASE WHEN eo.status = 'COMPLETED' THEN eo.employee_id END) > 0
    ORDER BY turnover_rate DESC`,
    ...params,
  )
}
