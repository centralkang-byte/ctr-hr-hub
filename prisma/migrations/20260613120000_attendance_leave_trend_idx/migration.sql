-- ============================================================
-- CTR HR Hub — Attendance/Leave trend aggregation indexes (PR-4)
-- ------------------------------------------------------------
-- 전사 근태 추세 탭은 company_id + work_date(또는 start_date) 범위로 집계한다.
-- 기존 인덱스는 (employee_id, work_date)/(employee_id, status) 뿐이라
-- company-scoped 집계가 seq scan 으로 악화 (Codex Gate1 P1-6).
-- 추가 인덱스 2개 (additive only — 컬럼/테이블 변경 없음).
--
-- NOTE: shared cluster + prod disposable(런칭 wipe+migrate 예정)이라
-- 적용은 다음 full migrate 또는 수동 CREATE INDEX 시점. 현 데이터 소량.
-- 트랜잭션 내 실행이므로 CONCURRENTLY 미사용(런칭전 짧은 락 무방).
-- ============================================================

CREATE INDEX IF NOT EXISTS "attendances_company_id_work_date_idx"
  ON "attendances" ("company_id", "work_date");

CREATE INDEX IF NOT EXISTS "leave_requests_company_id_status_start_date_idx"
  ON "leave_requests" ("company_id", "status", "start_date");
