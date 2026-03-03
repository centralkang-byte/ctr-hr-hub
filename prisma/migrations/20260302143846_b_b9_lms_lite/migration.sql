/*
  Warnings:

  - Added the required column `updated_at` to the `training_enrollments` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EnrollmentStatus" ADD VALUE 'FAILED';
ALTER TYPE "EnrollmentStatus" ADD VALUE 'EXPIRED';

-- AlterTable
ALTER TABLE "training_courses" ADD COLUMN     "code" VARCHAR(30),
ADD COLUMN     "expected_level_gain" INTEGER,
ADD COLUMN     "format" VARCHAR(20) NOT NULL DEFAULT 'offline',
ADD COLUMN     "linked_competency_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "target_job_levels" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "title_en" TEXT,
ADD COLUMN     "validity_months" INTEGER;

-- AlterTable
ALTER TABLE "training_enrollments" ADD COLUMN     "expires_at" TIMESTAMP(3),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "source" VARCHAR(20) NOT NULL DEFAULT 'manual',
ADD COLUMN     "start_date" DATE,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "mandatory_training_configs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "course_id" TEXT NOT NULL,
    "target_group" VARCHAR(30) NOT NULL,
    "frequency" VARCHAR(20) NOT NULL,
    "deadline_month" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mandatory_training_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_skill_assessments" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "competency_id" TEXT NOT NULL,
    "current_level" INTEGER NOT NULL,
    "assessed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assessed_by_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_skill_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mandatory_training_configs_company_id_idx" ON "mandatory_training_configs"("company_id");

-- CreateIndex
CREATE INDEX "mandatory_training_configs_course_id_idx" ON "mandatory_training_configs"("course_id");

-- CreateIndex
CREATE INDEX "employee_skill_assessments_employee_id_idx" ON "employee_skill_assessments"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_skill_assessments_employee_id_competency_id_key" ON "employee_skill_assessments"("employee_id", "competency_id");

-- CreateIndex
CREATE INDEX "training_enrollments_employee_id_status_idx" ON "training_enrollments"("employee_id", "status");

-- AddForeignKey
ALTER TABLE "mandatory_training_configs" ADD CONSTRAINT "mandatory_training_configs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mandatory_training_configs" ADD CONSTRAINT "mandatory_training_configs_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "training_courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_skill_assessments" ADD CONSTRAINT "employee_skill_assessments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_skill_assessments" ADD CONSTRAINT "employee_skill_assessments_competency_id_fkey" FOREIGN KEY ("competency_id") REFERENCES "competencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_skill_assessments" ADD CONSTRAINT "employee_skill_assessments_assessed_by_id_fkey" FOREIGN KEY ("assessed_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
