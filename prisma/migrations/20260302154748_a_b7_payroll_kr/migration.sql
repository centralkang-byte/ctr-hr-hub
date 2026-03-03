-- CreateTable
CREATE TABLE "insurance_rates" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "employee_rate" DOUBLE PRECISION NOT NULL,
    "employer_rate" DOUBLE PRECISION NOT NULL,
    "upper_limit" DOUBLE PRECISION,
    "lower_limit" DOUBLE PRECISION,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insurance_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nontaxable_limits" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "monthly_limit" INTEGER NOT NULL,
    "annual_limit" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nontaxable_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payslips" (
    "id" TEXT NOT NULL,
    "payroll_item_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "pdf_path" VARCHAR(500),
    "is_viewed" BOOLEAN NOT NULL DEFAULT false,
    "viewed_at" TIMESTAMP(3),
    "sent_via_email" BOOLEAN NOT NULL DEFAULT false,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payslips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "insurance_rates_year_type_key" ON "insurance_rates"("year", "type");

-- CreateIndex
CREATE UNIQUE INDEX "nontaxable_limits_year_code_key" ON "nontaxable_limits"("year", "code");

-- CreateIndex
CREATE INDEX "payslips_employee_id_year_month_idx" ON "payslips"("employee_id", "year", "month");

-- CreateIndex
CREATE INDEX "payslips_company_id_year_month_idx" ON "payslips"("company_id", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "payslips_payroll_item_id_key" ON "payslips"("payroll_item_id");

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
