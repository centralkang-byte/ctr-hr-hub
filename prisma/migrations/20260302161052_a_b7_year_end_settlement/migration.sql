-- CreateTable
CREATE TABLE "year_end_deduction_configs" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "category" VARCHAR(30) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "rules" JSONB NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "year_end_deduction_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "income_tax_rates" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "min_amount" BIGINT NOT NULL,
    "max_amount" BIGINT,
    "rate" DOUBLE PRECISION NOT NULL,
    "progressive_deduction" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "income_tax_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "year_end_settlements" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'not_started',
    "total_salary" BIGINT NOT NULL DEFAULT 0,
    "earned_income_deduction" BIGINT NOT NULL DEFAULT 0,
    "earned_income" BIGINT NOT NULL DEFAULT 0,
    "income_deductions" JSONB,
    "total_income_deduction" BIGINT NOT NULL DEFAULT 0,
    "taxable_base" BIGINT NOT NULL DEFAULT 0,
    "tax_rate" DOUBLE PRECISION,
    "calculated_tax" BIGINT NOT NULL DEFAULT 0,
    "tax_credits" JSONB,
    "total_tax_credit" BIGINT NOT NULL DEFAULT 0,
    "determined_tax" BIGINT NOT NULL DEFAULT 0,
    "prepaid_tax" BIGINT NOT NULL DEFAULT 0,
    "final_settlement" BIGINT NOT NULL DEFAULT 0,
    "local_tax_settlement" BIGINT NOT NULL DEFAULT 0,
    "submitted_at" TIMESTAMP(3),
    "confirmed_at" TIMESTAMP(3),
    "confirmed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "year_end_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "year_end_dependents" (
    "id" TEXT NOT NULL,
    "settlement_id" TEXT NOT NULL,
    "relationship" VARCHAR(20) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "resident_number" VARCHAR(20),
    "birth_date" DATE,
    "is_disabled" BOOLEAN NOT NULL DEFAULT false,
    "is_senior" BOOLEAN NOT NULL DEFAULT false,
    "is_single_parent" BOOLEAN NOT NULL DEFAULT false,
    "deduction_amount" INTEGER NOT NULL DEFAULT 1500000,
    "additional_deduction" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "year_end_dependents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "year_end_deductions" (
    "id" TEXT NOT NULL,
    "settlement_id" TEXT NOT NULL,
    "config_code" VARCHAR(50) NOT NULL,
    "category" VARCHAR(30) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "input_amount" BIGINT NOT NULL DEFAULT 0,
    "deductible_amount" BIGINT NOT NULL DEFAULT 0,
    "details" JSONB,
    "source" VARCHAR(20) NOT NULL DEFAULT 'manual',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "year_end_deductions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "year_end_documents" (
    "id" TEXT NOT NULL,
    "settlement_id" TEXT NOT NULL,
    "document_type" VARCHAR(50) NOT NULL,
    "file_name" VARCHAR(200) NOT NULL,
    "file_path" VARCHAR(500) NOT NULL,
    "parsed_data" JSONB,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "year_end_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "withholding_receipts" (
    "id" TEXT NOT NULL,
    "settlement_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "pdf_path" VARCHAR(500),
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "withholding_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "year_end_deduction_configs_year_code_key" ON "year_end_deduction_configs"("year", "code");

-- CreateIndex
CREATE INDEX "income_tax_rates_year_min_amount_idx" ON "income_tax_rates"("year", "min_amount");

-- CreateIndex
CREATE UNIQUE INDEX "income_tax_rates_year_min_amount_key" ON "income_tax_rates"("year", "min_amount");

-- CreateIndex
CREATE UNIQUE INDEX "year_end_settlements_employee_id_year_key" ON "year_end_settlements"("employee_id", "year");

-- CreateIndex
CREATE UNIQUE INDEX "withholding_receipts_settlement_id_key" ON "withholding_receipts"("settlement_id");

-- AddForeignKey
ALTER TABLE "year_end_settlements" ADD CONSTRAINT "year_end_settlements_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "year_end_dependents" ADD CONSTRAINT "year_end_dependents_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "year_end_settlements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "year_end_deductions" ADD CONSTRAINT "year_end_deductions_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "year_end_settlements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "year_end_documents" ADD CONSTRAINT "year_end_documents_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "year_end_settlements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withholding_receipts" ADD CONSTRAINT "withholding_receipts_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "year_end_settlements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withholding_receipts" ADD CONSTRAINT "withholding_receipts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
