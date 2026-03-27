-- B1: Leave of Absence (휴직) 모델 추가
-- 육아/질병/가족돌봄/병역 등 장기 휴직 관리

-- 1. 휴직 유형 정의 테이블
CREATE TABLE "leave_of_absence_types" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_en" TEXT,
    "category" TEXT NOT NULL,
    "max_duration_days" INTEGER,
    "pay_type" TEXT NOT NULL DEFAULT 'UNPAID',
    "pay_rate" INTEGER,
    "pay_source" TEXT,
    "eligibility_months" INTEGER,
    "counts_as_service" BOOLEAN NOT NULL DEFAULT true,
    "counts_as_attendance" BOOLEAN NOT NULL DEFAULT false,
    "splittable" BOOLEAN NOT NULL DEFAULT false,
    "max_split_count" INTEGER,
    "requires_proof" BOOLEAN NOT NULL DEFAULT false,
    "proof_description" TEXT,
    "advance_notice_days" INTEGER,
    "reinstatement_guaranteed" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "leave_of_absence_types_pkey" PRIMARY KEY ("id")
);

-- 2. 휴직 기록 테이블
CREATE TABLE "leave_of_absences" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "type_id" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "expected_end_date" DATE,
    "actual_end_date" DATE,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "pay_type" TEXT,
    "pay_rate" INTEGER,
    "reason" TEXT,
    "proof_file_url" TEXT,
    "requested_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_by" TEXT,
    "approved_at" TIMESTAMPTZ,
    "rejected_by" TEXT,
    "rejected_at" TIMESTAMPTZ,
    "rejection_reason" TEXT,
    "return_position_id" TEXT,
    "return_notes" TEXT,
    "loa_assignment_id" TEXT,
    "return_assignment_id" TEXT,
    "split_sequence" INTEGER NOT NULL DEFAULT 1,
    "parent_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "leave_of_absences_pkey" PRIMARY KEY ("id")
);

-- 3. Unique constraints
CREATE UNIQUE INDEX "leave_of_absence_types_company_id_code_key" ON "leave_of_absence_types"("company_id", "code");

-- 4. Indexes
CREATE INDEX "leave_of_absences_employee_id_idx" ON "leave_of_absences"("employee_id");
CREATE INDEX "leave_of_absences_company_id_status_idx" ON "leave_of_absences"("company_id", "status");
CREATE INDEX "leave_of_absences_start_date_idx" ON "leave_of_absences"("start_date");

-- 5. Foreign keys
ALTER TABLE "leave_of_absence_types" ADD CONSTRAINT "leave_of_absence_types_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "leave_of_absences" ADD CONSTRAINT "leave_of_absences_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "leave_of_absences" ADD CONSTRAINT "leave_of_absences_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "leave_of_absences" ADD CONSTRAINT "leave_of_absences_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "leave_of_absence_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "leave_of_absences" ADD CONSTRAINT "leave_of_absences_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "leave_of_absences" ADD CONSTRAINT "leave_of_absences_rejected_by_fkey" FOREIGN KEY ("rejected_by") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "leave_of_absences" ADD CONSTRAINT "leave_of_absences_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "leave_of_absences"("id") ON DELETE SET NULL ON UPDATE CASCADE;
