// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 연말정산 5단계 스텝퍼 순수 헬퍼 (YE-IA)
// cumulative 계약: sum(count where statusIndex >= stageIndex)
// 알 수 없는 status는 무시 (실패 금지 — G1 MED 6)
// ═══════════════════════════════════════════════════════════

/** 단계 순서 SSOT — 기존 5 status 순서 그대로 (프로토 라벨로 갈아끼우지 않음) */
export const YEAR_END_STAGES = [
  'not_started',
  'in_progress',
  'submitted',
  'hr_review',
  'confirmed',
] as const

export type YearEndStage = (typeof YEAR_END_STAGES)[number]

/**
 * 단계별 도달 인원 배열 (index = stageIndex).
 * 도달 = 해당 단계 이상에 있는 인원 합 → 1단계 도달 = 전체 인원.
 * 알 수 없는 status 키·비정상 수치(NaN 등)는 0으로 무시한다.
 */
export function cumulativeReached(summary: Partial<Record<YearEndStage, number>>): number[] {
  return YEAR_END_STAGES.map((_, stageIndex) =>
    YEAR_END_STAGES.reduce((sum, status, statusIndex) => {
      if (statusIndex < stageIndex) return sum
      const count = summary[status]
      return sum + (typeof count === 'number' && Number.isFinite(count) ? count : 0)
    }, 0),
  )
}
