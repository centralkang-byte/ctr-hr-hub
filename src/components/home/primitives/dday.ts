// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Home D-day 표기 헬퍼
// 기한 경과(음수 days)면 `{key}Overdue` 키 + 절대값으로 분기해
// "D--39" 같은 이중 마이너스 표기를 방지한다 (Phase 2 QA S336)
// ═══════════════════════════════════════════════════════════

export function ddayKeyAndDays(
  baseKey: string,
  days: number | null | undefined,
): { key: string; days: number } {
  const d = days ?? 0
  return d < 0 ? { key: `${baseKey}Overdue`, days: Math.abs(d) } : { key: baseKey, days: d }
}
