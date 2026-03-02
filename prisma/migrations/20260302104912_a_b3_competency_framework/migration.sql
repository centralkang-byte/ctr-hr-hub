-- AlterTable
ALTER TABLE "performance_evaluations" ADD COLUMN     "competency_grade" VARCHAR(20),
ADD COLUMN     "performance_grade" VARCHAR(20);

-- CreateTable
CREATE TABLE "competency_categories" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "name_en" VARCHAR(100),
    "description" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competency_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competencies" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "name_en" VARCHAR(100),
    "description" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competency_levels" (
    "id" UUID NOT NULL,
    "competency_id" UUID NOT NULL,
    "level" INTEGER NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competency_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competency_indicators" (
    "id" UUID NOT NULL,
    "competency_id" UUID NOT NULL,
    "indicator_text" TEXT NOT NULL,
    "indicator_text_en" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competency_indicators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competency_requirements" (
    "id" UUID NOT NULL,
    "competency_id" UUID NOT NULL,
    "job_id" UUID,
    "job_level_code" VARCHAR(20),
    "expected_level" INTEGER NOT NULL,
    "company_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competency_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "competency_categories_code_key" ON "competency_categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "competencies_category_id_code_key" ON "competencies"("category_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "competency_levels_competency_id_level_key" ON "competency_levels"("competency_id", "level");

-- AddForeignKey
ALTER TABLE "competencies" ADD CONSTRAINT "competencies_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "competency_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_levels" ADD CONSTRAINT "competency_levels_competency_id_fkey" FOREIGN KEY ("competency_id") REFERENCES "competencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_indicators" ADD CONSTRAINT "competency_indicators_competency_id_fkey" FOREIGN KEY ("competency_id") REFERENCES "competencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_requirements" ADD CONSTRAINT "competency_requirements_competency_id_fkey" FOREIGN KEY ("competency_id") REFERENCES "competencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_requirements" ADD CONSTRAINT "competency_requirements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
