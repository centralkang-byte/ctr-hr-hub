// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Industry Benchmark Data (정적)
// 제조업 + 글로벌 평균 기준 (BambooHR/SHRM 2024 리포트 참조)
// 차트에 ReferenceLine 점선으로 표시
// ═══════════════════════════════════════════════════════════

export interface BenchmarkData {
  label: string
  value: number
  unit: string
}

// ─── 이직률 벤치마크 ────────────────────────────────────────

export const TURNOVER_BENCHMARKS = {
  manufacturing: { label: '제조업 평균', value: 4.5, unit: '%' },
  global: { label: '글로벌 평균', value: 5.2, unit: '%' },
} as const

// ─── 근속연수 벤치마크 ──────────────────────────────────────

export const TENURE_BENCHMARKS = {
  manufacturing: { label: '제조업 평균', value: 4.2, unit: '년' },
  korea: { label: '한국 평균', value: 6.8, unit: '년' },
} as const

// ─── 연차 사용률 벤치마크 ────────────────────────────────────

export const LEAVE_USAGE_BENCHMARKS = {
  korea: { label: '한국 평균', value: 72, unit: '%' },
  recommended: { label: '권장 수준', value: 80, unit: '%' },
} as const

// ─── 채용 소요일 벤치마크 ────────────────────────────────────

export const TIME_TO_FILL_BENCHMARKS = {
  manufacturing: { label: '제조업 평균', value: 42, unit: '일' },
  global: { label: '글로벌 평균', value: 36, unit: '일' },
} as const

// ─── 온보딩 완료율 벤치마크 ──────────────────────────────────

export const ONBOARDING_BENCHMARKS = {
  best: { label: '상위 25%', value: 95, unit: '%' },
  average: { label: '업계 평균', value: 82, unit: '%' },
} as const

// ─── 국가별 근로시간 규정 ────────────────────────────────────

export const WORK_HOURS_REGULATIONS = {
  KR: { label: '한국 법정', value: 52, unit: '시간/주' },
  CN: { label: '중국 법정', value: 44, unit: '시간/주' },
  EU: { label: 'EU WTD', value: 48, unit: '시간/주' },
  US: { label: '미국 FLSA', value: 40, unit: '시간/주', note: '초과 시 1.5배' },
  VN: { label: '베트남 법정', value: 48, unit: '시간/주' },
} as const

// ─── 초과근무 비율 벤치마크 ────────────────────────────────────

export const OVERTIME_RATE_BENCHMARKS = {
  manufacturing: { label: '제조업 평균', value: 15, unit: '%' },
  recommended: { label: '권장 상한', value: 10, unit: '%' },
} as const

// ─── 교육시간 벤치마크 ────────────────────────────────────────

export const TRAINING_HOURS_BENCHMARKS = {
  manufacturing: { label: '제조업 평균', value: 40, unit: '시간/년' },
  global: { label: '글로벌 평균', value: 47, unit: '시간/년' },
} as const

// ─── 법인 비교용 KPI 벤치마크 매핑 ────────────────────────────

export const COMPARE_KPI_BENCHMARKS: Record<string, { label: string; value: number; unit: string } | null> = {
  turnover_rate: TURNOVER_BENCHMARKS.manufacturing,
  leave_usage: LEAVE_USAGE_BENCHMARKS.korea,
  training_completion: ONBOARDING_BENCHMARKS.average,
  payroll_cost: null, // 절대값 — 벤치마크 해당 없음
  headcount: null,    // 절대값 — 벤치마크 해당 없음
  avg_tenure: TENURE_BENCHMARKS.manufacturing,
  overtime_rate: OVERTIME_RATE_BENCHMARKS.manufacturing,
  training_hours: TRAINING_HOURS_BENCHMARKS.manufacturing,
} as const

// ─── Compa-Ratio 벤치마크 ────────────────────────────────────

export const COMPA_RATIO_BENCHMARKS = {
  low: { label: '최저 경계', value: 0.8, unit: '' },
  target: { label: '목표', value: 1.0, unit: '' },
  high: { label: '최고 경계', value: 1.2, unit: '' },
} as const
