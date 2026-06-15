-- PR4: 휴가 잔액 이중 테이블 퇴출 — 레거시 employee_leave_balances DROP.
--
-- 선행조건 (2-stage, 본 마이그 적용 전 완료해야 함):
--   • 앱 read/write = 0 (PR #140 쓰기 일원화 + PR #202 read 마이그)
--   • mv_burnout_risk · mv_team_health = PR #204에서 leave_year_balances 로 repoint·재적용 완료
--     → objects_depending_on_legacy = 0 확인된 상태에서만 DROP 성공 (CASCADE 미사용: 의존 잔존 시 안전 실패)
-- 신 SSOT = leave_year_balances (LeaveYearBalance).
DROP TABLE IF EXISTS "employee_leave_balances";
