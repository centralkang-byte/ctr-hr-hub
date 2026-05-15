-- Stage D of IS_PE01 legacy ERP migration
-- Employee 부속 모델 4종 신설 + MilitaryRegistration 4 컬럼 추가
-- 모든 sensitive 테이블 (bank/insurance/statutory) 에 RLS 적용

-- ─── MilitaryRegistration 확장 (IS_PE01 E305/E306/E307 호환) ───
ALTER TABLE "military_registrations" ADD COLUMN "exempt_reason" TEXT;
ALTER TABLE "military_registrations" ADD COLUMN "service_type" TEXT;
ALTER TABLE "military_registrations" ADD COLUMN "discharge_type" TEXT;
ALTER TABLE "military_registrations" ADD COLUMN "military_number" TEXT;

-- ─── EmployeeAddress (1:many: REGISTERED / RESIDENCE / FOREIGN) ───
CREATE TABLE "employee_addresses" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "postal_code" TEXT,
    "address_line1" TEXT,
    "address_line2" TEXT,
    "country_code" TEXT DEFAULT 'KR',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" DATE NOT NULL DEFAULT CURRENT_DATE,
    "effective_to" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_addresses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "employee_addresses_employee_id_type_effective_from_key"
    ON "employee_addresses"("employee_id", "type", "effective_from");
CREATE INDEX "employee_addresses_employee_id_idx" ON "employee_addresses"("employee_id");

ALTER TABLE "employee_addresses" ADD CONSTRAINT "employee_addresses_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── EmployeeBankAccount (1:many: PAYROLL / EXPENSE / PENSION) ───
CREATE TABLE "employee_bank_accounts" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "bank_code" TEXT NOT NULL,
    "number_encrypted" TEXT NOT NULL,
    "number_masked" TEXT NOT NULL,
    "account_holder" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_bank_accounts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "employee_bank_accounts_employee_id_idx" ON "employee_bank_accounts"("employee_id");
CREATE INDEX "employee_bank_accounts_employee_id_purpose_idx"
    ON "employee_bank_accounts"("employee_id", "purpose");

ALTER TABLE "employee_bank_accounts" ADD CONSTRAINT "employee_bank_accounts_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── KoreaSocialInsurance (1:many: HEALTH / NATIONAL_PENSION / EMPLOYMENT / INDUSTRIAL_ACCIDENT) ───
CREATE TABLE "korea_social_insurance" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "insurance_type" TEXT NOT NULL,
    "is_enrolled" BOOLEAN NOT NULL,
    "monthly_salary" DECIMAL(65,30),
    "acquire_date" DATE,
    "lose_date" DATE,
    "group_code" TEXT,
    "cert_number" TEXT,
    "exempt_reason" TEXT,
    "long_term_care_amount" DECIMAL(65,30),
    "employer_amount" DECIMAL(65,30),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "korea_social_insurance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "korea_social_insurance_employee_id_insurance_type_key"
    ON "korea_social_insurance"("employee_id", "insurance_type");
CREATE INDEX "korea_social_insurance_employee_id_idx" ON "korea_social_insurance"("employee_id");

ALTER TABLE "korea_social_insurance" ADD CONSTRAINT "korea_social_insurance_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── EmployeeStatutoryStatus (1:1: 보훈/장애/노조 통합) ───
CREATE TABLE "employee_statutory_status" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "veteran_type" TEXT,
    "veteran_benefit" TEXT,
    "veteran_number" TEXT,
    "veteran_relation" TEXT,
    "veteran_org" TEXT,
    "disability_type" TEXT,
    "disability_class" TEXT,
    "disability_date" DATE,
    "union_member" BOOLEAN NOT NULL DEFAULT false,
    "union_join_date" DATE,
    "union_rank" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_statutory_status_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "employee_statutory_status_employee_id_key"
    ON "employee_statutory_status"("employee_id");

ALTER TABLE "employee_statutory_status" ADD CONSTRAINT "employee_statutory_status_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Row-Level Security ────────────────────────────────────
-- rls_setup migration 보다 먼저 적용될 수 있는 fresh DB 대비 (Stage C 패턴)
CREATE OR REPLACE FUNCTION current_company_id() RETURNS TEXT AS $$
  SELECT COALESCE(current_setting('app.current_company_id', TRUE), '');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_user_role() RETURNS TEXT AS $$
  SELECT COALESCE(current_setting('app.current_user_role', TRUE), '');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_employee_id() RETURNS TEXT AS $$
  SELECT COALESCE(current_setting('app.current_employee_id', TRUE), '');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 공통 RLS 패턴: SUPER_ADMIN 전체 / HR_ADMIN 자기 회사 / EMPLOYEE 본인 SELECT
-- (employee_id 로부터 employee_assignments 의 company_id 조인)

-- employee_addresses
ALTER TABLE "employee_addresses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employee_addresses" FORCE ROW LEVEL SECURITY;

CREATE POLICY "rls_super_admin_employee_addresses" ON "employee_addresses"
  FOR ALL USING (current_user_role() = 'SUPER_ADMIN');

CREATE POLICY "rls_hr_employee_addresses" ON "employee_addresses"
  FOR ALL USING (
    current_user_role() = 'HR_ADMIN'
    AND EXISTS (
      SELECT 1 FROM employee_assignments ea
      WHERE ea.employee_id = employee_addresses.employee_id
        AND ea.is_primary = true AND ea.end_date IS NULL
        AND ea.company_id = current_company_id()
    )
  );

CREATE POLICY "rls_employee_own_employee_addresses" ON "employee_addresses"
  FOR SELECT USING (
    current_user_role() = 'EMPLOYEE'
    AND employee_id = current_employee_id()
  );

-- employee_bank_accounts (P1 — RRN 수준 sensitive)
ALTER TABLE "employee_bank_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employee_bank_accounts" FORCE ROW LEVEL SECURITY;

CREATE POLICY "rls_super_admin_employee_bank_accounts" ON "employee_bank_accounts"
  FOR ALL USING (current_user_role() = 'SUPER_ADMIN');

CREATE POLICY "rls_hr_employee_bank_accounts" ON "employee_bank_accounts"
  FOR ALL USING (
    current_user_role() = 'HR_ADMIN'
    AND EXISTS (
      SELECT 1 FROM employee_assignments ea
      WHERE ea.employee_id = employee_bank_accounts.employee_id
        AND ea.is_primary = true AND ea.end_date IS NULL
        AND ea.company_id = current_company_id()
    )
  );

CREATE POLICY "rls_employee_own_employee_bank_accounts" ON "employee_bank_accounts"
  FOR SELECT USING (
    current_user_role() = 'EMPLOYEE'
    AND employee_id = current_employee_id()
  );

-- korea_social_insurance (P1 — 보수월액 노출 = 급여 추정)
ALTER TABLE "korea_social_insurance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "korea_social_insurance" FORCE ROW LEVEL SECURITY;

CREATE POLICY "rls_super_admin_korea_social_insurance" ON "korea_social_insurance"
  FOR ALL USING (current_user_role() = 'SUPER_ADMIN');

CREATE POLICY "rls_hr_korea_social_insurance" ON "korea_social_insurance"
  FOR ALL USING (
    current_user_role() = 'HR_ADMIN'
    AND EXISTS (
      SELECT 1 FROM employee_assignments ea
      WHERE ea.employee_id = korea_social_insurance.employee_id
        AND ea.is_primary = true AND ea.end_date IS NULL
        AND ea.company_id = current_company_id()
    )
  );

CREATE POLICY "rls_employee_own_korea_social_insurance" ON "korea_social_insurance"
  FOR SELECT USING (
    current_user_role() = 'EMPLOYEE'
    AND employee_id = current_employee_id()
  );

-- employee_statutory_status (P1 — 보훈/장애 특수 보호 대상)
ALTER TABLE "employee_statutory_status" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employee_statutory_status" FORCE ROW LEVEL SECURITY;

CREATE POLICY "rls_super_admin_employee_statutory_status" ON "employee_statutory_status"
  FOR ALL USING (current_user_role() = 'SUPER_ADMIN');

CREATE POLICY "rls_hr_employee_statutory_status" ON "employee_statutory_status"
  FOR ALL USING (
    current_user_role() = 'HR_ADMIN'
    AND EXISTS (
      SELECT 1 FROM employee_assignments ea
      WHERE ea.employee_id = employee_statutory_status.employee_id
        AND ea.is_primary = true AND ea.end_date IS NULL
        AND ea.company_id = current_company_id()
    )
  );

CREATE POLICY "rls_employee_own_employee_statutory_status" ON "employee_statutory_status"
  FOR SELECT USING (
    current_user_role() = 'EMPLOYEE'
    AND employee_id = current_employee_id()
  );

-- 참고: military_registrations 의 RLS 적용은 별도 stage 로 분리.
-- 이유: 기존 API routes (Russian military endpoints 등) 가 prisma.militaryRegistration 을
-- withRLS 없이 직접 호출하므로, 여기서 강제 RLS 활성화 시 기존 기능이 break.
-- → caller 마이그레이션을 위한 별도 PR 에서 RLS + 호출처 withRLS 일괄 적용 예정.
-- (Stage D 의 4개 신규 테이블은 호출처가 아직 없어 안전하게 RLS 적용 가능)
