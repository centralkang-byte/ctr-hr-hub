'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — ApprovalPreview (PR-5A HR Admin 대시보드 카나리)
// 프로토타입 SSOT: _design-reference/page-dashboard-workday.jsx:268-308 (wd-action-stack)
// HrAdminHomeV2 전용 — top 4 pending approval 카드.
// PR-5A 가드: "승인" Link는 mutation 0, /approvals/inbox?focus={id} 이동만 수행.
//   onApprove 콜백 prop 사전 정의 금지 — PR-5B에서 mutation 도입 시 시그니처 정리.
// 타입명: ApprovalPreviewItem (홈 전용, /api/v1/approvals/inbox 의 ApprovalItem과 충돌 회피)
// ═══════════════════════════════════════════════════════════

import Link from 'next/link'
import {
  ArrowRight,
  Calendar,
  DollarSign,
  Inbox,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ELEVATION, MOTION, TYPOGRAPHY } from '@/lib/styles'
import type { ApprovalPreviewItem } from '@/types'

// ─── Types ──────────────────────────────────────────────────

interface ApprovalPreviewProps {
  items: ApprovalPreviewItem[]
  /** 헤더 "{N}건" — items.length와 같지 않을 수 있음 (전체 PENDING 카운트) */
  totalCount: number
  /** "전체 결재함 →" 링크 — 보통 /approvals/inbox */
  viewAllHref: string
  /** 섹션 헤더 라벨 (예: "처리 대기") */
  headingLabel: string
  /** "{N}건 · 우선순위 정렬" 보조 라벨 — caller가 ICU 형식 적용 후 전달 */
  subHeadingLabel: string
  /** "전체 결재함 →" 라벨 */
  viewAllLabel: string
  /** urgency 칩 라벨 */
  urgencyLabels: { overdue: string; today: string; queued: string }
  /** "승인" 링크 라벨 */
  approveLabel: string
  /** "{submittedAt} 제출" — caller가 사전 포맷 + ICU 적용 */
  submittedFormatter: (iso: string) => string
  /** empty state 메시지 — items.length === 0 일 때 */
  emptyLabel: string
  loading?: boolean
  className?: string
}

// ─── Type → Icon map ────────────────────────────────────────

const TYPE_ICON: Record<ApprovalPreviewItem['type'], LucideIcon> = {
  LEAVE: Calendar,
  PAYROLL: DollarSign,
  OTHER: Inbox,
}

// ─── Urgency → icon/chip tints ──────────────────────────────
// Wave 1: proto .wd-action-card (styles.css:895-944) — 좌측보더 금지(AI slop),
// urgency는 아이콘 사각형 + chip 틴트로 전달 (overdue=red-soft·today=orange-soft)

const URGENCY_ICO: Record<ApprovalPreviewItem['urgency'], string> = {
  overdue: 'bg-destructive/10 text-destructive',
  today: 'bg-wd-orange-soft text-wd-orange-ink',
  queued: 'bg-muted text-muted-foreground',
}

const URGENCY_CHIP: Record<ApprovalPreviewItem['urgency'], string> = {
  overdue: 'bg-destructive/10 text-destructive',
  today: 'bg-wd-orange-soft text-wd-orange-ink',
  queued: 'bg-muted text-muted-foreground',
}

// ─── Component ──────────────────────────────────────────────

export function ApprovalPreview({
  items,
  totalCount,
  viewAllHref,
  headingLabel,
  subHeadingLabel,
  viewAllLabel,
  urgencyLabels,
  approveLabel,
  submittedFormatter,
  emptyLabel,
  loading,
  className,
}: ApprovalPreviewProps) {
  const headingId = 'approval-preview-heading'

  return (
    <section aria-labelledby={headingId} className={cn('flex flex-col gap-3', className)}>
      {/* 헤더: 제목 + 보조 + viewAll */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h2 id={headingId} className={cn(TYPOGRAPHY.statLabel, 'text-base font-semibold text-foreground')}>
            {headingLabel}
          </h2>
          <span className="text-xs text-muted-foreground">
            {subHeadingLabel}
          </span>
        </div>
        <Link
          href={viewAllHref}
          className={cn(
            'inline-flex min-h-[44px] items-center gap-1 text-xs font-medium text-primary',
            'hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:rounded-sm',
            MOTION.microOut,
          )}
        >
          {viewAllLabel}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      {/* 본문: 로딩 / 빈 / 카드 스택 */}
      {loading ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn('h-20 animate-pulse rounded-xl bg-muted', ELEVATION.xs)}
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground">
          {emptyLabel}
        </p>
      ) : (
        <ul role="list" className="flex flex-col gap-2">
          {items.map((item) => {
            const Icon = TYPE_ICON[item.type]
            const urgencyLabel = urgencyLabels[item.urgency]

            return (
              <li
                key={item.id}
                className={cn(
                  // Wave 1: proto .wd-action-card — 1px 가시 보더 + flex-wrap 모바일 2행 (Codex G1 P1-7)
                  'flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4',
                  'hover:border-border-strong hover:shadow-sm',
                  MOTION.microOut,
                  ELEVATION.xs,
                )}
              >
                {/* 좌측 type icon — urgency 틴트 사각형 (proto .wd-action-card .ico), sm+ 표시 */}
                <div
                  className={cn(
                    'hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg sm:flex',
                    URGENCY_ICO[item.urgency],
                  )}
                  aria-hidden="true"
                >
                  <Icon className="h-5 w-5" strokeWidth={1.6} />
                </div>

                {/* 중앙 — title + meta. basis 강제로 좁은 화면에서 액션 행 분리 */}
                <div className="min-w-0 flex-1 basis-[14rem]">
                  <p className="truncate text-sm font-medium text-foreground">
                    <span className="font-semibold">{item.requesterName}</span>
                    {' · '}
                    {item.description}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {item.team}
                    {' · '}
                    {submittedFormatter(item.submittedAt)}
                    {item.note ? (
                      <span className="italic text-muted-foreground"> · &ldquo;{item.note}&rdquo;</span>
                    ) : null}
                  </p>
                </div>

                {/* 우측 — urgency chip + 승인 Link (mutation 0, focus 이동만). 모바일에선 둘째 행 우측 정렬 */}
                <div className="ml-auto flex shrink-0 items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
                      URGENCY_CHIP[item.urgency],
                    )}
                  >
                    {urgencyLabel}
                  </span>
                  {/* PR-5A 가드: mutation 0. Link만 (focus 파라미터로 inbox 이동) */}
                  <Link
                    href={`${viewAllHref}?focus=${encodeURIComponent(item.id)}`}
                    className={cn(
                      'inline-flex min-h-[36px] items-center rounded-full bg-warm px-3 text-xs font-semibold text-primary-foreground',
                      'hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      MOTION.microOut,
                    )}
                  >
                    {approveLabel}
                  </Link>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* sr-only — 전체 카운트 vs 표시 카운트 차이 안내 */}
      {totalCount > items.length ? (
        <p className="sr-only">
          전체 {totalCount}건 중 상위 {items.length}건 표시 중
        </p>
      ) : null}
    </section>
  )
}
