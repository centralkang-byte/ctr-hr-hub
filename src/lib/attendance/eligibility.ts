// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Attendance-rate eligibility engine (PR-4b) — PURE
// 출근율% 공식·집계 코어. SQL 피더가 직원-기간별 {eligDays, leaveDays, normalElig,
// presentElig} 를 (근무일에서만 집계해) 넘겨주면, 여기서 직군 공식 → (출근, 분모) 쌍 →
// Σ출근/Σ분모 집계 + 표본 억제를 수행한다. 부수효과 없음 → 단위테스트 대상.
//
// CEO 결정(2026-06-14): 생산직 PRODUCTION = 엄격(STRICT, 정상출근만 ÷ 소정근로일),
// 그 외(OFFICE·MANAGEMENT·R_AND_D·미지정) = 면제(EXCUSED, 출근 ÷ (소정근로일 − 승인휴가)).
// ═══════════════════════════════════════════════════════════

import type { JobCategoryCode } from '@/generated/prisma/enums'

// ─── Types ──────────────────────────────────────────────────

export type RateFormula = 'EXCUSED' | 'STRICT'

/** SQL 피더가 산출하는 직원-기간 단위 원자료 (전부 "근무일(eligible date)" 위에서만 집계됨) */
export interface EmployeePeriodInput {
  /** 소정근로일 수 (평일 − 공휴일/지정휴무 − 휴직 − 입퇴사 밖, 오늘까지) */
  eligDays: number
  /** 소정근로일 중 승인휴가 일수 (반차 0.5, per-day [0,1] cap) — EXCUSED 분모 차감분 */
  leaveDays: number
  /** 소정근로일 위 정상출근(NORMAL) 수 */
  normalElig: number
  /** 소정근로일 위 출근(NORMAL+LATE+EARLY_OUT) 수 */
  presentElig: number
}

/** 직원-기간의 (출근=num, 분모=denom) 쌍. 집계는 쌍을 합산해 가중평균을 만든다. */
export interface EmployeePair {
  num: number
  denom: number
  /** raw 출근수 > 분모 (휴일·휴가일 출근 등 데이터 이상으로 clamp 됨) */
  clamped: boolean
}

export interface AggregateResult {
  /** 출근율 % (0..100, 소수 1자리). 표본 억제·데이터 없음·미지원이면 null */
  rate: number | null
  /** Σ분모. 억제(<5)·미지원이면 null, 데이터 없음이면 0 */
  denom: number | null
  /** 분모>0 인 distinct 직원 수 (= eligibleCohort, 억제 게이트) */
  cohort: number
  /** 표본 < cohortMin 으로 가려졌는지 (UI "표본 적음" 표시는 이때만) */
  suppressed: boolean
}

export const DEFAULT_COHORT_MIN = 5

/** 미지원 법인(교대제·비표준 근무주)의 고정 rate-point */
export const UNSUPPORTED_POINT: AggregateResult = {
  rate: null,
  denom: null,
  cohort: 0,
  suppressed: false,
}

// ─── Pure functions ─────────────────────────────────────────

/** 직군 코드 → 출근율 공식. PRODUCTION 만 엄격, 나머지·미지정은 면제. */
export function formulaForJobCategory(code: JobCategoryCode | null | undefined): RateFormula {
  return code === 'PRODUCTION' ? 'STRICT' : 'EXCUSED'
}

/**
 * 직원-기간 원자료 → (출근, 분모) 쌍.
 * - EXCUSED: 분모 = 소정근로일 − 휴가, 출근 = NORMAL+LATE+EARLY_OUT
 * - STRICT : 분모 = 소정근로일,        출근 = NORMAL
 * 출근수는 분모로 clamp (rate ≤ 100% 보장; 초과분은 clamped=true 로 표기).
 */
export function employeePair(formula: RateFormula, input: EmployeePeriodInput): EmployeePair {
  const eligDays = Math.max(0, input.eligDays)
  const raw = formula === 'EXCUSED' ? input.presentElig : input.normalElig
  const denom =
    formula === 'EXCUSED' ? Math.max(0, eligDays - Math.max(0, input.leaveDays)) : eligDays
  const num = Math.min(Math.max(0, raw), denom)
  return { num, denom, clamped: raw > denom }
}

/**
 * 직원별 쌍들을 합산해 출근율을 낸다. 판정 순서(Codex Gate1 r3 — 모순 제거):
 *  ① Σ분모 = 0       → 데이터 없음 {rate:null, denom:0,    cohort:0, suppressed:false}
 *  ② cohort < min    → 표본 억제   {rate:null, denom:null, cohort,   suppressed:true}
 *  ③ 그 외            → 계산        {rate:%,    denom:Σ,    cohort,   suppressed:false}
 * ⇒ rate ≠ null 이면 denom ≠ null 보장. cohort = 분모>0 직원 수.
 */
export function aggregate(
  pairs: readonly EmployeePair[],
  cohortMin: number = DEFAULT_COHORT_MIN,
): AggregateResult {
  let sumNum = 0
  let sumDenom = 0
  let cohort = 0
  for (const p of pairs) {
    sumNum += p.num
    sumDenom += p.denom
    if (p.denom > 0) cohort++
  }
  if (sumDenom <= 0) return { rate: null, denom: 0, cohort: 0, suppressed: false }
  if (cohort < cohortMin) return { rate: null, denom: null, cohort, suppressed: true }
  return {
    rate: Math.round((sumNum / sumDenom) * 1000) / 10, // % 소수 1자리
    denom: sumDenom,
    cohort,
    suppressed: false,
  }
}
