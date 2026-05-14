-- Stage C of IS_PE01 legacy ERP migration
-- Employee 코어 모델에 한국 인사 운영 필수 신원·일자 컬럼 11개 추가 (nullable, 무영향)
-- 주민번호는 별도 employee_rrns 테이블로 분리 (PII 자동 누설 방지)

-- ─── 신원 확장 ───
ALTER TABLE "employees" ADD COLUMN "name_hanja" TEXT;
ALTER TABLE "employees" ADD COLUMN "birth_calendar" TEXT DEFAULT 'SOLAR';
ALTER TABLE "employees" ADD COLUMN "is_married" BOOLEAN;
ALTER TABLE "employees" ADD COLUMN "marriage_date" DATE;
ALTER TABLE "employees" ADD COLUMN "office_phone" TEXT;
ALTER TABLE "employees" ADD COLUMN "fax_number" TEXT;
ALTER TABLE "employees" ADD COLUMN "car_license_plate" TEXT;

-- ─── 일자 추적 (EmployeeAssignment effectiveDate 에서 derive 가능하지만 KPI 캐시) ───
ALTER TABLE "employees" ADD COLUMN "group_hire_date" DATE;
ALTER TABLE "employees" ADD COLUMN "last_order_date" DATE;
ALTER TABLE "employees" ADD COLUMN "mid_settlement_date" DATE;
ALTER TABLE "employees" ADD COLUMN "retire_calc_base_date" DATE;

-- ─── 주민등록번호 분리 모델 (1:1) ───
CREATE TABLE "employee_rrns" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "number_encrypted" TEXT NOT NULL,
    "number_masked" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_rrns_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "employee_rrns_employee_id_key" ON "employee_rrns"("employee_id");

ALTER TABLE "employee_rrns" ADD CONSTRAINT "employee_rrns_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Row-Level Security (P1 PII — year_end_settlements 패턴) ───
-- rls_setup migration 이 우리보다 늦게 적용되는 fresh DB 시나리오 대비:
-- helper functions 를 idempotent 하게 보장 (이미 존재하면 replace, 없으면 create)
CREATE OR REPLACE FUNCTION current_company_id() RETURNS TEXT AS $$
  SELECT COALESCE(current_setting('app.current_company_id', TRUE), '');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_user_role() RETURNS TEXT AS $$
  SELECT COALESCE(current_setting('app.current_user_role', TRUE), '');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_employee_id() RETURNS TEXT AS $$
  SELECT COALESCE(current_setting('app.current_employee_id', TRUE), '');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

ALTER TABLE "employee_rrns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employee_rrns" FORCE ROW LEVEL SECURITY;

CREATE POLICY "rls_super_admin_employee_rrns" ON "employee_rrns"
  FOR ALL USING (current_user_role() = 'SUPER_ADMIN');

CREATE POLICY "rls_hr_employee_rrns" ON "employee_rrns"
  FOR ALL USING (
    current_user_role() = 'HR_ADMIN'
    AND EXISTS (
      SELECT 1 FROM employees e
      JOIN employee_assignments ea ON ea.employee_id = e.id
        AND ea.is_primary = true AND ea.end_date IS NULL
      WHERE e.id = employee_rrns.employee_id
        AND ea.company_id = current_company_id()
    )
  );

-- EMPLOYEE 본인 row 만 SELECT 가능 (decrypt 권한은 application layer 에서 별도 체크)
CREATE POLICY "rls_employee_own_employee_rrns" ON "employee_rrns"
  FOR SELECT USING (
    current_user_role() = 'EMPLOYEE'
    AND employee_id = current_employee_id()
  );

