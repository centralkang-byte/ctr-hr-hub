-- B7-2: 해외 급여 통합 + 글로벌 분석
-- ExchangeRate 테이블을 year/month 기반으로 재설계
-- PayrollImportMapping, PayrollImportLog, PayrollSimulation 신규 추가

-- Step 1: 기존 exchange_rates 테이블 삭제 (B1 시드 데이터 포함)
-- (seed.ts에서 재생성됨)
DROP TABLE IF EXISTS "exchange_rates";

-- Step 2: exchange_rates 테이블 재생성 (year/month 기반)
CREATE TABLE "exchange_rates" (
  "id"            TEXT NOT NULL,
  "year"          INTEGER NOT NULL,
  "month"         INTEGER NOT NULL,
  "from_currency" TEXT NOT NULL,
  "to_currency"   TEXT NOT NULL DEFAULT 'KRW',
  "rate"          DECIMAL(18,6) NOT NULL,
  "source"        TEXT NOT NULL DEFAULT 'manual',
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- Unique constraint
CREATE UNIQUE INDEX "exchange_rates_year_month_from_currency_to_currency_key"
  ON "exchange_rates"("year", "month", "from_currency", "to_currency");

-- Indexes
CREATE INDEX "exchange_rates_from_currency_to_currency_idx"
  ON "exchange_rates"("from_currency", "to_currency");
CREATE INDEX "exchange_rates_year_month_idx"
  ON "exchange_rates"("year", "month");

-- Step 3: PayrollImportMapping 신규
CREATE TABLE "payroll_import_mappings" (
  "id"          TEXT NOT NULL,
  "company_id"  TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "file_type"   TEXT NOT NULL DEFAULT 'xlsx',
  "header_row"  INTEGER NOT NULL DEFAULT 1,
  "mappings"    JSONB NOT NULL,
  "currency"    TEXT NOT NULL,
  "is_default"  BOOLEAN NOT NULL DEFAULT false,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "payroll_import_mappings_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "payroll_import_mappings"
  ADD CONSTRAINT "payroll_import_mappings_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 4: PayrollImportLog 신규
CREATE TABLE "payroll_import_logs" (
  "id"              TEXT NOT NULL,
  "company_id"      TEXT NOT NULL,
  "mapping_id"      TEXT NOT NULL,
  "run_id"          TEXT,
  "year"            INTEGER NOT NULL,
  "month"           INTEGER NOT NULL,
  "file_name"       TEXT NOT NULL,
  "file_path"       TEXT,
  "employee_count"  INTEGER NOT NULL DEFAULT 0,
  "total_gross"     DECIMAL(18,2) NOT NULL DEFAULT 0,
  "total_net"       DECIMAL(18,2) NOT NULL DEFAULT 0,
  "currency"        TEXT NOT NULL,
  "status"          TEXT NOT NULL DEFAULT 'uploaded',
  "error_details"   JSONB,
  "uploaded_by"     TEXT NOT NULL,
  "confirmed_at"    TIMESTAMP(3),
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "payroll_import_logs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "payroll_import_logs"
  ADD CONSTRAINT "payroll_import_logs_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payroll_import_logs"
  ADD CONSTRAINT "payroll_import_logs_mapping_id_fkey"
  FOREIGN KEY ("mapping_id") REFERENCES "payroll_import_mappings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "payroll_import_logs_company_id_year_month_idx"
  ON "payroll_import_logs"("company_id", "year", "month");

-- Step 5: PayrollSimulation 신규
CREATE TABLE "payroll_simulations" (
  "id"          TEXT NOT NULL,
  "created_by"  TEXT NOT NULL,
  "type"        TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "employee_id" TEXT NOT NULL,
  "parameters"  JSONB NOT NULL,
  "results"     JSONB NOT NULL,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "payroll_simulations_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "payroll_simulations"
  ADD CONSTRAINT "payroll_simulations_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "payroll_simulations_employee_id_idx"
  ON "payroll_simulations"("employee_id");
