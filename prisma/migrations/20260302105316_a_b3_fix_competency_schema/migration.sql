/*
  Warnings:

  - The primary key for the `competencies` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `competency_categories` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `competency_indicators` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `competency_levels` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `competency_requirements` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "competencies" DROP CONSTRAINT "competencies_category_id_fkey";

-- DropForeignKey
ALTER TABLE "competency_indicators" DROP CONSTRAINT "competency_indicators_competency_id_fkey";

-- DropForeignKey
ALTER TABLE "competency_levels" DROP CONSTRAINT "competency_levels_competency_id_fkey";

-- DropForeignKey
ALTER TABLE "competency_requirements" DROP CONSTRAINT "competency_requirements_competency_id_fkey";

-- AlterTable
ALTER TABLE "competencies" DROP CONSTRAINT "competencies_pkey",
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "category_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "competencies_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "competency_categories" DROP CONSTRAINT "competency_categories_pkey",
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "competency_categories_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "competency_indicators" DROP CONSTRAINT "competency_indicators_pkey",
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "competency_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "competency_indicators_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "competency_levels" DROP CONSTRAINT "competency_levels_pkey",
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "competency_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "competency_levels_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "competency_requirements" DROP CONSTRAINT "competency_requirements_pkey",
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "competency_id" SET DATA TYPE TEXT,
ALTER COLUMN "job_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "competency_requirements_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE INDEX "competency_requirements_competency_id_idx" ON "competency_requirements"("competency_id");

-- CreateIndex
CREATE INDEX "competency_requirements_company_id_idx" ON "competency_requirements"("company_id");

-- AddForeignKey
ALTER TABLE "competencies" ADD CONSTRAINT "competencies_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "competency_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_levels" ADD CONSTRAINT "competency_levels_competency_id_fkey" FOREIGN KEY ("competency_id") REFERENCES "competencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_indicators" ADD CONSTRAINT "competency_indicators_competency_id_fkey" FOREIGN KEY ("competency_id") REFERENCES "competencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_requirements" ADD CONSTRAINT "competency_requirements_competency_id_fkey" FOREIGN KEY ("competency_id") REFERENCES "competencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_requirements" ADD CONSTRAINT "competency_requirements_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
