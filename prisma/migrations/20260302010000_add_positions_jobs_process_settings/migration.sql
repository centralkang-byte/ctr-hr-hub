-- CreateEnum
CREATE TYPE "OneOnOneType" AS ENUM ('REGULAR', 'AD_HOC', 'GOAL_REVIEW', 'DEVELOPMENT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AiFeature" ADD VALUE 'EVAL_COMMENT_SUGGESTION';
ALTER TYPE "AiFeature" ADD VALUE 'CALIBRATION_ANALYSIS';
ALTER TYPE "AiFeature" ADD VALUE 'ONE_ON_ONE_NOTES';
ALTER TYPE "AiFeature" ADD VALUE 'PEER_REVIEW_SUMMARY';
ALTER TYPE "AiFeature" ADD VALUE 'PULSE_ANALYSIS';

-- DropIndex
DROP INDEX "idx_assignments_current";

-- DropIndex
DROP INDEX "unique_primary_assignment";

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "sensitivity_level" TEXT;

-- AlterTable
ALTER TABLE "employee_assignments" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "one_on_ones" ADD COLUMN     "meeting_type" "OneOnOneType" NOT NULL DEFAULT 'REGULAR';

-- DropTable
DROP TABLE "employee_manager_backup";

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title_ko" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "company_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title_ko" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "department_id" TEXT,
    "job_id" TEXT,
    "job_grade_id" TEXT,
    "reports_to_position_id" TEXT,
    "dotted_line_position_id" TEXT,
    "is_headcount" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_process_settings" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "setting_type" TEXT NOT NULL,
    "setting_key" TEXT NOT NULL,
    "setting_value" JSONB NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_process_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recognition_likes" (
    "id" TEXT NOT NULL,
    "recognition_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recognition_likes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "jobs_code_key" ON "jobs"("code");

-- CreateIndex
CREATE INDEX "jobs_company_id_idx" ON "jobs"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "positions_code_key" ON "positions"("code");

-- CreateIndex
CREATE INDEX "positions_company_id_idx" ON "positions"("company_id");

-- CreateIndex
CREATE INDEX "positions_department_id_idx" ON "positions"("department_id");

-- CreateIndex
CREATE INDEX "positions_reports_to_position_id_idx" ON "positions"("reports_to_position_id");

-- CreateIndex
CREATE INDEX "positions_dotted_line_position_id_idx" ON "positions"("dotted_line_position_id");

-- CreateIndex
CREATE INDEX "company_process_settings_company_id_idx" ON "company_process_settings"("company_id");

-- CreateIndex
CREATE INDEX "company_process_settings_setting_type_idx" ON "company_process_settings"("setting_type");

-- CreateIndex
CREATE UNIQUE INDEX "company_process_settings_company_id_setting_type_setting_ke_key" ON "company_process_settings"("company_id", "setting_type", "setting_key");

-- CreateIndex
CREATE UNIQUE INDEX "recognition_likes_recognition_id_employee_id_key" ON "recognition_likes"("recognition_id", "employee_id");

-- CreateIndex
CREATE INDEX "applications_posting_id_stage_idx" ON "applications"("posting_id", "stage");

-- CreateIndex
CREATE INDEX "attendances_employee_id_work_date_idx" ON "attendances"("employee_id", "work_date");

-- CreateIndex
CREATE INDEX "audit_logs_company_id_created_at_idx" ON "audit_logs"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_resource_type_resource_id_idx" ON "audit_logs"("resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "leave_requests_employee_id_status_idx" ON "leave_requests"("employee_id", "status");

-- CreateIndex
CREATE INDEX "mbo_goals_employee_id_cycle_id_idx" ON "mbo_goals"("employee_id", "cycle_id");

-- CreateIndex
CREATE INDEX "notifications_employee_id_is_read_idx" ON "notifications"("employee_id", "is_read");

-- CreateIndex
CREATE INDEX "payroll_items_run_id_employee_id_idx" ON "payroll_items"("run_id", "employee_id");

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_job_grade_id_fkey" FOREIGN KEY ("job_grade_id") REFERENCES "job_grades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_reports_to_position_id_fkey" FOREIGN KEY ("reports_to_position_id") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_dotted_line_position_id_fkey" FOREIGN KEY ("dotted_line_position_id") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_process_settings" ADD CONSTRAINT "company_process_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_assignments" ADD CONSTRAINT "employee_assignments_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recognition_likes" ADD CONSTRAINT "recognition_likes_recognition_id_fkey" FOREIGN KEY ("recognition_id") REFERENCES "recognitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recognition_likes" ADD CONSTRAINT "recognition_likes_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "idx_assignments_company" RENAME TO "employee_assignments_company_id_idx";

-- RenameIndex
ALTER INDEX "idx_assignments_department" RENAME TO "employee_assignments_department_id_idx";

-- RenameIndex
ALTER INDEX "idx_assignments_effective" RENAME TO "employee_assignments_effective_date_idx";

-- RenameIndex
ALTER INDEX "idx_assignments_employee" RENAME TO "employee_assignments_employee_id_idx";

-- Partial unique index to enforce uniqueness for global default settings (companyId IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS "uq_process_settings_global"
  ON "company_process_settings" ("setting_type", "setting_key")
  WHERE "company_id" IS NULL;
