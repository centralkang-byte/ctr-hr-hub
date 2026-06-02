'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — WdMonthlyStatCard (Phase 3a Stage5 PR-4, AT-005 카나리)
// WdGroupedStatCard 위 얇은 근태 월간통계 래퍼 (휴가 WdLeaveBalanceCard 동형).
// layout='rows' + 5지표(근무일·출근평균·퇴근평균·초과근무누계·지각) 의미색 주입.
// 출처: _design-reference/page-my-space.jsx:153-172 (월간 통계 5지표).
// F17: 시각(avgClockIn/Out)은 caller가 timezone.ts SSOT(formatToTz)로
//      사전 포맷한 문자열을 수신 — 본 표현 컴포넌트는 시간 포맷 미수행
//      (인라인 toLocaleTimeString 0, SSOT 우회 0).
// ═══════════════════════════════════════════════════════════

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  WdGroupedStatCard,
  type WdGroupedStatGroup,
} from '@/components/shared/WdGroupedStatCard'

// ─── Types ──────────────────────────────────────────────────

/** AT-005 월간 통계 입력. 시각 필드는 timezone.ts SSOT 사전 포맷 문자열(F17). */
export interface WdMonthlyStatInput {
  /** 근무일 수 */
  workDays: number
  /** 출근 평균 — caller가 formatToTz(…, 'HH:mm') 로 포맷한 문자열 (예 "08:52") */
  avgClockIn: string
  /** 퇴근 평균 — 동일 (예 "18:48") */
  avgClockOut: string
  /** 초과근무 누계 (시간) */
  overtimeTotalHours: number
  /** 지각 횟수 */
  lateCount: number
}

interface WdMonthlyStatCardProps {
  data: WdMonthlyStatInput | null
  /** 표시 연 (subtitle "YYYY.MM") */
  year?: number
  /** 표시 월 (1-12) */
  month?: number
  loading?: boolean
}

// ─── Component ──────────────────────────────────────────────

export function WdMonthlyStatCard({ data, year, month, loading }: WdMonthlyStatCardProps) {
  // 휴가 WdLeaveBalanceCard 동형: loading=null 반환 (상위 Skeleton 책임)
  const t = useTranslations('attendance')

  if (loading) return null

  // subtitle = locale-중립 숫자 "YYYY.MM" (proto "5월" 카피 갭 → F15/F1 i18n 트랙)
  const subtitle =
    year && month ? `${year}.${String(month).padStart(2, '0')}` : undefined

  const groups: WdGroupedStatGroup[] = data
    ? [
        {
          items: [
            // ① 근무일 — t('workDate')="근무일" (정확 키). neutral(proto var(--fg))
            {
              id: 'workDays',
              label: t('workDate'),
              value: data.workDays,
              valueTone: 'neutral' as const,
            },
            // ② 출근 평균 — t('clockInTime')="출근 시간" (best-fit, "평균" 갭 F15/F1).
            //   success(proto var(--success)). value=SSOT 사전포맷 문자열(F17)
            {
              id: 'avgClockIn',
              label: t('clockInTime'),
              value: data.avgClockIn,
              valueTone: 'success' as const,
            },
            // ③ 퇴근 평균 — t('clockOutTime')="퇴근 시간" (best-fit, "평균" 갭).
            //   accent(proto var(--accent))
            {
              id: 'avgClockOut',
              label: t('clockOutTime'),
              value: data.avgClockOut,
              valueTone: 'accent' as const,
            },
            // ④ 초과근무 누계 — t('typeOvertime')="초과근무" (best-fit, "누계" 갭).
            //   accent: proto violet oklch(55% .16 290) ≈ wt-4 (최근접 hue, 신규토큰 0)
            {
              id: 'overtimeTotal',
              label: t('typeOvertime'),
              value: data.overtimeTotalHours,
              unit: 'h',
              valueTone: 'accent' as const,
            },
            // ⑤ 지각 — t('lateCount')="지각 횟수" (정확 키, "회" 내장).
            //   warning: proto amber oklch(50% .16 60) ≈ ctr-warning (최근접 hue)
            {
              id: 'lateCount',
              label: t('lateCount'),
              value: data.lateCount,
              valueTone: 'warning' as const,
            },
          ],
        },
      ]
    : []

  return (
    <WdGroupedStatCard
      // title: t('monthlySummary')="월간 요약" 재사용 (proto "월간 통계" 카피 갭 → F15/F1)
      title={t('monthlySummary')}
      subtitle={subtitle}
      groups={groups}
      layout="rows"
      emptyState={<EmptyState />}
    />
  )
}
