/**
 * 휴가 잔액 연도 SSOT (single source of truth)
 *
 * `leave_year_balances`는 (employeeId, leaveTypeDefId, year) 단위로 잔액을 추적한다.
 * 한 휴가 신청은 **시작일의 연도** 한 행에만 차감/복구된다 (CEO 정책 2026-06-17:
 * 연도 걸친 휴가는 시작 연도 전액 차감). create/approve/reject/cancel 네 라우트가
 * 모두 이 함수를 써야 pending→used 라이프사이클이 일관된다.
 *
 * 연도 추출은 UTC 기준 — 날짜는 naive "현지 자정 = UTC" 로 저장되며, 운영 런타임
 * (Vercel/prod)은 UTC라 `getUTCFullYear()`가 의도한 달력 연도와 일치한다.
 * 신청이 연말연시 PENDING 상태로 넘어가도 연도는 변하지 않는다 (now가 아닌
 * 불변의 startDate에서 산정하므로).
 */
export function getLeaveBalanceYear(date: Date | string): number {
  return new Date(date).getUTCFullYear()
}
