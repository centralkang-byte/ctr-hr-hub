-- 급여 실행 중복 생성 방지 (dogfood S269 #1)
-- 같은 회사·월·유형(MONTHLY/BONUS/...) 급여 실행은 하나만 — race-safe DB 제약.
-- 앱 레벨 findFirst 가드(POST /api/v1/payroll/runs)의 동시요청 백업.

-- DropIndex (unique가 (company_id, year_month) prefix를 커버하므로 제거)
DROP INDEX "payroll_runs_company_id_year_month_idx";

-- CreateIndex
CREATE UNIQUE INDEX "payroll_runs_company_id_year_month_run_type_key" ON "payroll_runs"("company_id", "year_month", "run_type");
