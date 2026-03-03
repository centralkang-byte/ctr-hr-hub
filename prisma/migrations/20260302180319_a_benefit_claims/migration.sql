-- AlterTable
ALTER TABLE "exchange_rates" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "payroll_import_mappings" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "benefit_plans" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "name_en" VARCHAR(100),
    "category" VARCHAR(30) NOT NULL,
    "description" TEXT,
    "benefit_type" VARCHAR(20) NOT NULL,
    "amount" INTEGER,
    "max_amount" INTEGER,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'KRW',
    "frequency" VARCHAR(20) NOT NULL DEFAULT 'once',
    "eligibility" JSONB,
    "requires_approval" BOOLEAN NOT NULL DEFAULT true,
    "requires_proof" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "benefit_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benefit_claims" (
    "id" TEXT NOT NULL,
    "benefit_plan_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "claim_amount" INTEGER NOT NULL,
    "approved_amount" INTEGER,
    "event_date" DATE,
    "event_detail" TEXT,
    "proof_paths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "rejected_reason" TEXT,
    "paid_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "benefit_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benefit_budgets" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "category" VARCHAR(30) NOT NULL,
    "total_budget" INTEGER NOT NULL,
    "used_amount" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "benefit_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "benefit_plans_company_id_code_key" ON "benefit_plans"("company_id", "code");

-- CreateIndex
CREATE INDEX "benefit_claims_employee_id_status_idx" ON "benefit_claims"("employee_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "benefit_budgets_company_id_year_category_key" ON "benefit_budgets"("company_id", "year", "category");

-- AddForeignKey
ALTER TABLE "benefit_plans" ADD CONSTRAINT "benefit_plans_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefit_claims" ADD CONSTRAINT "benefit_claims_benefit_plan_id_fkey" FOREIGN KEY ("benefit_plan_id") REFERENCES "benefit_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefit_claims" ADD CONSTRAINT "benefit_claims_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefit_claims" ADD CONSTRAINT "benefit_claims_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benefit_budgets" ADD CONSTRAINT "benefit_budgets_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
