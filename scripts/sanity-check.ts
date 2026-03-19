import pg from 'pg'

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://sangwoo@localhost:5432/ctr_hr_hub'
const pool = new pg.Pool({ connectionString: DATABASE_URL })

interface QueryResult {
  id: string
  query: string
  category: string
  title: string
  status: 'PASS' | 'FAIL' | 'SCHEMA_MISMATCH'
  count: number
  sample: any[]
  error?: string
}

const results: QueryResult[] = []

async function runQuery(id: string, category: string, title: string, sql: string): Promise<void> {
  try {
    const { rows } = await pool.query(sql)
    results.push({
      id, category, title, query: sql,
      status: rows.length > 0 ? 'FAIL' : 'PASS',
      count: rows.length,
      sample: rows.slice(0, 5)
    })
    const icon = rows.length > 0 ? '❌' : '✅'
    console.error(`${icon} ${id} ${title}: ${rows.length} rows`)
  } catch (e: any) {
    results.push({
      id, category, title, query: sql,
      status: 'SCHEMA_MISMATCH',
      count: 0, sample: [],
      error: e.message?.substring(0, 200)
    })
    console.error(`⚠️  ${id} ${title}: SCHEMA_MISMATCH - ${e.message?.substring(0, 80)}`)
  }
}

async function main() {
  console.error('Starting QF-RUN-R0 Data Sanity Check...\n')

  // Test connection
  try {
    await pool.query('SELECT 1')
    console.error('✅ DB connection OK\n')
  } catch (e: any) {
    console.error('❌ DB connection failed:', e.message)
    process.exit(1)
  }

  // ═══════════════════════════════════════════
  // Category ①: Value Range Anomalies
  // ═══════════════════════════════════════════
  console.error('\n── Category ①: Value Range ──')

  await runQuery('1.1', '① Value Range', 'Leave balance out of range (>30 or <0)',
    `SELECT id, employee_id, granted_days, used_days,
            (granted_days - used_days) as balance
     FROM employee_leave_balances
     WHERE (granted_days - used_days) > 30 OR (granted_days - used_days) < 0`)

  await runQuery('1.2', '① Value Range', 'PayrollItem base salary out of range',
    `SELECT pi.id, pi.employee_id, pi.base_salary, pi.currency
     FROM payroll_items pi
     WHERE (pi.currency = 'KRW' AND (pi.base_salary > 20000000 OR pi.base_salary < 1000000))
        OR (pi.currency = 'USD' AND (pi.base_salary > 20000 OR pi.base_salary < 1000))
        OR (pi.currency = 'CNY' AND (pi.base_salary > 100000 OR pi.base_salary < 3000))
        OR (pi.currency = 'VND' AND (pi.base_salary > 500000000 OR pi.base_salary < 5000000))`)

  await runQuery('1.3', '① Value Range', 'Weekly work minutes exceeding 52h (3120 min)',
    `SELECT employee_id, SUM(total_minutes) as weekly_minutes,
            DATE_TRUNC('week', work_date) as week
     FROM attendances
     WHERE total_minutes IS NOT NULL
     GROUP BY employee_id, DATE_TRUNC('week', work_date)
     HAVING SUM(total_minutes) > 3120 OR SUM(total_minutes) < 0`)

  await runQuery('1.4', '① Value Range', 'Performance score out of range',
    `SELECT id, employee_id, performance_score, competency_score
     FROM performance_evaluations
     WHERE (performance_score IS NOT NULL AND (performance_score > 5.0 OR performance_score < 1.0))
        OR (competency_score IS NOT NULL AND (competency_score > 5.0 OR competency_score < 1.0))`)

  await runQuery('1.5', '① Value Range', 'Tenure > 45 years',
    `SELECT id, name, hire_date,
            EXTRACT(YEAR FROM AGE(NOW(), hire_date)) as tenure_years
     FROM employees
     WHERE hire_date IS NOT NULL
       AND EXTRACT(YEAR FROM AGE(NOW(), hire_date)) > 45`)

  await runQuery('1.6', '① Value Range', 'Department with 0 active employees',
    `SELECT d.id, d.name,
            COUNT(CASE WHEN ea.status = 'ACTIVE' AND ea.end_date IS NULL THEN 1 END) as active_count
     FROM departments d
     LEFT JOIN employee_assignments ea ON ea.department_id = d.id AND ea.end_date IS NULL
     WHERE d.is_active = true AND d.deleted_at IS NULL
     GROUP BY d.id, d.name
     HAVING COUNT(CASE WHEN ea.status = 'ACTIVE' AND ea.end_date IS NULL THEN 1 END) = 0`)

  await runQuery('1.7', '① Value Range', 'Training enrollment score > 100',
    `SELECT id, employee_id, score
     FROM training_enrollments
     WHERE score IS NOT NULL AND score > 100`)

  // ═══════════════════════════════════════════
  // Category ②: Relationship Contradictions
  // ═══════════════════════════════════════════
  console.error('\n── Category ②: Relationships ──')

  await runQuery('2.1', '② Relationships', 'Resign date before hire date',
    `SELECT id, name, hire_date, resign_date
     FROM employees
     WHERE resign_date IS NOT NULL AND resign_date < hire_date`)

  await runQuery('2.2', '② Relationships', 'Active employee has terminated/resigned manager',
    `SELECT DISTINCT e.id as emp_id, e.name as emp_name,
            mgr.id as mgr_id, mgr.name as mgr_name, mgr_ea.status as mgr_status
     FROM employees e
     JOIN employee_assignments ea ON ea.employee_id = e.id AND ea.end_date IS NULL AND ea.status = 'ACTIVE'
     JOIN employee_histories eh ON eh.employee_id = e.id
     JOIN employee_assignments mgr_ea ON mgr_ea.end_date IS NULL
       AND mgr_ea.status IN ('TERMINATED', 'RESIGNED')
     JOIN employees mgr ON mgr.id = mgr_ea.employee_id
     LIMIT 20`)

  await runQuery('2.3', '② Relationships', 'Self-approval on leave requests',
    `SELECT id, employee_id, approved_by, status
     FROM leave_requests
     WHERE approved_by IS NOT NULL AND employee_id = approved_by`)

  await runQuery('2.4', '② Relationships', 'Self-evaluation in non-SELF eval type',
    `SELECT id, employee_id, evaluator_id, eval_type
     FROM performance_evaluations
     WHERE evaluator_id IS NOT NULL
       AND employee_id = evaluator_id
       AND eval_type != 'SELF'`)

  await runQuery('2.5', '② Relationships', 'Active onboarding for employee hired >2 years ago',
    `SELECT eo.id, eo.employee_id, eo.status, e.hire_date
     FROM employee_onboarding eo
     JOIN employees e ON eo.employee_id = e.id
     WHERE eo.status IN ('IN_PROGRESS', 'NOT_STARTED')
       AND e.hire_date < NOW() - INTERVAL '2 years'`)

  await runQuery('2.6', '② Relationships', 'Offboarding IN_PROGRESS but employee still ACTIVE',
    `SELECT eo.id, eo.employee_id, eo.status as offboard_status, ea.status as emp_status
     FROM employee_offboarding eo
     JOIN employee_assignments ea ON ea.employee_id = eo.employee_id AND ea.end_date IS NULL
     WHERE eo.status = 'IN_PROGRESS' AND ea.status = 'ACTIVE'`)

  await runQuery('2.7', '② Relationships', 'Employee company != department company',
    `SELECT ea.employee_id, ea.company_id as assignment_company,
            d.company_id as dept_company, d.name as dept_name
     FROM employee_assignments ea
     JOIN departments d ON ea.department_id = d.id
     WHERE ea.end_date IS NULL
       AND ea.company_id != d.company_id`)

  // ═══════════════════════════════════════════
  // Category ③: Time Contradictions
  // ═══════════════════════════════════════════
  console.error('\n── Category ③: Time ──')

  await runQuery('3.1', '③ Time', 'Leave end date before start date',
    `SELECT id, employee_id, start_date, end_date, status
     FROM leave_requests
     WHERE end_date < start_date`)

  await runQuery('3.2', '③ Time', 'Contract end date before start date',
    `SELECT id, name, contract_start_date, contract_end_date
     FROM employees
     WHERE contract_end_date IS NOT NULL
       AND contract_start_date IS NOT NULL
       AND contract_end_date < contract_start_date`)

  await runQuery('3.3', '③ Time', 'Clock-out before clock-in',
    `SELECT id, employee_id, clock_in, clock_out, work_date
     FROM attendances
     WHERE clock_out IS NOT NULL AND clock_in IS NOT NULL
       AND clock_out < clock_in`)

  await runQuery('3.4', '③ Time', 'Performance cycle eval_end < eval_start',
    `SELECT id, name, eval_start, eval_end, goal_start, goal_end
     FROM performance_cycles
     WHERE eval_end < eval_start OR goal_end < goal_start`)

  await runQuery('3.5', '③ Time', 'Interview before job posting published',
    `SELECT i.id as interview_id, jp.id as posting_id,
            i.scheduled_at, jp.posted_at
     FROM interview_schedules i
     JOIN applications a ON i.application_id = a.id
     JOIN job_postings jp ON a.posting_id = jp.id
     WHERE jp.posted_at IS NOT NULL
       AND i.scheduled_at < jp.posted_at`)

  await runQuery('3.6', '③ Time', 'Leave approved before created',
    `SELECT id, created_at, approved_at, status
     FROM leave_requests
     WHERE approved_at IS NOT NULL AND approved_at < created_at`)

  await runQuery('3.7', '③ Time', 'Future attendance records',
    `SELECT id, employee_id, work_date
     FROM attendances
     WHERE work_date > CURRENT_DATE + INTERVAL '1 day'
     LIMIT 10`)

  // ═══════════════════════════════════════════
  // Category ④: Status Contradictions
  // ═══════════════════════════════════════════
  console.error('\n── Category ④: Status ──')

  await runQuery('4.1', '④ Status', 'Leave APPROVED but approvedBy is NULL',
    `SELECT id, status, approved_by
     FROM leave_requests
     WHERE status = 'APPROVED' AND approved_by IS NULL`)

  await runQuery('4.2', '④ Status', 'Leave REJECTED but no rejection reason',
    `SELECT id, status, rejection_reason
     FROM leave_requests
     WHERE status = 'REJECTED'
       AND (rejection_reason IS NULL OR rejection_reason = '')`)

  await runQuery('4.3', '④ Status', 'PayrollRun PAID but paidAt is NULL',
    `SELECT id, status, paid_at
     FROM payroll_runs
     WHERE status = 'PAID' AND paid_at IS NULL`)

  await runQuery('4.4', '④ Status', 'PayrollRun APPROVED but approvedBy is NULL',
    `SELECT id, status, approved_by
     FROM payroll_runs
     WHERE status = 'APPROVED' AND approved_by IS NULL`)

  await runQuery('4.5', '④ Status', 'Onboarding COMPLETED but has incomplete tasks',
    `SELECT eo.id, eo.status,
            COUNT(CASE WHEN eot.status != 'COMPLETED' THEN 1 END) as incomplete_tasks,
            COUNT(*) as total_tasks
     FROM employee_onboarding eo
     JOIN employee_onboarding_tasks eot ON eot.employee_onboarding_id = eo.id
     WHERE eo.status = 'COMPLETED'
     GROUP BY eo.id, eo.status
     HAVING COUNT(CASE WHEN eot.status != 'COMPLETED' THEN 1 END) > 0`)

  await runQuery('4.6', '④ Status', 'Performance CONFIRMED but no score',
    `SELECT id, status, performance_score, competency_score, final_grade_enum
     FROM performance_evaluations
     WHERE status = 'CONFIRMED'
       AND performance_score IS NULL AND competency_score IS NULL`)

  await runQuery('4.7', '④ Status', 'Terminated employee with active evaluation',
    `SELECT pe.id, pe.employee_id, pe.status as eval_status, ea.status as emp_status
     FROM performance_evaluations pe
     JOIN employee_assignments ea ON ea.employee_id = pe.employee_id AND ea.end_date IS NULL
     WHERE ea.status IN ('TERMINATED', 'RESIGNED')
       AND pe.status IN ('DRAFT', 'SUBMITTED')`)

  await runQuery('4.8', '④ Status', 'Application at OFFER stage but no offer details',
    `SELECT id, posting_id, applicant_id, stage, offered_salary, offered_date
     FROM applications
     WHERE stage = 'OFFER'
       AND (offered_salary IS NULL OR offered_date IS NULL)`)

  // ═══════════════════════════════════════════
  // Category ⑤: Duplicates & Orphans
  // ═══════════════════════════════════════════
  console.error('\n── Category ⑤: Duplicates/Orphans ──')

  await runQuery('5.1', '⑤ Duplicates/Orphans', 'Duplicate leave requests',
    `SELECT employee_id, start_date, end_date, COUNT(*) as cnt
     FROM leave_requests
     WHERE status != 'CANCELLED'
     GROUP BY employee_id, start_date, end_date
     HAVING COUNT(*) > 1`)

  await runQuery('5.2', '⑤ Duplicates/Orphans', 'Duplicate payroll items per run',
    `SELECT run_id, employee_id, COUNT(*) as cnt
     FROM payroll_items
     GROUP BY run_id, employee_id
     HAVING COUNT(*) > 1`)

  await runQuery('5.3', '⑤ Duplicates/Orphans', 'Orphaned employee assignments',
    `SELECT ea.id, ea.employee_id
     FROM employee_assignments ea
     LEFT JOIN employees e ON ea.employee_id = e.id
     WHERE e.id IS NULL`)

  await runQuery('5.4', '⑤ Duplicates/Orphans', 'Duplicate employee emails',
    `SELECT email, COUNT(*) as cnt
     FROM employees
     WHERE email IS NOT NULL AND email != ''
     GROUP BY email
     HAVING COUNT(*) > 1`)

  await runQuery('5.5', '⑤ Duplicates/Orphans', 'Employee with both active onboarding AND offboarding',
    `SELECT eo.employee_id
     FROM employee_onboarding eo
     JOIN employee_offboarding eoff ON eo.employee_id = eoff.employee_id
     WHERE eo.status IN ('IN_PROGRESS', 'NOT_STARTED')
       AND eoff.status = 'IN_PROGRESS'`)

  await runQuery('5.6', '⑤ Duplicates/Orphans', 'Multiple current primary assignments for same employee',
    `SELECT employee_id, COUNT(*) as cnt
     FROM employee_assignments
     WHERE end_date IS NULL AND is_primary = true
     GROUP BY employee_id
     HAVING COUNT(*) > 1`)

  // ═══════════════════════════════════════════
  // Category ⑥: Calculation Integrity
  // ═══════════════════════════════════════════
  console.error('\n── Category ⑥: Calculations ──')

  await runQuery('6.1', '⑥ Calculations', 'Leave balance: used_days vs approved leave mismatch',
    `SELECT lb.employee_id, lb.policy_id, lb.year, lb.used_days as stored_used,
            COALESCE(SUM(lr.days), 0) as calculated_used,
            ABS(lb.used_days - COALESCE(SUM(lr.days), 0)) as diff
     FROM employee_leave_balances lb
     LEFT JOIN leave_requests lr ON lr.employee_id = lb.employee_id
       AND lr.policy_id = lb.policy_id
       AND lr.status = 'APPROVED'
       AND EXTRACT(YEAR FROM lr.start_date) = lb.year
     GROUP BY lb.employee_id, lb.policy_id, lb.year, lb.used_days
     HAVING ABS(lb.used_days - COALESCE(SUM(lr.days), 0)) > 0.5`)

  await runQuery('6.2', '⑥ Calculations', 'Payroll net != gross - deductions',
    `SELECT id, employee_id, gross_pay, deductions, net_pay,
            (gross_pay - deductions) as calculated_net,
            ABS(net_pay - (gross_pay - deductions)) as diff
     FROM payroll_items
     WHERE ABS(net_pay - (gross_pay - deductions)) > 1`)

  await runQuery('6.3', '⑥ Calculations', 'Onboarding COMPLETED but tasks incomplete',
    `SELECT eo.id, eo.status,
            COUNT(CASE WHEN eot.status = 'COMPLETED' THEN 1 END) as completed,
            COUNT(*) as total
     FROM employee_onboarding eo
     JOIN employee_onboarding_tasks eot ON eot.employee_onboarding_id = eo.id
     WHERE eo.status = 'COMPLETED'
     GROUP BY eo.id, eo.status
     HAVING COUNT(CASE WHEN eot.status = 'COMPLETED' THEN 1 END) < COUNT(*)`)

  await runQuery('6.4', '⑥ Calculations', 'PayrollRun totals vs SUM(items)',
    `SELECT pr.id, pr.year_month, pr.total_gross, pr.total_net,
            SUM(pi.gross_pay) as calc_gross, SUM(pi.net_pay) as calc_net,
            ABS(COALESCE(pr.total_gross,0) - SUM(pi.gross_pay)) as gross_diff,
            ABS(COALESCE(pr.total_net,0) - SUM(pi.net_pay)) as net_diff
     FROM payroll_runs pr
     JOIN payroll_items pi ON pi.run_id = pr.id
     GROUP BY pr.id, pr.year_month, pr.total_gross, pr.total_net
     HAVING ABS(COALESCE(pr.total_gross,0) - SUM(pi.gross_pay)) > 1
         OR ABS(COALESCE(pr.total_net,0) - SUM(pi.net_pay)) > 1`)

  // ═══════════════════════════════════════════
  // Category ⑦: Entity-Specific Rules
  // ═══════════════════════════════════════════
  console.error('\n── Category ⑦: Entity Rules ──')

  await runQuery('7.1', '⑦ Entity Rules', 'KR employees exceeding 52h/week',
    `SELECT a.employee_id, SUM(a.total_minutes) as weekly_minutes,
            DATE_TRUNC('week', a.work_date) as week
     FROM attendances a
     JOIN employee_assignments ea ON a.employee_id = ea.employee_id AND ea.end_date IS NULL
     JOIN companies c ON ea.company_id = c.id
     WHERE c.country_code = 'KR'
       AND a.total_minutes IS NOT NULL
     GROUP BY a.employee_id, DATE_TRUNC('week', a.work_date)
     HAVING SUM(a.total_minutes) > 3120`)

  await runQuery('7.2', '⑦ Entity Rules', 'Payroll currency mismatch with company default',
    `SELECT DISTINCT e.id, e.name, c.name as company, c.currency as company_currency,
            pi.currency as payroll_currency
     FROM employees e
     JOIN employee_assignments ea ON ea.employee_id = e.id AND ea.end_date IS NULL
     JOIN companies c ON ea.company_id = c.id
     JOIN payroll_items pi ON pi.employee_id = e.id
     WHERE c.currency != pi.currency
     LIMIT 20`)

  await runQuery('7.3', '⑦ Entity Rules', 'Employee with NULL company in current assignment',
    `SELECT ea.id, ea.employee_id, ea.company_id
     FROM employee_assignments ea
     WHERE ea.end_date IS NULL AND ea.company_id IS NULL`)

  await runQuery('7.4', '⑦ Entity Rules', 'PayrollRun headcount mismatch',
    `SELECT pr.id, pr.year_month, pr.headcount as stored_headcount,
            COUNT(pi.id) as actual_items,
            ABS(pr.headcount - COUNT(pi.id)) as diff
     FROM payroll_runs pr
     JOIN payroll_items pi ON pi.run_id = pr.id
     GROUP BY pr.id, pr.year_month, pr.headcount
     HAVING ABS(pr.headcount - COUNT(pi.id)) > 0`)

  // ═══════════════════════════════════════════
  // Generate Report
  // ═══════════════════════════════════════════

  const categories = [
    '① Value Range', '② Relationships', '③ Time',
    '④ Status', '⑤ Duplicates/Orphans', '⑥ Calculations', '⑦ Entity Rules'
  ]

  const summary = categories.map(cat => {
    const catResults = results.filter(r => r.category === cat)
    return {
      category: cat,
      queries: catResults.length,
      pass: catResults.filter(r => r.status === 'PASS').length,
      fail: catResults.filter(r => r.status === 'FAIL').length,
      skipped: catResults.filter(r => r.status === 'SCHEMA_MISMATCH').length,
    }
  })

  const criticalIds = ['5.3', '5.4', '7.3', '2.1', '2.2', '6.2', '6.4']
  const warningIds = ['3.1','3.2','3.3','3.4','3.5','3.6','4.1','4.2','4.3','4.4','4.5','4.6','4.7','4.8','5.1','5.2','5.5','5.6','6.1','6.3']

  const criticals = results.filter(r => r.status === 'FAIL' && criticalIds.includes(r.id))
  const warnings = results.filter(r => r.status === 'FAIL' && warningIds.includes(r.id))
  const infos = results.filter(r => r.status === 'FAIL' && !criticalIds.includes(r.id) && !warningIds.includes(r.id))

  // Output JSON to stdout for report generation
  console.log(JSON.stringify({
    summary, results,
    criticalCount: criticals.length,
    warningCount: warnings.length,
    infoCount: infos.length
  }, null, 2))

  await pool.end()
}

main().catch(console.error)
