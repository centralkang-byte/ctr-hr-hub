import { describe, it, expect } from 'vitest'
import {
  pickManagerEval,
  aggregateMbo,
  type ManagerEvalLike,
  type GoalLike,
} from '@/lib/performance/my-history-aggregate'

// ─── pickManagerEval ────────────────────────────────────────
// 동일 cycle 다중 MANAGER 평가 → 결정적 선택:
// CONFIRMED 우선 → submittedAt DESC(null 후순위) → id DESC.

const ev = (over: Partial<ManagerEvalLike>): ManagerEvalLike => ({
  comment: null,
  status: 'SUBMITTED',
  submittedAt: null,
  id: 'a',
  evaluator: { name: '평가자' },
  ...over,
})

describe('pickManagerEval', () => {
  it('CONFIRMED가 SUBMITTED를 이긴다 (순서 무관)', () => {
    const confirmed = ev({ id: 'x', status: 'CONFIRMED', submittedAt: new Date('2025-01-01') })
    const submitted = ev({ id: 'y', status: 'SUBMITTED', submittedAt: new Date('2025-12-31') })
    expect(pickManagerEval(confirmed, submitted).id).toBe('x')
    expect(pickManagerEval(submitted, confirmed).id).toBe('x')
  })

  it('같은 status면 submittedAt DESC (최신 우선)', () => {
    const older = ev({ id: 'o', submittedAt: new Date('2025-01-01') })
    const newer = ev({ id: 'n', submittedAt: new Date('2025-06-01') })
    expect(pickManagerEval(older, newer).id).toBe('n')
    expect(pickManagerEval(newer, older).id).toBe('n')
  })

  it('submittedAt null은 후순위 (값 있는 쪽 우선)', () => {
    const nullDate = ev({ id: 'z', submittedAt: null })
    const dated = ev({ id: 'a', submittedAt: new Date('2025-01-01') })
    expect(pickManagerEval(nullDate, dated).id).toBe('a')
  })

  it('status·submittedAt 동률이면 id DESC 타이브레이크', () => {
    const t = new Date('2025-03-03')
    const lo = ev({ id: 'aaa', submittedAt: t })
    const hi = ev({ id: 'zzz', submittedAt: t })
    expect(pickManagerEval(lo, hi).id).toBe('zzz')
    expect(pickManagerEval(hi, lo).id).toBe('zzz')
  })
})

// ─── aggregateMbo ───────────────────────────────────────────
// 가중 달성점수 = Σ(score×weight)/Σ(weight), score!=null && weight>0 만.

const goal = (over: Partial<GoalLike>): GoalLike => ({
  title: 'goal',
  weight: 25,
  achievementScore: 4,
  id: 'g1',
  ...over,
})

describe('aggregateMbo', () => {
  it('빈 목표 → count 0, achievement null, keyGoals []', () => {
    expect(aggregateMbo([])).toEqual({ goalCount: 0, achievement: null, keyGoals: [] })
  })

  it('가중 평균 (weight로 가중)', () => {
    // (5*60 + 3*40) / 100 = (300+120)/100 = 4.2
    const r = aggregateMbo([
      goal({ id: 'a', title: 'A', weight: 60, achievementScore: 5 }),
      goal({ id: 'b', title: 'B', weight: 40, achievementScore: 3 }),
    ])
    expect(r.goalCount).toBe(2)
    expect(r.achievement).toBe(4.2)
    expect(r.keyGoals).toEqual(['A', 'B']) // weight DESC
  })

  it('achievementScore 전부 null → achievement null (count는 유지)', () => {
    const r = aggregateMbo([
      goal({ id: 'a', weight: 50, achievementScore: null }),
      goal({ id: 'b', weight: 50, achievementScore: null }),
    ])
    expect(r.goalCount).toBe(2)
    expect(r.achievement).toBeNull()
  })

  it('weight 합 0 (전부 0/음수) → achievement null', () => {
    const r = aggregateMbo([
      goal({ id: 'a', weight: 0, achievementScore: 4 }),
      goal({ id: 'b', weight: -5, achievementScore: 5 }),
    ])
    expect(r.achievement).toBeNull()
  })

  it('일부만 score 있음 → 유효 목표만 분모/분자', () => {
    // 유효: weight40·score4 만 → 4.0. weight60·null 은 제외.
    const r = aggregateMbo([
      goal({ id: 'a', weight: 60, achievementScore: null }),
      goal({ id: 'b', weight: 40, achievementScore: 4 }),
    ])
    expect(r.achievement).toBe(4)
    expect(r.goalCount).toBe(2)
  })

  it('keyGoals = weight DESC 상위 2, id 타이브레이크', () => {
    const r = aggregateMbo([
      goal({ id: 'g3', title: 'C', weight: 10 }),
      goal({ id: 'g1', title: 'A', weight: 30 }),
      goal({ id: 'g2', title: 'B', weight: 30 }),
    ])
    // weight 30 둘(A:g1, B:g2) → id ASC 타이브레이크로 A 먼저, 그다음 B
    expect(r.keyGoals).toEqual(['A', 'B'])
  })
})
