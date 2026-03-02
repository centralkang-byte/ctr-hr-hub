-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OnboardingAssignee" ADD VALUE 'IT';
ALTER TYPE "OnboardingAssignee" ADD VALUE 'FINANCE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OnboardingTaskCategory" ADD VALUE 'ADMIN';
ALTER TYPE "OnboardingTaskCategory" ADD VALUE 'COMPLIANCE';
ALTER TYPE "OnboardingTaskCategory" ADD VALUE 'ORIENTATION';
ALTER TYPE "OnboardingTaskCategory" ADD VALUE 'CHECK_IN';
ALTER TYPE "OnboardingTaskCategory" ADD VALUE 'HANDOVER';
