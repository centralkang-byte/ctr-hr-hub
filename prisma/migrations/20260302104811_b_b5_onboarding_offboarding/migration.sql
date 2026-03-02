-- CreateEnum
CREATE TYPE "OnboardingPlanType" AS ENUM ('ONBOARDING', 'OFFBOARDING', 'CROSSBOARDING_DEPARTURE', 'CROSSBOARDING_ARRIVAL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OnboardingProgressStatus" ADD VALUE 'SUSPENDED';
ALTER TYPE "OnboardingProgressStatus" ADD VALUE 'ARCHIVED';

-- DropForeignKey
ALTER TABLE "onboarding_templates" DROP CONSTRAINT "onboarding_templates_company_id_fkey";

-- AlterTable
ALTER TABLE "employee_onboarding" ADD COLUMN     "company_id" TEXT,
ADD COLUMN     "last_working_date" DATE,
ADD COLUMN     "linked_plan_id" TEXT,
ADD COLUMN     "plan_type" "OnboardingPlanType" NOT NULL DEFAULT 'ONBOARDING';

-- AlterTable
ALTER TABLE "exit_interviews" ADD COLUMN     "detailed_reason" TEXT,
ADD COLUMN     "is_confidential" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "satisfaction_detail" JSONB,
ADD COLUMN     "suggestions" TEXT;

-- AlterTable
ALTER TABLE "onboarding_templates" ADD COLUMN     "plan_type" "OnboardingPlanType" NOT NULL DEFAULT 'ONBOARDING',
ALTER COLUMN "company_id" DROP NOT NULL,
ALTER COLUMN "target_type" SET DEFAULT 'NEW_HIRE';

-- AddForeignKey
ALTER TABLE "onboarding_templates" ADD CONSTRAINT "onboarding_templates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_onboarding" ADD CONSTRAINT "employee_onboarding_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_onboarding" ADD CONSTRAINT "employee_onboarding_linked_plan_id_fkey" FOREIGN KEY ("linked_plan_id") REFERENCES "employee_onboarding"("id") ON DELETE SET NULL ON UPDATE CASCADE;
