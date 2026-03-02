-- ================================================================
-- A2-1: Employee Assignments (Effective Dating 기반 인사 변동 이력)
-- ================================================================
-- 실행 순서:
--   1. employee_assignments 테이블 생성
--   2. employee_manager_backup 테이블 생성
--   3. manager_id 데이터 백업
--   4. 기존 employees 데이터 → employee_assignments 이관
--   5. 이관 검증
--   6. employees에서 8개 필드 제거
--   7. current_employee_view 생성
-- ================================================================

-- ── 1. employee_assignments 테이블 생성 ──────────────────────────

CREATE TABLE "employee_assignments" (
    "id"              TEXT NOT NULL,
    "employee_id"     TEXT NOT NULL,
    "effective_date"  DATE NOT NULL,
    "end_date"        DATE,
    "change_type"     TEXT NOT NULL,
    "company_id"      TEXT NOT NULL,
    "department_id"   TEXT,
    "job_grade_id"    TEXT,
    "job_category_id" TEXT,
    "employment_type" TEXT NOT NULL,
    "contract_type"   TEXT,
    "status"          TEXT NOT NULL,
    "position_id"     TEXT,
    "is_primary"      BOOLEAN NOT NULL DEFAULT true,
    "reason"          TEXT,
    "order_number"    TEXT,
    "approved_by"     TEXT,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_assignments_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "employee_assignments"
    ADD CONSTRAINT "employee_assignments_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employee_assignments"
    ADD CONSTRAINT "employee_assignments_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employee_assignments"
    ADD CONSTRAINT "employee_assignments_department_id_fkey"
    FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "employee_assignments"
    ADD CONSTRAINT "employee_assignments_job_grade_id_fkey"
    FOREIGN KEY ("job_grade_id") REFERENCES "job_grades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "employee_assignments"
    ADD CONSTRAINT "employee_assignments_job_category_id_fkey"
    FOREIGN KEY ("job_category_id") REFERENCES "job_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "employee_assignments"
    ADD CONSTRAINT "employee_assignments_approved_by_fkey"
    FOREIGN KEY ("approved_by") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "idx_assignments_employee"   ON "employee_assignments"("employee_id");
CREATE INDEX "idx_assignments_effective"  ON "employee_assignments"("effective_date");
CREATE INDEX "idx_assignments_company"    ON "employee_assignments"("company_id");
CREATE INDEX "idx_assignments_department" ON "employee_assignments"("department_id");
CREATE INDEX "idx_assignments_current"    ON "employee_assignments"("employee_id")
    WHERE "end_date" IS NULL;

-- Partial unique index: 한 직원의 primary assignment는 동시에 1개만 유효
CREATE UNIQUE INDEX "unique_primary_assignment"
    ON "employee_assignments"("employee_id")
    WHERE ("is_primary" = true AND "end_date" IS NULL);

-- ── 2. employee_manager_backup 테이블 생성 ─────────────────────

CREATE TABLE "employee_manager_backup" (
    "employee_id" TEXT NOT NULL,
    "manager_id"  TEXT NOT NULL,

    CONSTRAINT "employee_manager_backup_pkey" PRIMARY KEY ("employee_id")
);

-- ── 3. manager_id 데이터 백업 ──────────────────────────────────
-- A2-2에서 Position.reports_to_position_id 시드 데이터로 활용

INSERT INTO "employee_manager_backup" ("employee_id", "manager_id")
SELECT "id", "manager_id"
FROM "employees"
WHERE "manager_id" IS NOT NULL;

-- ── 4. 기존 employees 데이터 → employee_assignments 이관 ────────
-- effective_date = hire_date (없으면 created_at 날짜)
-- 모든 기존 레코드는 HIRE 타입으로 초기화

INSERT INTO "employee_assignments" (
    "id",
    "employee_id",
    "effective_date",
    "end_date",
    "change_type",
    "company_id",
    "department_id",
    "job_grade_id",
    "job_category_id",
    "employment_type",
    "contract_type",
    "status",
    "is_primary",
    "reason",
    "created_at",
    "updated_at"
)
SELECT
    gen_random_uuid()::text,
    "id",
    COALESCE("hire_date"::date, "created_at"::date),
    NULL,
    'HIRE',
    "company_id",
    "department_id",
    "job_grade_id",
    "job_category_id",
    "employment_type"::text,
    "contract_type"::text,
    "status"::text,
    true,
    '데이터 마이그레이션: A2-1 초기 레코드',
    NOW(),
    NOW()
FROM "employees"
WHERE "company_id" IS NOT NULL
  AND "deleted_at" IS NULL;

-- ── 5. 이관 검증 ────────────────────────────────────────────────
-- 이 단계에서 employee_assignments COUNT == 살아있는 employees COUNT 확인
-- (주석으로 유지 — 실제 검증은 psql에서 실행)
-- SELECT COUNT(*) FROM employees WHERE company_id IS NOT NULL AND deleted_at IS NULL;
-- SELECT COUNT(*) FROM employee_assignments;

-- ── 6. employees에서 8개 필드 제거 ─────────────────────────────
-- 반드시 데이터 이관(4단계) 완료 후 실행

ALTER TABLE "employees" DROP COLUMN IF EXISTS "department_id";
ALTER TABLE "employees" DROP COLUMN IF EXISTS "job_grade_id";
ALTER TABLE "employees" DROP COLUMN IF EXISTS "job_category_id";
ALTER TABLE "employees" DROP COLUMN IF EXISTS "manager_id";
ALTER TABLE "employees" DROP COLUMN IF EXISTS "company_id";
ALTER TABLE "employees" DROP COLUMN IF EXISTS "employment_type";
ALTER TABLE "employees" DROP COLUMN IF EXISTS "contract_type";
ALTER TABLE "employees" DROP COLUMN IF EXISTS "status";

-- ── 7. current_employee_view 생성 ──────────────────────────────
-- 기존 employees 테이블과 동일한 shape 반환
-- 42개 API 라우트 호환성 유지 (A2-3에서 실제 API 전환)

CREATE OR REPLACE VIEW "current_employee_view" AS
SELECT
    e."id",
    e."employee_no",
    e."name",
    e."name_en",
    e."birth_date",
    e."gender",
    e."nationality",
    e."email",
    e."phone",
    e."emergency_contact",
    e."emergency_contact_phone",
    e."hire_date",
    e."resign_date",
    e."photo_url",
    e."locale",
    e."timezone",
    e."attrition_risk_score",
    e."is_high_potential",
    e."high_potential_since",
    e."onboarded_at",
    e."created_at",
    e."updated_at",
    e."deleted_at",
    e."contract_number",
    e."contract_start_date",
    e."contract_end_date",
    e."contract_auto_convert_date",
    e."probation_start_date",
    e."probation_end_date",
    e."probation_status",
    -- assignment에서 가져오는 필드 (이관된 8개 + position_id)
    a."company_id",
    a."department_id",
    a."job_grade_id",
    a."job_category_id",
    a."employment_type",
    a."contract_type",
    a."status",
    a."position_id",
    a."is_primary",
    a."id"              AS "assignment_id",
    a."effective_date",
    a."change_type"
FROM "employees" e
LEFT JOIN "employee_assignments" a
    ON a."employee_id" = e."id"
   AND a."end_date" IS NULL
   AND a."is_primary" = true;
