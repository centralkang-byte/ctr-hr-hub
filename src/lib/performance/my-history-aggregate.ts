// ═══════════════════════════════════════════════════════════
// CTR HR Hub — My Performance History 집계 순수 헬퍼
// reviews/my-history 라우트에서 사용. 부수효과 없음 → 단위테스트 대상.
// ═══════════════════════════════════════════════════════════

// ─── Manager eval 결정적 선택 ────────────────────────────────
// (cycleId,employeeId,evalType) 유니크 제약 없음 → 동일 cycle에 MANAGER 평가
// 여러 건 가능(매니저 재배치 등). 노출 코멘트가 비결정적이지 않도록 고정 규칙:
//   CONFIRMED 우선 → submittedAt DESC(null 후순위) → id DESC. cycle당 1건.
export interface ManagerEvalLike {
  comment: string | null
  status: string
  submittedAt: Date | null
  id: string
  evaluator: { name: string } | null
}

export function pickManagerEval<T extends ManagerEvalLike>(a: T, b: T): T {
  const aConfirmed = a.status === 'CONFIRMED'
  const bConfirmed = b.status === 'CONFIRMED'
  if (aConfirmed !== bConfirmed) return aConfirmed ? a : b
  const at = a.submittedAt ? a.submittedAt.getTime() : -Infinity
  const bt = b.submittedAt ? b.submittedAt.getTime() : -Infinity
  if (at !== bt) return at > bt ? a : b
  return a.id > b.id ? a : b
}

// ─── MBO 집계 ────────────────────────────────────────────────
// achievementScore는 0–5 평가점수(% 아님). 가중 달성점수 =
//   Σ(score × weight) / Σ(weight), score!=null && weight>0 인 목표만.
// 유효 목표 없거나 weight 합 0 → null("해당없음"). mboScore 대체 금지.
// 주요 목표 = weight DESC, id 타이브레이크 상위 2.
export interface GoalLike {
  title: string
  weight: number
  achievementScore: number | null
  id: string
}

export interface MboAggregate {
  goalCount: number
  achievement: number | null
  keyGoals: string[]
}

export function aggregateMbo(goals: GoalLike[]): MboAggregate {
  let wScore = 0
  let wSum = 0
  for (const g of goals) {
    if (g.achievementScore != null && g.weight > 0) {
      wScore += g.achievementScore * g.weight
      wSum += g.weight
    }
  }
  const achievement = wSum > 0 ? Math.round((wScore / wSum) * 10) / 10 : null

  const keyGoals = [...goals]
    .sort((a, b) => (b.weight - a.weight) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(0, 2)
    .map((g) => g.title)

  return { goalCount: goals.length, achievement, keyGoals }
}
