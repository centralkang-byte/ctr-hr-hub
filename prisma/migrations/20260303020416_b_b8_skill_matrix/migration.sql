-- DropIndex
DROP INDEX "employee_skill_assessments_employee_id_competency_id_key";

-- AlterTable
ALTER TABLE "employee_skill_assessments" ADD COLUMN     "assessment_period" VARCHAR(20) NOT NULL DEFAULT 'latest',
ADD COLUMN     "final_level" INTEGER,
ADD COLUMN     "manager_comment" TEXT,
ADD COLUMN     "manager_level" INTEGER,
ADD COLUMN     "self_comment" TEXT,
ADD COLUMN     "self_level" INTEGER,
ALTER COLUMN "current_level" DROP NOT NULL;

-- CreateTable
CREATE TABLE "skill_gap_reports" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "department_id" TEXT,
    "assessment_period" VARCHAR(20) NOT NULL,
    "report_data" JSONB NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generated_by" TEXT NOT NULL,

    CONSTRAINT "skill_gap_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_skill_assessments_assessment_period_idx" ON "employee_skill_assessments"("assessment_period");

-- CreateIndex
CREATE UNIQUE INDEX "employee_skill_assessments_employee_id_competency_id_assess_key" ON "employee_skill_assessments"("employee_id", "competency_id", "assessment_period");

-- AddForeignKey
ALTER TABLE "skill_gap_reports" ADD CONSTRAINT "skill_gap_reports_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
