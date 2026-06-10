-- S276 attendance policy gates (record-only; applied to shared DB via `prisma db push`,
-- see docs/plans/active/2026-06-10-attendance-policy-gates.md — migrations do not apply from zero)
-- IF NOT EXISTS: db push로 이미 적용된 DB에 migrate deploy가 돌아도 실패하지 않도록 멱등 (Codex Gate2 P1)

-- 기준 출퇴근 시간 (지각/조퇴 판정 기준)
ALTER TABLE "attendance_settings" ADD COLUMN IF NOT EXISTS "work_start_time" TEXT NOT NULL DEFAULT '08:30';
ALTER TABLE "attendance_settings" ADD COLUMN IF NOT EXISTS "work_end_time" TEXT NOT NULL DEFAULT '17:30';

-- 1일 1레코드 정책 (중복 출근 차단)
CREATE UNIQUE INDEX IF NOT EXISTS "attendances_employee_id_work_date_key" ON "attendances"("employee_id", "work_date");
