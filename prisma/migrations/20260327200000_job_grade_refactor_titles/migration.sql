-- 직급 리팩터링: JobGrade 필드 추가 + EmployeeTitle 모델 + Assignment.titleId

-- 1. JobGrade에 gradeType, nameEn, minPromotionYears 추가
ALTER TABLE "job_grades" ADD COLUMN "grade_type" TEXT NOT NULL DEFAULT 'STAFF';
ALTER TABLE "job_grades" ADD COLUMN "name_en" TEXT;
ALTER TABLE "job_grades" ADD COLUMN "min_promotion_years" INTEGER;

-- 2. EmployeeTitle 모델 생성
CREATE TABLE "employee_titles" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_en" TEXT,
    "rank_order" INTEGER NOT NULL,
    "is_executive" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "employee_titles_pkey" PRIMARY KEY ("id")
);

-- 3. EmployeeAssignment에 titleId 추가
ALTER TABLE "employee_assignments" ADD COLUMN "title_id" TEXT;

-- 4. Indexes & Constraints
CREATE UNIQUE INDEX "employee_titles_company_id_code_key" ON "employee_titles"("company_id", "code");
ALTER TABLE "employee_titles" ADD CONSTRAINT "employee_titles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employee_assignments" ADD CONSTRAINT "employee_assignments_title_id_fkey" FOREIGN KEY ("title_id") REFERENCES "employee_titles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
