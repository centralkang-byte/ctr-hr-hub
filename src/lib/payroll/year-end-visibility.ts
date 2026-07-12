// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 연말정산 셀프서비스 노출 조건 (순수 헬퍼)
// 종전 사이드바 conditional('year-end') 규칙의 SSOT — rail 데모션(Wave1 IA,
// 2026-06-12) 후 급여명세서 허브 링크가 동일 조건을 재사용한다.
// ═══════════════════════════════════════════════════════════

/** KR 법인 + 1~3월(정산 시즌)에만 연말정산 셀프서비스 진입을 노출 */
export function isYearEndSelfServiceVisible(
  countryCode: string | null | undefined,
  today: Date = new Date(),
): boolean {
  if (countryCode && countryCode !== 'KR') return false
  const month = today.getMonth() + 1
  return month >= 1 && month <= 3
}
