-- S276 attendance policy gates (record-only; applied to shared DB via `prisma db push`,
-- see docs/plans/active/2026-06-10-attendance-policy-gates.md — migrations do not apply from zero)

-- 기준 출퇴근 시간 (지각/조퇴 판정 기준)
ALTER TABLE "attendance_settings" ADD COLUMN "work_start_time" TEXT NOT NULL DEFAULT '08:30';
ALTER TABLE "attendance_settings" ADD COLUMN "work_end_time" TEXT NOT NULL DEFAULT '17:30';

-- 1일 1레코드 정책 (중복 출근 차단)
CREATE UNIQUE INDEX "attendances_employee_id_work_date_key" ON "attendances"("employee_id", "work_date");
