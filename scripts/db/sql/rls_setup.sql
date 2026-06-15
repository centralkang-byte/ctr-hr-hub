-- ============================================================
-- CTR HR Hub — Row-Level Security Setup
-- Phase Q-5e: Database-level tenant isolation
-- ============================================================
-- STATUS (2026-06-10): Deferred manual SQL artifact — NOT a Prisma
-- migration. Relocated from prisma/migrations/rls_setup/migration.sql
-- so `prisma migrate dev`/`deploy` no longer pick it up as a pending
-- migration. Never applied to any environment; RLS re-apply is
-- deferred post-launch (CEO decision, 2026-06 S268).
--
-- DO NOT APPLY AS-IS: two KNOWN-BROKEN column references are marked
-- inline below (payroll_items, payslips policies). Fix + re-review in
-- the RLS re-apply track before any use.
--
-- This script enables RLS on Priority 1 tables only.
-- P2/P3 tables will be migrated incrementally.
--
-- Architecture:
--   - app.current_company_id: SET LOCAL by Prisma before each query set
--   - app.current_user_role:  SET LOCAL by Prisma before each query set
--   - app.current_employee_id: SET LOCAL for employee-scoped tables
--   - SUPER_ADMIN: bypasses all policies (unrestricted access)
-- ============================================================

-- ─── Step 1: Helper Functions ─────────────────────────────────

CREATE OR REPLACE FUNCTION current_company_id() RETURNS TEXT AS $$
  SELECT COALESCE(current_setting('app.current_company_id', TRUE), '');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_user_role() RETURNS TEXT AS $$
  SELECT COALESCE(current_setting('app.current_user_role', TRUE), '');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_employee_id() RETURNS TEXT AS $$
  SELECT COALESCE(current_setting('app.current_employee_id', TRUE), '');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ─── Step 2: T1 Priority 1 — Core Company-Isolated Tables ────

-- employees (no direct companyId — isolation via employee_assignments subquery)
ALTER TABLE "employees" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employees" FORCE ROW LEVEL SECURITY;

CREATE POLICY "rls_super_admin_employees" ON "employees"
  FOR ALL USING (current_user_role() = 'SUPER_ADMIN');

CREATE POLICY "rls_company_employees" ON "employees"
  FOR ALL USING (
    current_user_role() IN ('HR_ADMIN', 'MANAGER', 'EMPLOYEE')
    AND EXISTS (
      SELECT 1 FROM employee_assignments ea
      WHERE ea.employee_id = employees.id
        AND ea.company_id = current_company_id()
        AND ea.is_primary = true
        AND ea.end_date IS NULL
    )
  );

-- employee_assignments
ALTER TABLE "employee_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employee_assignments" FORCE ROW LEVEL SECURITY;

CREATE POLICY "rls_super_admin_employee_assignments" ON "employee_assignments"
  FOR ALL USING (current_user_role() = 'SUPER_ADMIN');

CREATE POLICY "rls_company_employee_assignments" ON "employee_assignments"
  FOR ALL USING (
    current_user_role() IN ('HR_ADMIN', 'MANAGER', 'EMPLOYEE')
    AND company_id = current_company_id()
  );

-- payroll_runs
ALTER TABLE "payroll_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payroll_runs" FORCE ROW LEVEL SECURITY;

CREATE POLICY "rls_super_admin_payroll_runs" ON "payroll_runs"
  FOR ALL USING (current_user_role() = 'SUPER_ADMIN');

CREATE POLICY "rls_hr_payroll_runs" ON "payroll_runs"
  FOR ALL USING (
    current_user_role() IN ('HR_ADMIN', 'MANAGER')
    AND company_id = current_company_id()
  );

-- payroll_items (linked to payroll_runs)
ALTER TABLE "payroll_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payroll_items" FORCE ROW LEVEL SECURITY;

CREATE POLICY "rls_super_admin_payroll_items" ON "payroll_items"
  FOR ALL USING (current_user_role() = 'SUPER_ADMIN');

CREATE POLICY "rls_hr_payroll_items" ON "payroll_items"
  FOR ALL USING (
    current_user_role() IN ('HR_ADMIN', 'MANAGER')
    AND EXISTS (
      SELECT 1 FROM payroll_runs pr
      -- KNOWN-BROKEN: payroll_items has no payroll_run_id column — actual column
      -- is run_id (PayrollItem.runId @map("run_id")). Fix belongs to the deferred
      -- RLS re-apply track; do not apply this file as-is.
      WHERE pr.id = payroll_items.payroll_run_id
        AND pr.company_id = current_company_id()
    )
  );

-- payslips
ALTER TABLE "payslips" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payslips" FORCE ROW LEVEL SECURITY;

CREATE POLICY "rls_super_admin_payslips" ON "payslips"
  FOR ALL USING (current_user_role() = 'SUPER_ADMIN');

CREATE POLICY "rls_hr_payslips" ON "payslips"
  FOR ALL USING (
    current_user_role() IN ('HR_ADMIN', 'MANAGER')
    AND EXISTS (
      SELECT 1 FROM payroll_runs pr
      -- KNOWN-BROKEN: payslips has no payroll_run_id column — payslips carries
      -- payroll_item_id and company_id directly (join via payroll_items.run_id,
      -- or use payslips.company_id). Fix belongs to the deferred RLS re-apply track.
      WHERE pr.id = payslips.payroll_run_id
        AND pr.company_id = current_company_id()
    )
  );

-- Employees see own payslips
CREATE POLICY "rls_employee_own_payslips" ON "payslips"
  FOR SELECT USING (
    current_user_role() = 'EMPLOYEE'
    AND employee_id = current_employee_id()
  );

-- performance_reviews
ALTER TABLE "performance_reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "performance_reviews" FORCE ROW LEVEL SECURITY;

CREATE POLICY "rls_super_admin_performance_reviews" ON "performance_reviews"
  FOR ALL USING (current_user_role() = 'SUPER_ADMIN');

CREATE POLICY "rls_company_performance_reviews" ON "performance_reviews"
  FOR ALL USING (
    current_user_role() IN ('HR_ADMIN', 'MANAGER')
    AND company_id = current_company_id()
  );

-- Employees see their own reviews
CREATE POLICY "rls_employee_own_performance_reviews" ON "performance_reviews"
  FOR SELECT USING (
    current_user_role() = 'EMPLOYEE'
    AND employee_id = current_employee_id()
  );

-- salary_bands (P1 salary data)
ALTER TABLE "salary_bands" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "salary_bands" FORCE ROW LEVEL SECURITY;

CREATE POLICY "rls_super_admin_salary_bands" ON "salary_bands"
  FOR ALL USING (current_user_role() = 'SUPER_ADMIN');

CREATE POLICY "rls_hr_salary_bands" ON "salary_bands"
  FOR ALL USING (
    current_user_role() IN ('HR_ADMIN')
    AND company_id = current_company_id()
  );

-- salary_adjustment_matrix
ALTER TABLE "salary_adjustment_matrix" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "salary_adjustment_matrix" FORCE ROW LEVEL SECURITY;

CREATE POLICY "rls_super_admin_salary_adj_matrix" ON "salary_adjustment_matrix"
  FOR ALL USING (current_user_role() = 'SUPER_ADMIN');

CREATE POLICY "rls_hr_salary_adj_matrix" ON "salary_adjustment_matrix"
  FOR ALL USING (
    current_user_role() IN ('HR_ADMIN')
    AND company_id = current_company_id()
  );

-- exit_interviews (strict: managers must NOT read — HR_ADMIN/SA only)
ALTER TABLE "exit_interviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exit_interviews" FORCE ROW LEVEL SECURITY;

CREATE POLICY "rls_super_admin_exit_interviews" ON "exit_interviews"
  FOR ALL USING (current_user_role() = 'SUPER_ADMIN');

CREATE POLICY "rls_hr_exit_interviews" ON "exit_interviews"
  FOR ALL USING (
    current_user_role() = 'HR_ADMIN'
    AND EXISTS (
      SELECT 1 FROM employees e
      JOIN employee_assignments ea ON ea.employee_id = e.id
        AND ea.is_primary = true AND ea.end_date IS NULL
      WHERE e.id = exit_interviews.employee_id
        AND ea.company_id = current_company_id()
    )
  );

-- employee_offboarding (T4: company-scoped for HR, self-only for EMPLOYEE)
ALTER TABLE "employee_offboarding" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employee_offboarding" FORCE ROW LEVEL SECURITY;

CREATE POLICY "rls_super_admin_offboarding" ON "employee_offboarding"
  FOR ALL USING (current_user_role() = 'SUPER_ADMIN');

-- 소유 법인 = employee_offboarding.company_id 직접 (구 active-assignment 서브쿼리는
-- 완료 시 end_date 마감으로 탈락 → 완료 퇴사 영구 차단 버그. 2026-06-10 컬럼 추가로 교체.)
-- ⚠️ 이 정책 세트는 아직 공유 DB 미적용 (RLS 재적용 = post-launch 트랙) — 재적용 시 올바르도록 선반영.
CREATE POLICY "rls_hr_offboarding" ON "employee_offboarding"
  FOR ALL USING (
    current_user_role() IN ('HR_ADMIN', 'MANAGER')
    AND company_id = current_company_id()
  )
  WITH CHECK (
    current_user_role() IN ('HR_ADMIN', 'MANAGER')
    AND company_id = current_company_id()
  );

CREATE POLICY "rls_employee_own_offboarding" ON "employee_offboarding"
  FOR SELECT USING (
    current_user_role() = 'EMPLOYEE'
    AND employee_id = current_employee_id()
  );

-- employee_onboarding (T4: company-scoped for HR/MANAGER)
ALTER TABLE "employee_onboarding" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employee_onboarding" FORCE ROW LEVEL SECURITY;

CREATE POLICY "rls_super_admin_onboarding" ON "employee_onboarding"
  FOR ALL USING (current_user_role() = 'SUPER_ADMIN');

CREATE POLICY "rls_company_onboarding" ON "employee_onboarding"
  FOR ALL USING (
    current_user_role() IN ('HR_ADMIN', 'MANAGER')
    AND company_id = current_company_id()
  );

CREATE POLICY "rls_employee_own_onboarding" ON "employee_onboarding"
  FOR SELECT USING (
    current_user_role() = 'EMPLOYEE'
    AND employee_id = current_employee_id()
  );

-- leave_requests (T4: employeeId scoping)
ALTER TABLE "leave_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "leave_requests" FORCE ROW LEVEL SECURITY;

CREATE POLICY "rls_super_admin_leave_requests" ON "leave_requests"
  FOR ALL USING (current_user_role() = 'SUPER_ADMIN');

CREATE POLICY "rls_hr_leave_requests" ON "leave_requests"
  FOR ALL USING (
    current_user_role() IN ('HR_ADMIN', 'MANAGER')
    AND EXISTS (
      SELECT 1 FROM employees e
      JOIN employee_assignments ea ON ea.employee_id = e.id
        AND ea.is_primary = true AND ea.end_date IS NULL
      WHERE e.id = leave_requests.employee_id
        AND ea.company_id = current_company_id()
    )
  );

CREATE POLICY "rls_employee_own_leave_requests" ON "leave_requests"
  FOR ALL USING (
    current_user_role() = 'EMPLOYEE'
    AND employee_id = current_employee_id()
  );

-- (PR4) employee_leave_balances RLS 제거 — 테이블 DROP. 신 SSOT = leave_year_balances.

-- compensation_history (P1 salary data)
ALTER TABLE "compensation_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "compensation_history" FORCE ROW LEVEL SECURITY;

CREATE POLICY "rls_super_admin_compensation_history" ON "compensation_history"
  FOR ALL USING (current_user_role() = 'SUPER_ADMIN');

CREATE POLICY "rls_hr_compensation_history" ON "compensation_history"
  FOR ALL USING (
    current_user_role() = 'HR_ADMIN'
    AND EXISTS (
      SELECT 1 FROM employees e
      JOIN employee_assignments ea ON ea.employee_id = e.id
        AND ea.is_primary = true AND ea.end_date IS NULL
      WHERE e.id = compensation_history.employee_id
        AND ea.company_id = current_company_id()
    )
  );

-- gdpr_consents + gdpr_requests (P1)
ALTER TABLE "gdpr_consents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "gdpr_consents" FORCE ROW LEVEL SECURITY;

CREATE POLICY "rls_super_admin_gdpr_consents" ON "gdpr_consents"
  FOR ALL USING (current_user_role() = 'SUPER_ADMIN');

CREATE POLICY "rls_hr_gdpr_consents" ON "gdpr_consents"
  FOR ALL USING (
    current_user_role() = 'HR_ADMIN'
    AND company_id = current_company_id()
  );

ALTER TABLE "gdpr_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "gdpr_requests" FORCE ROW LEVEL SECURITY;

CREATE POLICY "rls_super_admin_gdpr_requests" ON "gdpr_requests"
  FOR ALL USING (current_user_role() = 'SUPER_ADMIN');

CREATE POLICY "rls_hr_gdpr_requests" ON "gdpr_requests"
  FOR ALL USING (
    current_user_role() = 'HR_ADMIN'
    AND company_id = current_company_id()
  );

-- pii_access_logs (P1)
ALTER TABLE "pii_access_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pii_access_logs" FORCE ROW LEVEL SECURITY;

CREATE POLICY "rls_super_admin_pii_access_logs" ON "pii_access_logs"
  FOR ALL USING (current_user_role() = 'SUPER_ADMIN');

CREATE POLICY "rls_hr_pii_access_logs" ON "pii_access_logs"
  FOR ALL USING (
    current_user_role() = 'HR_ADMIN'
    AND company_id = current_company_id()
  );

-- year_end_settlements + year_end_deductions (P1 tax data)
ALTER TABLE "year_end_settlements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "year_end_settlements" FORCE ROW LEVEL SECURITY;

CREATE POLICY "rls_super_admin_ye_settlements" ON "year_end_settlements"
  FOR ALL USING (current_user_role() = 'SUPER_ADMIN');

CREATE POLICY "rls_hr_ye_settlements" ON "year_end_settlements"
  FOR ALL USING (
    current_user_role() = 'HR_ADMIN'
    AND EXISTS (
      SELECT 1 FROM employees e
      JOIN employee_assignments ea ON ea.employee_id = e.id
        AND ea.is_primary = true AND ea.end_date IS NULL
      WHERE e.id = year_end_settlements.employee_id
        AND ea.company_id = current_company_id()
    )
  );

CREATE POLICY "rls_employee_own_ye_settlements" ON "year_end_settlements"
  FOR SELECT USING (
    current_user_role() = 'EMPLOYEE'
    AND employee_id = current_employee_id()
  );

-- withholding_receipts (P1 tax data)
ALTER TABLE "withholding_receipts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "withholding_receipts" FORCE ROW LEVEL SECURITY;

CREATE POLICY "rls_super_admin_withholding" ON "withholding_receipts"
  FOR ALL USING (current_user_role() = 'SUPER_ADMIN');

CREATE POLICY "rls_hr_withholding" ON "withholding_receipts"
  FOR ALL USING (
    current_user_role() = 'HR_ADMIN'
    AND EXISTS (
      SELECT 1 FROM employees e
      JOIN employee_assignments ea ON ea.employee_id = e.id
        AND ea.is_primary = true AND ea.end_date IS NULL
      WHERE e.id = withholding_receipts.employee_id
        AND ea.company_id = current_company_id()
    )
  );

CREATE POLICY "rls_employee_own_withholding" ON "withholding_receipts"
  FOR SELECT USING (
    current_user_role() = 'EMPLOYEE'
    AND employee_id = current_employee_id()
  );

-- ─── Step 3: T2 Priority 1 — Nullable companyId Tables ───────

-- onboarding_templates (NULL = global, non-null = company-specific)
ALTER TABLE "onboarding_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "onboarding_templates" FORCE ROW LEVEL SECURITY;

CREATE POLICY "rls_super_admin_onboarding_templates" ON "onboarding_templates"
  FOR ALL USING (current_user_role() = 'SUPER_ADMIN');

CREATE POLICY "rls_company_or_global_onboarding_templates" ON "onboarding_templates"
  FOR ALL USING (
    current_user_role() IN ('HR_ADMIN', 'MANAGER', 'EMPLOYEE')
    AND (company_id IS NULL OR company_id = current_company_id())
  );

-- offboarding_checklists (direct companyId, treated T2 because used globally)
ALTER TABLE "offboarding_checklists" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "offboarding_checklists" FORCE ROW LEVEL SECURITY;

CREATE POLICY "rls_super_admin_offboarding_checklists" ON "offboarding_checklists"
  FOR ALL USING (current_user_role() = 'SUPER_ADMIN');

CREATE POLICY "rls_company_offboarding_checklists" ON "offboarding_checklists"
  FOR ALL USING (
    current_user_role() IN ('HR_ADMIN', 'MANAGER', 'EMPLOYEE')
    AND company_id = current_company_id()
  );

-- ─── Step 4: T1 Priority 1 — Workforce Analytics Tables ──────

-- analytics_snapshots (company-level aggregated data)
ALTER TABLE "analytics_snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "analytics_snapshots" FORCE ROW LEVEL SECURITY;

CREATE POLICY "rls_super_admin_analytics_snapshots" ON "analytics_snapshots"
  FOR ALL USING (current_user_role() = 'SUPER_ADMIN');

CREATE POLICY "rls_company_analytics_snapshots" ON "analytics_snapshots"
  FOR ALL USING (
    current_user_role() IN ('HR_ADMIN', 'MANAGER')
    AND company_id = current_company_id()
  );

-- ─── Verification helpers ─────────────────────────────────────

-- Verify: SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public' AND rowsecurity = true ORDER BY tablename;

-- Verify policies: SELECT tablename, policyname, cmd, qual
-- FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;
