// CTR HR Hub — 차트 카테고리색 SSOT (Phase 2 P2b-chart)
// 카테고리 시리즈색을 Workday --wt 팔레트 단일 소스로 통합.
// 슬롯 순서 = wt-avatar.ts WT_ORDER 교차순 (avatar/dept/chart 공용 SSOT).
// 8 초과 시리즈는 wtSlotColor 가 교차순 순환 재사용 (법인비교 등 희소 케이스).
// 라이트만 (다크 wt 미정의 = known-deferred, 별도 다크 Phase).
// axis/grid/tooltip + RISK/HEATMAP 의미색은 비카테고리 → wt 미적용·보존.

import { wtSlotColor } from './wt-avatar'
import { STATUS_BG, STATUS_BADGE_FG } from './status'

// 시리즈 슬롯 계약: idx 2/3/4 는 다수 소비처(CompaRatioTab·Succession·
// Attrition·predictive 등)가 success-green / warning-amber / danger-red
// 의미색으로 위치 고정 사용 → wt 미적용·기존 시맨틱 hex 보존 (사용자 Q3
// "의미색 유지" 원칙. Codex Gate2 P2 반영, 2026-05-18). 나머지 idx 는
// 순수 카테고리라 wt 교차순 슬롯으로 통합.
const SEMANTIC_SLOTS: Record<number, string> = {
  // Wave 0: proto 시맨틱 패밀리 (success oklch(56% .14 155) / warning oklch(70% .14 75) / danger oklch(58% .20 25))
  2: '#008b4e', // success green (RISK_COLORS.low / STATUS success 정합)
  3: '#d0901e', // warning amber (RISK_COLORS.medium 정합)
  4: '#d73337', // danger red   (RISK_COLORS.critical / STATUS error 정합)
}

/** 시리즈 10색 — 카테고리 idx = wt 교차순, 의미 idx(2/3/4) = 시맨틱 hex 보존 */
const CHART_SERIES = Array.from(
  { length: 10 },
  (_, i) => SEMANTIC_SLOTS[i] ?? wtSlotColor(i),
)

export const CHART_THEME = {
  // 6 기본 시리즈 (idx 0~5). 6색 초과 시 CHART_COLORS_EXTENDED 이어 사용.
  colors: CHART_SERIES.slice(0, 6),
  axis: {
    stroke: '#E2E8F0',
    tick: { fontSize: 12, fill: '#64748B' },
    label: { fontSize: 13, fill: '#334155', fontWeight: 500 },
  },
  grid: { stroke: '#F1F5F9', strokeDasharray: '3 3' },
  tooltip: {
    contentStyle: {
      backgroundColor: '#FFFFFF',
      border: '1px solid #E2E8F0',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(15,23,42,0.08)',
      padding: '12px 16px',
      fontSize: '13px',
    },
    labelStyle: { fontWeight: 600, marginBottom: '4px' },
    cursor: { fill: '#F8FAFC' },
  },
  legend: { wrapperStyle: { paddingTop: '16px', fontSize: '13px' } },
  responsive: { width: '100%', height: 320 },
} as const

/** 10색 확장 팔레트 — 법인 비교 등 6색 초과 시 CHART_THEME.colors 뒤에 이어서 사용 */
export const CHART_COLORS_EXTENDED = CHART_SERIES.slice(6, 10)

/**
 * 차트 카테고리색 SSOT (이전 `components/analytics/chart-colors.ts` 통합).
 * primary = 시리즈 idx 0, secondary = idx 1~9. grid/text/background/semantic
 * 키는 비카테고리(축·배경·시맨틱)라 wt 미적용·기존값 보존.
 */
export const CHART_COLORS = {
  primary: CHART_SERIES[0],
  secondary: CHART_SERIES.slice(1, 10),
  grid: '#F1F5F9',
  text: '#64748b',
  background: '#F8FAFC',
  danger: '#d73337',
  warning: '#d0901e',
  success: '#008b4e',
  neutral: '#64748b',
}

/** Risk-level semantic colors — attrition, predictive, succession 차트용
 *  Severity 순: low(green) → medium(amber) → high(orange) → critical(red)
 *  의미색(심각도 인코딩) → wt 미적용·보존 (P2b 결정, 2026-05-18). */
export const RISK_COLORS = {
  low: '#008b4e',
  medium: '#d0901e',
  high: '#e4762c',   // wd-orange — proto 오렌지 패밀리
  critical: '#d73337',
} as const

/** Heatmap 시맨틱 스펙트럼: Green(낮음/좋음) → Amber(중간) → Red(높음/나쁨)
 *  의미색(심각도 인코딩) → wt 미적용·보존 (P2b 결정, 2026-05-18). */
export const HEATMAP_COLORS = {
  scale: [
    'rgba(0,139,78,0.1)', 'rgba(0,139,78,0.2)', 'rgba(0,139,78,0.3)',
    'rgba(208,144,30,0.2)', 'rgba(208,144,30,0.4)',
    'rgba(215,51,55,0.2)', 'rgba(215,51,55,0.4)',
  ] as const,
  text: { low: '#008b4e', mid: '#b45309', high: '#d73337' },
} as const

// ─── Recruitment 도메인 색 SSOT (Wave 1 recruitment) ─────────
// 채용 파이프라인 단계색 — Board/dashboard/pipeline/CandidateTimeline 3중복제
// + 값 불일치(#FF9800 vs #F4BE5E 등)를 시맨틱 SSOT로 정규화. Material(#2196F3
// 등) 폐기, 브랜드 navy + status 패밀리로 통일. (도메인 고유색 = rules 예외#3)

/** 채용 단계 union — satisfies로 누락 컴파일타임 검출 */
export type RecruitmentStage =
  | 'APPLIED' | 'SCREENING' | 'INTERVIEW_1' | 'INTERVIEW_2'
  | 'FINAL' | 'OFFER' | 'OFFER_ACCEPTED' | 'OFFER_DECLINED' | 'HIRED' | 'REJECTED'

/** 파이프라인 단계 차트 fill색 (funnel·stage 헤더·진행 셀) */
export const RECRUITMENT_STAGE_COLORS = {
  APPLIED: '#64748b',        // neutral (지원 — 미분류)
  SCREENING: '#004964',      // navy (진행)
  INTERVIEW_1: '#004964',
  INTERVIEW_2: '#004964',
  OFFER: '#004964',
  FINAL: '#d0901e',          // warning amber (최종 — 주의 환기)
  OFFER_ACCEPTED: '#008b4e', // success
  HIRED: '#008b4e',
  OFFER_DECLINED: '#d73337', // error
  REJECTED: '#d73337',
} satisfies Record<RecruitmentStage, string>

/** 면접 추천 등급색 (bg/text 분리 — D17). STATUS_BG·STATUS_BADGE_FG 재사용.
 *  recommendation 문자열로 인덱싱(+fallback)되므로 Record<string,…> 명시 타입. */
export const RECOMMENDATION_COLORS: Record<string, { bg: string; text: string }> = {
  STRONG_YES: { bg: STATUS_BG.success, text: STATUS_BADGE_FG.success },
  YES: { bg: STATUS_BG.success, text: STATUS_BADGE_FG.success },
  NEUTRAL: { bg: STATUS_BG.warning, text: STATUS_BADGE_FG.warning },
  NO: { bg: STATUS_BG.error, text: STATUS_BADGE_FG.error },
  STRONG_NO: { bg: STATUS_BG.error, text: STATUS_BADGE_FG.error },
}
