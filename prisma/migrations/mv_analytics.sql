-- ================================================================
-- CTR HR Hub v3.2 — Materialized Views for Analytics
-- ================================================================
-- These MVs are designed for the analytics dashboard.
-- All MVs have UNIQUE INDEX to support REFRESH MATERIALIZED VIEW CONCURRENTLY.
-- Run this file manually after initial Prisma migration.
-- ================================================================

-- Required extension for vector similarity (used elsewhere, ensure it exists)
CREATE EXTENSION IF NOT EXISTS vector;

-- ================================================================
-- MV 1: mv_headcount_daily
-- Daily headcount by company, department, employment type, job category
-- ================================================================
DROP MATERIALIZED VIEW IF EXISTS mv_headcount_daily;

CREATE MATERIALIZED VIEW mv_headcount_daily AS
SELECT
  CURRENT_DATE AS snapshot_date,
  e.company_id,
  e.department_id,
  e.employment_type,
  e.job_category_id,
  COUNT(*) AS headcount,
  COUNT(*) FILTER (WHERE e.hire_date >= CURRENT_DATE - INTERVAL '30 days') AS new_hires_30d,
  COUNT(*) FILTER (WHERE e.resign_date IS NOT NULL
    AND e.resign_date >= CURRENT_DATE - INTERVAL '30 days') AS resignations_30d
FROM employees e
WHERE e.status IN ('ACTIVE', 'ON_LEAVE')
  AND e.deleted_at IS NULL
GROUP BY e.company_id, e.department_id, e.employment_type, e.job_category_id;

CREATE UNIQUE INDEX uq_headcount
  ON mv_headcount_daily(snapshot_date, company_id, department_id, employment_type, job_category_id);

-- ================================================================
-- MV 2: mv_attendance_weekly
-- Weekly attendance summary per employee
-- ================================================================
DROP MATERIALIZED VIEW IF EXISTS mv_attendance_weekly;

CREATE MATERIALIZED VIEW mv_attendance_weekly AS
SELECT
  a.employee_id,
  DATE_TRUNC('week', a.work_date)::DATE AS week_start,
  SUM(COALESCE(a.total_minutes, 0)) AS total_minutes,
  SUM(COALESCE(a.overtime_minutes, 0)) AS overtime_minutes,
  ROUND(SUM(COALESCE(a.total_minutes, 0)) / 60.0, 1) AS total_hours,
  ROUND(SUM(COALESCE(a.overtime_minutes, 0)) / 60.0, 1) AS overtime_hours,
  COUNT(*) FILTER (WHERE a.status = 'LATE') AS late_count,
  COUNT(*) FILTER (WHERE a.status = 'ABSENT') AS absent_count,
  COUNT(*) FILTER (WHERE a.status = 'EARLY_OUT') AS early_out_count,
  COUNT(*) AS work_days
FROM attendances a
GROUP BY a.employee_id, DATE_TRUNC('week', a.work_date);

CREATE UNIQUE INDEX uq_att_weekly
  ON mv_attendance_weekly(employee_id, week_start);

-- ================================================================
-- MV 3: mv_performance_summary
-- Performance review summary by cycle, department, EMS 9-block
-- ================================================================
DROP MATERIALIZED VIEW IF EXISTS mv_performance_summary;

CREATE MATERIALIZED VIEW mv_performance_summary AS
SELECT
  pe.cycle_id,
  e.department_id,
  pe.ems_block,
  COUNT(*) AS employee_count,
  AVG(pe.performance_score) AS avg_performance_score,
  AVG(pe.competency_score) AS avg_competency_score
FROM performance_evaluations pe
JOIN employees e ON e.id = pe.employee_id
WHERE pe.eval_type = 'MANAGER'
  AND pe.status = 'CONFIRMED'
  AND pe.ems_block IS NOT NULL
GROUP BY pe.cycle_id, e.department_id, pe.ems_block;

CREATE UNIQUE INDEX uq_perf_summary
  ON mv_performance_summary(cycle_id, department_id, ems_block);

-- ================================================================
-- MV 4: mv_recruitment_funnel
-- Recruitment pipeline by job posting and stage
-- ================================================================
DROP MATERIALIZED VIEW IF EXISTS mv_recruitment_funnel;

CREATE MATERIALIZED VIEW mv_recruitment_funnel AS
SELECT
  app.posting_id,
  jp.company_id,
  jp.title AS posting_title,
  app.stage,
  COUNT(*) AS candidate_count,
  AVG(app.ai_screening_score) AS avg_screening_score
FROM applications app
JOIN job_postings jp ON jp.id = app.posting_id
WHERE jp.deleted_at IS NULL
GROUP BY app.posting_id, jp.company_id, jp.title, app.stage;

CREATE UNIQUE INDEX uq_recruit_funnel
  ON mv_recruitment_funnel(posting_id, stage);

-- ================================================================
-- MV 5: mv_burnout_risk
-- Employee burnout risk calculation (complex: overtime + leave usage + 1:1 patterns)
-- Two levels: WARNING / CRITICAL
-- ================================================================
DROP MATERIALIZED VIEW IF EXISTS mv_burnout_risk;

CREATE MATERIALIZED VIEW mv_burnout_risk AS
WITH weekly_ot AS (
  SELECT employee_id,
    COUNT(*) FILTER (
      WHERE weekly_hours > 45
        AND week_start >= CURRENT_DATE - INTERVAL '28 days'
    ) AS high_weeks
  FROM (
    SELECT employee_id,
      DATE_TRUNC('week', clock_in) AS week_start,
      SUM(EXTRACT(EPOCH FROM (clock_out - clock_in))/3600) AS weekly_hours
    FROM attendances
    WHERE clock_out IS NOT NULL
    GROUP BY employee_id, DATE_TRUNC('week', clock_in)
  ) w GROUP BY employee_id
),
leave_unused AS (
  SELECT employee_id,
    COALESCE(SUM(granted_days - used_days - pending_days), 0) AS unused_days
  FROM employee_leave_balances
  WHERE year = EXTRACT(YEAR FROM CURRENT_DATE)
  GROUP BY employee_id
),
last_oo AS (
  SELECT employee_id,
    EXTRACT(DAY FROM NOW() - MAX(completed_at))::INT AS days_since
  FROM one_on_ones
  WHERE status = 'COMPLETED'
  GROUP BY employee_id
)
SELECT
  e.id AS employee_id, e.name,
  e.company_id,
  d.name AS department,
  jc.code AS job_category_code,
  COALESCE(wo.high_weeks, 0) AS consecutive_high_weeks,
  COALESCE(lu.unused_days, 0) AS unused_days,
  COALESCE(lo.days_since, 999) AS days_since_last_one_on_one,
  (CASE
    WHEN (COALESCE(wo.high_weeks, 0) >= 4)::INT
       + (COALESCE(lu.unused_days, 0) >= 45)::INT
       + (COALESCE(lo.days_since, 999) >= 30)::INT >= 2
    THEN true ELSE false END) AS is_burnout_warning,
  (COALESCE(wo.high_weeks, 0) >= 4
    AND COALESCE(lu.unused_days, 0) >= 45
    AND COALESCE(lo.days_since, 999) >= 30) AS is_burnout_critical
FROM employees e
JOIN departments d ON e.department_id = d.id
JOIN job_categories jc ON e.job_category_id = jc.id
LEFT JOIN weekly_ot wo ON wo.employee_id = e.id
LEFT JOIN leave_unused lu ON lu.employee_id = e.id
LEFT JOIN last_oo lo ON lo.employee_id = e.id
WHERE e.status = 'ACTIVE' AND e.deleted_at IS NULL;

CREATE UNIQUE INDEX uq_burnout_risk ON mv_burnout_risk(employee_id);

-- ================================================================
-- MV 6: mv_team_health
-- Team health metrics (performance + attendance + leave balance)
-- ================================================================
DROP MATERIALIZED VIEW IF EXISTS mv_team_health;

CREATE MATERIALIZED VIEW mv_team_health AS
SELECT
  e.department_id,
  d.name AS department_name,
  d.company_id,
  COUNT(*) AS team_size,
  -- Performance: avg latest manager eval scores
  AVG(latest_eval.performance_score) AS avg_performance_score,
  AVG(latest_eval.competency_score) AS avg_competency_score,
  -- Attendance: avg late count in last 4 weeks
  AVG(att_summary.late_count) AS avg_late_count_4w,
  AVG(att_summary.overtime_hours) AS avg_overtime_hours_4w,
  -- Leave balance: avg unused days
  AVG(lb.unused_days) AS avg_unused_leave_days,
  -- 1:1 coverage: pct of employees with a 1:1 in last 30 days
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE oo_recent.employee_id IS NOT NULL) / NULLIF(COUNT(*), 0),
    1
  ) AS one_on_one_coverage_pct
FROM employees e
JOIN departments d ON d.id = e.department_id
-- Latest manager evaluation per employee
LEFT JOIN LATERAL (
  SELECT pe.performance_score, pe.competency_score
  FROM performance_evaluations pe
  WHERE pe.employee_id = e.id
    AND pe.eval_type = 'MANAGER'
    AND pe.status = 'CONFIRMED'
  ORDER BY pe.created_at DESC
  LIMIT 1
) latest_eval ON true
-- Attendance summary last 4 weeks
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) FILTER (WHERE a.status = 'LATE') AS late_count,
    ROUND(SUM(COALESCE(a.overtime_minutes, 0)) / 60.0, 1) AS overtime_hours
  FROM attendances a
  WHERE a.employee_id = e.id
    AND a.work_date >= CURRENT_DATE - INTERVAL '28 days'
) att_summary ON true
-- Leave balance current year
LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(granted_days - used_days - pending_days), 0) AS unused_days
  FROM employee_leave_balances elb
  WHERE elb.employee_id = e.id
    AND elb.year = EXTRACT(YEAR FROM CURRENT_DATE)
) lb ON true
-- Recent 1:1
LEFT JOIN LATERAL (
  SELECT oo.employee_id
  FROM one_on_ones oo
  WHERE oo.employee_id = e.id
    AND oo.status = 'COMPLETED'
    AND oo.completed_at >= CURRENT_DATE - INTERVAL '30 days'
  LIMIT 1
) oo_recent ON true
WHERE e.status = 'ACTIVE' AND e.deleted_at IS NULL
GROUP BY e.department_id, d.name, d.company_id;

CREATE UNIQUE INDEX uq_team_health ON mv_team_health(department_id);

-- ================================================================
-- MV 7: mv_exit_reason_monthly
-- Monthly exit reasons by company
-- ================================================================
DROP MATERIALIZED VIEW IF EXISTS mv_exit_reason_monthly;

CREATE MATERIALIZED VIEW mv_exit_reason_monthly AS
SELECT
  DATE_TRUNC('month', eo.last_working_date) AS month,
  eo.resign_type,
  ei.primary_reason,
  e.company_id,
  COUNT(*) AS count
FROM employee_offboarding eo
JOIN employees e ON e.id = eo.employee_id
LEFT JOIN exit_interviews ei ON ei.employee_offboarding_id = eo.id
WHERE eo.status = 'COMPLETED'
GROUP BY 1, 2, 3, 4;

CREATE UNIQUE INDEX uq_exit_reason
  ON mv_exit_reason_monthly(month, company_id, resign_type, COALESCE(primary_reason, 'NONE'));

-- ================================================================
-- MV 8: mv_compa_ratio_distribution
-- Salary compa ratio distribution by company, job category, grade
-- ================================================================
DROP MATERIALIZED VIEW IF EXISTS mv_compa_ratio_distribution;

CREATE MATERIALIZED VIEW mv_compa_ratio_distribution AS
SELECT
  e.company_id,
  jc.code AS job_category_code,
  jg.code AS grade_code,
  jg.name AS grade_name,
  COUNT(*) AS employee_count,
  AVG(ch.compa_ratio) AS avg_compa_ratio,
  PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ch.compa_ratio) AS p25,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ch.compa_ratio) AS median,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ch.compa_ratio) AS p75
FROM employees e
JOIN job_categories jc ON jc.id = e.job_category_id
JOIN job_grades jg ON jg.id = e.job_grade_id
LEFT JOIN LATERAL (
  SELECT compa_ratio FROM compensation_history
  WHERE employee_id = e.id
  ORDER BY effective_date DESC LIMIT 1
) ch ON true
WHERE e.status = 'ACTIVE' AND e.deleted_at IS NULL
GROUP BY 1, 2, 3, 4;

CREATE UNIQUE INDEX uq_compa_dist
  ON mv_compa_ratio_distribution(company_id, job_category_code, grade_code);

-- ================================================================
-- pg_cron refresh schedules
-- ================================================================
-- Run these commands after pg_cron extension is enabled in your PostgreSQL instance.
-- Supabase: Enable pg_cron via Dashboard > Database > Extensions
-- Self-hosted: CREATE EXTENSION IF NOT EXISTS pg_cron;
--
-- Schedule format: minute hour day-of-month month day-of-week
-- Times are in UTC. Adjust for your timezone (KST = UTC+9).
-- ================================================================

-- SELECT cron.schedule('refresh-mv-headcount',    '0 19 * * *',   $$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_headcount_daily$$);
-- SELECT cron.schedule('refresh-mv-attendance',   '0 6 * * 1',    $$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_attendance_weekly$$);
-- SELECT cron.schedule('refresh-mv-performance',  '30 19 * * *',  $$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_performance_summary$$);
-- SELECT cron.schedule('refresh-mv-recruitment',  '0 20 * * *',   $$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_recruitment_funnel$$);
-- SELECT cron.schedule('refresh-mv-burnout',      '30 20 * * *',  $$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_burnout_risk$$);
-- SELECT cron.schedule('refresh-mv-team-health',  '0 21 * * *',   $$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_team_health$$);
-- SELECT cron.schedule('refresh-mv-exit-reason',  '0 19 * * *',   $$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_exit_reason_monthly$$);
-- SELECT cron.schedule('refresh-mv-compa-ratio',  '30 19 * * *',  $$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_compa_ratio_distribution$$);
