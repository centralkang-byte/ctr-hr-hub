import { describe, it, expect } from 'vitest'
import {
  pickCurrentCycle,
  computeCycleDday,
  cycleHalfLabel,
  type CycleLike,
} from '@/lib/performance/growth-kpi'
import { buildRequirementMap } from '@/lib/skills/requirement-map'

// ─── fixtures ────────────────────────────────────────────────

function cyc(p: Partial<CycleLike> & Pick<CycleLike, 'id' | 'year' | 'status'>): CycleLike {
  return {
    name: p.name ?? `${p.year} cycle`,
    half: p.half ?? 'H1',
    goalStart: p.goalStart ?? `${p.year}-01-01T00:00:00.000Z`,
    goalEnd: p.goalEnd ?? `${p.year}-04-30T00:00:00.000Z`,
    evalStart: p.evalStart ?? `${p.year}-05-01T00:00:00.000Z`,
    evalEnd: p.evalEnd ?? `${p.year}-06-30T00:00:00.000Z`,
    ...p,
  }
}

// ─── pickCurrentCycle ────────────────────────────────────────

describe('pickCurrentCycle — 날짜범위 우선, 그 안에서 상태우선순위', () => {
  it('빈 배열 → null', () => {
    expect(pickCurrentCycle([], new Date('2026-03-15T00:00:00Z'))).toBeNull()
  })

  it('윈도우[goalStart, evalEnd] 안의 사이클을 윈도우 밖 stale 보다 우선', () => {
    const inWindow = cyc({ id: 'cur', year: 2026, status: 'ACTIVE' }) // 2026-01-01 ~ 2026-06-30
    const staleEvalOpen = cyc({ id: 'old', year: 2025, status: 'EVAL_OPEN' }) // 2025, 윈도우 경과
    const now = new Date('2026-03-15T00:00:00Z')
    expect(pickCurrentCycle([staleEvalOpen, inWindow], now)?.id).toBe('cur')
  })

  it('Codex P1-5: 오래된 EVAL_OPEN(윈도우 밖) 이 최신 ACTIVE(윈도우 안) 를 이기지 못함', () => {
    const newerActive = cyc({ id: 'a', year: 2026, status: 'ACTIVE' })
    const olderEvalOpen = cyc({
      id: 'b', year: 2025, status: 'EVAL_OPEN',
      goalStart: '2025-01-01T00:00:00Z', evalEnd: '2025-06-30T00:00:00Z',
    })
    const now = new Date('2026-02-01T00:00:00Z')
    expect(pickCurrentCycle([olderEvalOpen, newerActive], now)?.id).toBe('a')
  })

  it('윈도우 안 여러 개 → 상태 우선순위(EVAL_OPEN > ACTIVE)', () => {
    const active = cyc({ id: 'act', year: 2026, status: 'ACTIVE' })
    const evalOpen = cyc({ id: 'ev', year: 2026, status: 'EVAL_OPEN' })
    const now = new Date('2026-03-15T00:00:00Z')
    expect(pickCurrentCycle([active, evalOpen], now)?.id).toBe('ev')
  })

  it('윈도우 안 없음 → 비종료(non-terminal) 최신', () => {
    const finalized = cyc({ id: 'f', year: 2026, status: 'FINALIZED' })
    const closed = cyc({ id: 'c', year: 2026, status: 'CLOSED' })
    const now = new Date('2027-01-01T00:00:00Z') // 모든 윈도우 경과
    expect(pickCurrentCycle([closed, finalized], now)?.id).toBe('f')
  })

  it('전부 종료 → 전체 최신(year desc)', () => {
    const c2026 = cyc({ id: 'y26', year: 2026, status: 'CLOSED' })
    const c2025 = cyc({ id: 'y25', year: 2025, status: 'COMP_COMPLETED' })
    const now = new Date('2027-01-01T00:00:00Z')
    expect(pickCurrentCycle([c2025, c2026], now)?.id).toBe('y26')
  })
})

// ─── computeCycleDday (회사 tz) ──────────────────────────────

const KST = 'Asia/Seoul'
const NY = 'America/New_York'

describe('computeCycleDday — 회사 timezone 기준 업무일 차이', () => {
  it('7일 후 마감 (KST)', () => {
    // now KST 2026-03-10 14:00, evalEnd KST 2026-03-17 09:00 → 7일
    const dday = computeCycleDday('2026-03-17T00:00:00Z', new Date('2026-03-10T05:00:00Z'), KST)
    expect(dday).toBe(7)
  })

  it('당일 마감 → 0 (KST)', () => {
    // now KST 2026-03-10 14:00, evalEnd KST 2026-03-10 10:00 → 같은 날
    const dday = computeCycleDday('2026-03-10T01:00:00Z', new Date('2026-03-10T05:00:00Z'), KST)
    expect(dday).toBe(0)
  })

  it('마감 경과 → 음수', () => {
    const dday = computeCycleDday('2026-03-05T01:00:00Z', new Date('2026-03-10T05:00:00Z'), KST)
    expect(dday).toBe(-5)
  })

  it('동일 입력이라도 회사 tz 에 따라 업무일이 다름 (브라우저 로컬 아님)', () => {
    // now 2026-03-10T02:00Z: KST=03-10 11:00 / NY=03-09 22:00(EDT). evalEnd 2026-03-10T10:00Z: KST=03-10 / NY=03-10
    const now = new Date('2026-03-10T02:00:00Z')
    const evalEnd = '2026-03-10T10:00:00Z'
    expect(computeCycleDday(evalEnd, now, KST)).toBe(0) // KST: 오늘 마감
    expect(computeCycleDday(evalEnd, now, NY)).toBe(1)  // NY: 내일 마감
  })

  it('DST 경계를 지나도 정수 일수 (반올림)', () => {
    // NY DST 2026-03-08 시작 — 03-07~03-09 사이에 23h 짜리 하루 포함
    const dday = computeCycleDday('2026-03-09T12:00:00Z', new Date('2026-03-07T12:00:00Z'), NY)
    expect(dday).toBe(2)
  })
})

// ─── cycleHalfLabel ──────────────────────────────────────────

describe('cycleHalfLabel', () => {
  it('H1/H2/ANNUAL', () => {
    expect(cycleHalfLabel('H1')).toBe('상반기')
    expect(cycleHalfLabel('H2')).toBe('하반기')
    expect(cycleHalfLabel('ANNUAL')).toBe('연간')
  })
})

// ─── buildRequirementMap (회사 > 글로벌 override) ────────────

describe('buildRequirementMap — 회사 요건이 글로벌을 덮어씀 (순서의존 제거)', () => {
  it('회사 요건이 글로벌보다 우선 (입력 순서 무관)', () => {
    // 글로벌이 뒤에 와도 회사가 이긴다
    const rows = [
      { competencyId: 'c1', expectedLevel: 5, companyId: 'co' },
      { competencyId: 'c1', expectedLevel: 2, companyId: null },
    ]
    expect(buildRequirementMap(rows).c1).toBe(5)
  })

  it('글로벌만 있으면 글로벌 사용', () => {
    const rows = [{ competencyId: 'c2', expectedLevel: 3, companyId: null }]
    expect(buildRequirementMap(rows).c2).toBe(3)
  })

  it('빈 입력 → 빈 맵', () => {
    expect(buildRequirementMap([])).toEqual({})
  })
})
