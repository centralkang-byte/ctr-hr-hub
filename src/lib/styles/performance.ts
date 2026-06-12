// CTR HR Hub — Performance 도메인 색/아이콘 스케일 SSOT
// 9-box 매트릭스·최종등급·승계 준비도·인정 핵심가치·기분척도의 단일 소스.
//
// chart.ts(Recharts hex 전용)와 분리 — 여기는 Tailwind class 토큰 + Lucide 아이콘 config.
// 원칙(Codex Gate1 B):
//  - 9-box는 성과×역량 2D 분류 → 색은 보조, 라벨/위치가 주 정보. 기존 블록↔색 의미 보존.
//  - 등급은 6단계 ordinal → semantic category로 축약 금지(정보 손실), 6단계 distinct 유지.
//  - 준비도는 "준비까지 시간"(인재 품질 아님) → 라벨로 의미 명확히.
//  - D17: bg는 밝게(/10·/15), text는 WCAG AA 충족 ink(#006b39·#b45309·destructive).

import type { LucideIcon } from 'lucide-react'
import { Smile, Meh, Frown, Angry, CheckCircle2, Clock, Hourglass } from 'lucide-react'

// ─── 9-Box Matrix (성과×역량) ───────────────────────────────
// GRID_LAYOUT [[7,8,9],[4,5,6],[1,2,3]] · rows=역량(high→low), cols=성과(low→high).
// 블록 9(3C)=stars, 블록 1(1A)=최저. 기존 BLOCK_LABELS 색 의미 보존, raw amber/emerald만 토큰화.
export const NINE_BOX_CONFIG: Record<number, { label: string; className: string }> = {
  1: { label: '1A', className: 'bg-destructive/10 text-destructive' },
  2: { label: '2A', className: 'bg-warning-bright/15 text-ctr-warning' },
  3: { label: '3A', className: 'bg-tertiary/10 text-[#006b39]' },
  4: { label: '1B', className: 'bg-warning-bright/15 text-ctr-warning' },
  5: { label: '2B', className: 'bg-primary/10 text-primary' },
  6: { label: '3B', className: 'bg-tertiary/10 text-[#006b39]' },
  7: { label: '1C', className: 'bg-primary/10 text-primary' },
  8: { label: '2C', className: 'bg-tertiary/10 text-[#006b39]' },
  9: { label: '3C', className: 'bg-primary/10 text-primary' },
}

// ─── 최종 등급 (6단계 ordinal — 축약 금지) ───────────────────
export const GRADE_CONFIG: Record<string, { className: string; labelKey: string }> = {
  EXCEEDS_PLUS: { className: 'bg-primary/15 text-primary', labelKey: 'grade.exceedsPlus' },
  EXCEEDS: { className: 'bg-primary/10 text-primary', labelKey: 'grade.exceeds' },
  MEETS_PLUS: { className: 'bg-tertiary/15 text-[#006b39]', labelKey: 'grade.meetsPlus' },
  MEETS: { className: 'bg-tertiary/10 text-[#006b39]', labelKey: 'grade.meets' },
  BELOW: { className: 'bg-warning-bright/15 text-ctr-warning', labelKey: 'grade.below' },
  BELOW_MINUS: { className: 'bg-destructive/10 text-destructive', labelKey: 'grade.belowMinus' },
}

// ─── 승계 준비도 (준비까지 시간 — 인재 품질 아님) ────────────
// labelKey는 EmployeeInsightPanel에서 쓰던 기존 키 재사용(신규 키 0).
export const READINESS_CONFIG: Record<
  string,
  { className: string; dotClass: string; icon: LucideIcon; labelKey: string }
> = {
  READY_NOW: {
    className: 'bg-tertiary/10 text-[#006b39]',
    dotClass: 'bg-tertiary',
    icon: CheckCircle2,
    labelKey: 'insight.readinessReadyNow',
  },
  READY_1_2_YEARS: {
    className: 'bg-warning-bright/15 text-ctr-warning',
    dotClass: 'bg-warning-bright',
    icon: Clock,
    labelKey: 'insight.readiness1to2Years',
  },
  READY_3_PLUS_YEARS: {
    className: 'bg-destructive/10 text-destructive',
    dotClass: 'bg-destructive',
    icon: Hourglass,
    labelKey: 'insight.readinessDevelopment',
  },
}

// ─── 인정 핵심가치 4색 (카테고리색 — 시맨틱 아님, 브랜드 팔레트) ─
// 4개 distinct 브랜드 색: orange / green / purple(wt-4) / navy. labelKey는 기존 키 재사용.
export const RECOGNITION_VALUE_CONFIG: Record<
  string,
  {
    labelKey: string
    dotClass: string
    bgDefault: string
    borderDefault: string
    textDefault: string
    bgActive: string
    textActive: string
  }
> = {
  CHALLENGE: {
    labelKey: 'recognition_valueChallenge',
    dotClass: 'bg-wd-orange',
    bgDefault: 'bg-wd-orange-soft',
    borderDefault: 'border-wd-orange/30',
    textDefault: 'text-wd-orange-ink',
    bgActive: 'bg-wd-orange',
    textActive: 'text-white',
  },
  TRUST: {
    labelKey: 'recognition_valueTrust',
    dotClass: 'bg-tertiary',
    bgDefault: 'bg-tertiary/10',
    borderDefault: 'border-tertiary/30',
    textDefault: 'text-[#006b39]',
    bgActive: 'bg-tertiary',
    textActive: 'text-white',
  },
  RESPONSIBILITY: {
    labelKey: 'recognition_valueResponsibility',
    dotClass: 'bg-wt-4',
    bgDefault: 'bg-wt-4/10',
    borderDefault: 'border-wt-4/30',
    textDefault: 'text-wt-4',
    bgActive: 'bg-wt-4',
    textActive: 'text-white',
  },
  RESPECT: {
    labelKey: 'recognition_valueRespect',
    dotClass: 'bg-primary',
    bgDefault: 'bg-primary/10',
    borderDefault: 'border-primary/30',
    textDefault: 'text-primary',
    bgActive: 'bg-primary',
    textActive: 'text-white',
  },
}

// ─── 기분 척도 (4단계 — emoji→Lucide, 4단계 보존) ─────────────
// 라벨은 컴포넌트가 기존 소스(picker 텍스트/aria)를 유지 — 신규 i18n 키 0.
export type MoodKey = 'positive' | 'neutral' | 'negative' | 'concerned'
export const MOOD_SCALE: Record<MoodKey, { icon: LucideIcon; className: string }> = {
  positive: { icon: Smile, className: 'text-[#006b39]' },
  neutral: { icon: Meh, className: 'text-muted-foreground' },
  negative: { icon: Frown, className: 'text-ctr-warning' },
  concerned: { icon: Angry, className: 'text-destructive' },
}
