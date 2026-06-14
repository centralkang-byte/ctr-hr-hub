// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 역량 요건 맵 빌더 (순수)
// load-self-assessment-props 가 사용. prisma/react 의존 없음 → 단위 테스트 가능.
// ═══════════════════════════════════════════════════════════

export interface RequirementRow {
  competencyId: string
  expectedLevel: number
  companyId: string | null
}

/**
 * 역량 요건 행 → competencyId→expectedLevel 맵.
 * 동일 competency 에 글로벌(companyId null)+회사 요건이 함께 있으면 **회사가 글로벌을 덮어쓴다**
 * (FIX: 기존 Object.fromEntries 순서의존 제거 — Codex G1 P1-3).
 */
export function buildRequirementMap(rows: RequirementRow[]): Record<string, number> {
  const map: Record<string, number> = {}
  for (const r of rows) {
    if (r.companyId === null) map[r.competencyId] = r.expectedLevel
  }
  for (const r of rows) {
    if (r.companyId !== null) map[r.competencyId] = r.expectedLevel
  }
  return map
}
