// ═══════════════════════════════════════════════════════════
// CTR HR Hub — eligibility 엔진 단위테스트 (PR-4b)
// 출근율 공식·집계·표본억제의 정직성을 잠근다.
// ═══════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import {
  formulaForJobCategory,
  employeePair,
  aggregate,
  UNSUPPORTED_POINT,
  DEFAULT_COHORT_MIN,
  type EmployeePair,
} from '@/lib/attendance/eligibility'

describe('formulaForJobCategory', () => {
  it('PRODUCTION → STRICT', () => {
    expect(formulaForJobCategory('PRODUCTION')).toBe('STRICT')
  })
  it('OFFICE·MANAGEMENT·R_AND_D → EXCUSED', () => {
    expect(formulaForJobCategory('OFFICE')).toBe('EXCUSED')
    expect(formulaForJobCategory('MANAGEMENT')).toBe('EXCUSED')
    expect(formulaForJobCategory('R_AND_D')).toBe('EXCUSED')
  })
  it('미지정(null/undefined) → EXCUSED', () => {
    expect(formulaForJobCategory(null)).toBe('EXCUSED')
    expect(formulaForJobCategory(undefined)).toBe('EXCUSED')
  })
})

describe('employeePair — EXCUSED (면제)', () => {
  it('분모 = 소정근로일 − 휴가, 출근 = present(NORMAL+LATE+EARLY_OUT)', () => {
    // 20 근무일, 휴가 2일 → 분모 18, present 18 → 만근
    const p = employeePair('EXCUSED', { eligDays: 20, leaveDays: 2, normalElig: 16, presentElig: 18 })
    expect(p).toEqual({ num: 18, denom: 18, clamped: false })
  })
  it('지각·조퇴도 출근으로 인정 (present 사용)', () => {
    // present 17 (정상 15 + 지각/조퇴 2), 분모 20 → 17/20
    const p = employeePair('EXCUSED', { eligDays: 20, leaveDays: 0, normalElig: 15, presentElig: 17 })
    expect(p).toEqual({ num: 17, denom: 20, clamped: false })
  })
  it('반차 0.5 차감 → 분모 소수', () => {
    const p = employeePair('EXCUSED', { eligDays: 20, leaveDays: 0.5, normalElig: 19, presentElig: 19 })
    expect(p.denom).toBe(19.5)
    expect(p.num).toBe(19)
  })
  it('휴가일 출근(이상치) → clamp + clamped 플래그', () => {
    // 분모 18인데 present 19 (휴가일에도 찍음) → num 18, clamped
    const p = employeePair('EXCUSED', { eligDays: 20, leaveDays: 2, normalElig: 19, presentElig: 19 })
    expect(p).toEqual({ num: 18, denom: 18, clamped: true })
  })
})

describe('employeePair — STRICT (엄격)', () => {
  it('분모 = 소정근로일(휴가 미차감), 출근 = NORMAL 만', () => {
    // 휴가 2일이어도 분모 20 그대로, 정상출근 16 → 16/20 (지각·조퇴·휴가 전부 차감됨)
    const p = employeePair('STRICT', { eligDays: 20, leaveDays: 2, normalElig: 16, presentElig: 18 })
    expect(p).toEqual({ num: 16, denom: 20, clamped: false })
  })
  it('휴일 출근 등으로 NORMAL > 분모 → clamp', () => {
    const p = employeePair('STRICT', { eligDays: 18, leaveDays: 0, normalElig: 19, presentElig: 19 })
    expect(p).toEqual({ num: 18, denom: 18, clamped: true })
  })
})

describe('employeePair — 경계', () => {
  it('소정근로일 0 (입사 전·전월 휴직 등) → 분모 0', () => {
    const p = employeePair('EXCUSED', { eligDays: 0, leaveDays: 0, normalElig: 0, presentElig: 0 })
    expect(p).toEqual({ num: 0, denom: 0, clamped: false })
  })
  it('휴가가 소정근로일보다 많아도 분모 음수 방지 (max 0)', () => {
    const p = employeePair('EXCUSED', { eligDays: 3, leaveDays: 5, normalElig: 0, presentElig: 0 })
    expect(p.denom).toBe(0)
    expect(p.num).toBe(0)
  })
})

describe('aggregate — 판정 순서', () => {
  const full = (n: number): EmployeePair[] =>
    Array.from({ length: n }, () => ({ num: 20, denom: 20, clamped: false }))

  it('① Σ분모=0 → 데이터 없음 (denom:0, suppressed:false)', () => {
    const r = aggregate([
      { num: 0, denom: 0, clamped: false },
      { num: 0, denom: 0, clamped: false },
    ])
    expect(r).toEqual({ rate: null, denom: 0, cohort: 0, suppressed: false })
  })

  it('② cohort < 5 → 표본 억제 (denom:null, suppressed:true)', () => {
    const r = aggregate(full(4)) // 4명 만근
    expect(r.rate).toBeNull()
    expect(r.denom).toBeNull()
    expect(r.cohort).toBe(4)
    expect(r.suppressed).toBe(true)
  })

  it('③ cohort ≥ 5 → 계산 (rate %, denom Σ)', () => {
    // 5명: 4명 만근(20/20) + 1명 18/20 → Σnum=98, Σdenom=100 → 98.0%
    const pairs: EmployeePair[] = [...full(4), { num: 18, denom: 20, clamped: false }]
    const r = aggregate(pairs)
    expect(r).toEqual({ rate: 98, denom: 100, cohort: 5, suppressed: false })
  })

  it('cohort 는 분모>0 직원만 (분모 0 직원은 미포함)', () => {
    // 5명 중 1명은 분모 0 → cohort 4 → 억제
    const pairs: EmployeePair[] = [...full(4), { num: 0, denom: 0, clamped: false }]
    const r = aggregate(pairs)
    expect(r.cohort).toBe(4)
    expect(r.suppressed).toBe(true)
  })

  it('혼합 공식 가중 합산 (생산직 STRICT + 사무직 EXCUSED 쌍 동시 집계)', () => {
    // 사무직 3명 20/20, 생산직 3명 15/20 → Σnum=105, Σdenom=120 → 87.5%
    const office = Array.from({ length: 3 }, () => ({ num: 20, denom: 20, clamped: false }))
    const prod = Array.from({ length: 3 }, () => ({ num: 15, denom: 20, clamped: false }))
    const r = aggregate([...office, ...prod])
    expect(r).toEqual({ rate: 87.5, denom: 120, cohort: 6, suppressed: false })
  })

  it('rate 소수 1자리 반올림', () => {
    // 5명 모두 17/20 → 85.0; 5명 모두 5/6 → 83.333 → 83.3
    const r = aggregate(Array.from({ length: 5 }, () => ({ num: 5, denom: 6, clamped: false })))
    expect(r.rate).toBe(83.3)
  })

  it('커스텀 cohortMin', () => {
    const r = aggregate(
      Array.from({ length: 2 }, () => ({ num: 10, denom: 10, clamped: false })),
      2,
    )
    expect(r.suppressed).toBe(false)
    expect(r.rate).toBe(100)
  })
})

describe('상수·계약', () => {
  it('UNSUPPORTED_POINT 고정 tuple', () => {
    expect(UNSUPPORTED_POINT).toEqual({ rate: null, denom: null, cohort: 0, suppressed: false })
  })
  it('DEFAULT_COHORT_MIN = 5', () => {
    expect(DEFAULT_COHORT_MIN).toBe(5)
  })
})
