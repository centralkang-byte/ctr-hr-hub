'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 채용 공고 카드 (목록 그리드)
// 출처: _design-reference/page-jobs.jsx .wd-job-card + .wd-funnel
// 4-cell = 현재 단계 스냅샷(누적 전환 아님; bucketStages SSOT 동일 의미)
// ═══════════════════════════════════════════════════════════

import { useTranslations } from 'next-intl'
import { Building2, MapPin, Briefcase } from 'lucide-react'
import { differenceInCalendarDays } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────

interface PostingFunnel {
  applied: number
  screen: number
  interview: number
  offer: number
}

export interface JobCardPosting {
  id: string
  title: string
  status: string
  location: string | null
  deadlineDate: string | null
  department: { id: string; name: string } | null
  funnel: PostingFunnel
}

interface Props {
  posting: JobCardPosting
  employmentTypeLabel: string
  statusLabel: string
  onOpen: (id: string) => void
}

// ─── Helpers ─────────────────────────────────────────────

const CELL_TONE = {
  base: 'bg-muted/40 text-foreground',
  active: 'bg-primary/5 text-primary',
  warn: 'bg-[#b45309]/10 text-ctr-warning',
} as const

// ─── Component ───────────────────────────────────────────

export default function RecruitmentJobCard({ posting, employmentTypeLabel, statusLabel, onOpen }: Props) {
  const t = useTranslations('recruitment')

  // deadlineDate 는 선택한 날짜의 UTC-자정으로 저장됨 → 날짜부만 떼어 로컬 자정에 고정해
  // 캘린더 일수 차이를 계산(UTC instant ↔ 브라우저 로컬 now 비교의 ±1일 시프트 제거).
  const days =
    posting.deadlineDate != null
      ? differenceInCalendarDays(new Date(`${posting.deadlineDate.slice(0, 10)}T00:00:00`), new Date())
      : null

  const cells: { label: string; value: number; tone: keyof typeof CELL_TONE }[] = [
    { label: t('funnelApplied'), value: posting.funnel.applied, tone: 'base' },
    { label: t('funnelScreen'), value: posting.funnel.screen, tone: posting.funnel.screen > 0 ? 'active' : 'base' },
    { label: t('funnelInterview'), value: posting.funnel.interview, tone: posting.funnel.interview > 0 ? 'warn' : 'base' },
    { label: t('funnelOffer'), value: posting.funnel.offer, tone: posting.funnel.offer > 0 ? 'active' : 'base' },
  ]

  return (
    <button
      type="button"
      onClick={() => onOpen(posting.id)}
      className={cn(
        'flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 text-left',
        'hover:border-border-strong hover:shadow-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'motion-safe:transition-all',
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[14.5px] font-semibold text-foreground">{posting.title}</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {posting.department && (
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                {posting.department.name}
              </span>
            )}
            {posting.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                {posting.location}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Briefcase className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
              {employmentTypeLabel}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <StatusBadge status={posting.status}>{statusLabel}</StatusBadge>
          {days == null ? (
            <Badge variant="neutral">{t('deadlineNone')}</Badge>
          ) : days < 0 ? (
            <Badge variant="neutral">{t('deadlinePassed')}</Badge>
          ) : (
            <Badge variant={days <= 7 ? 'warning' : 'info'}>{t('dDay', { days })}</Badge>
          )}
        </div>
      </div>

      {/* Stage snapshot */}
      <div>
        <div className="grid grid-cols-4 gap-1.5">
          {cells.map((c) => (
            <div
              key={c.label}
              className={cn('flex flex-col items-center gap-0.5 rounded-lg py-2', CELL_TONE[c.tone])}
            >
              <span className="text-[10px] font-medium tracking-wide opacity-80">{c.label}</span>
              <span className="font-mono text-base font-semibold tabular-nums">{c.value}</span>
            </div>
          ))}
        </div>
        <p className="mt-1.5 text-[10px] text-muted-foreground">{t('stageSnapshotCaption')}</p>
      </div>
    </button>
  )
}
