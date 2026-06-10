'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — WdGroupedStatCard (Phase 3a Stage4 PR-1, Workday 정합)
// 범용 "그룹 라벨 + N개 지표" 카드. 휴가 잔여(layout=cards, progress 有) /
// 근태 월간통계(layout=rows, progress 無) 공용 베이스.
// 출처: _design-reference page-my-space.jsx 잔여 휴가 / 월간 통계.
// ═══════════════════════════════════════════════════════════

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────

/** progress.tone / valueTone 공용 — status.ts StatusCategory 부분집합 */
export type WdStatTone = 'success' | 'accent' | 'warning' | 'neutral'

export interface WdGroupedStatItem {
  id: string
  label: string
  /** 주값 (잔여 일수 / "08:52" / "21") */
  value: ReactNode
  /** 보조 단위 ("/ 15일" / "h" / "일") */
  unit?: string
  /** 하단 캡션 ("2.5일 사용 / 대기 0.5") */
  caption?: string
  /** 진행바 (휴가=有 / 근태=無). ratio 0..1, tone=잔여율 의미색 */
  progress?: { ratio: number; tone: WdStatTone }
  /** 주값 색 (근태 초과/지각 강조). 기본 neutral */
  valueTone?: WdStatTone
}

export interface WdGroupedStatGroup {
  /** 카테고리 라벨 (휴가=연차/병가… / 근태=없음) */
  label?: string
  items: WdGroupedStatItem[]
}

export interface WdGroupedStatCardProps {
  title: string
  subtitle?: string
  groups: WdGroupedStatGroup[]
  /** cards=미니카드 가로행(휴가) / rows=라벨↔값 세로목록(근태) */
  layout: 'cards' | 'rows'
  /** cards 가로스크롤 동작 (베이스 책임). 기본 auto = 폭 부족 시 스크롤 */
  scrollBehavior?: 'auto' | 'none' | 'always'
  /** 빈 상태 슬롯 (EmptyState SSOT 주입) */
  emptyState?: ReactNode
  className?: string
}

// ─── Constants ──────────────────────────────────────────────
// 디자인 SSOT 매핑 (status.ts/globals.css 정합):
// progress fill = solid 토큰 / valueTone = D17 AA-safe text 토큰.
// (--success/--warning CSS 변수 부재 → tertiary/warning-bright/wt-4 SSOT 사용)

const TONE_BAR: Record<WdStatTone, string> = {
  success: 'bg-tertiary',
  accent: 'bg-wt-4',
  warning: 'bg-warning-bright',
  neutral: 'bg-muted-foreground/40',
}

const TONE_VALUE_TEXT: Record<WdStatTone, string> = {
  // badge.tsx success SSOT 정합: AA-safe #006b39 (design.md hex 예외#1) + dark 페어
  success: 'text-[#006b39] dark:text-tertiary',
  accent: 'text-wt-4',
  warning: 'text-ctr-warning',
  neutral: 'text-foreground',
}

const SCROLL_CLASS: Record<NonNullable<WdGroupedStatCardProps['scrollBehavior']>, string> = {
  auto: 'flex gap-4 overflow-x-auto pb-1',
  always: 'flex gap-4 overflow-x-scroll pb-1',
  none: 'grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4',
}

// ─── Helpers ────────────────────────────────────────────────

function isEmpty(groups: WdGroupedStatGroup[]): boolean {
  return !groups.length || groups.every((g) => !g.items.length)
}

// ─── Subcomponents ──────────────────────────────────────────

function MiniCard({ item }: { item: WdGroupedStatItem }) {
  const valueTone = item.valueTone ?? 'neutral'
  const pct = item.progress ? Math.min(Math.max(item.progress.ratio, 0), 1) * 100 : null
  return (
    <article
      role="listitem"
      className="min-w-[200px] flex-shrink-0 rounded-2xl border border-border bg-card p-5"
    >
      <p className="mb-2 text-xs font-medium text-muted-foreground">{item.label}</p>
      <div className="flex items-end gap-1">
        <p className={cn('text-2xl font-bold tracking-[-0.02em] tabular-nums', TONE_VALUE_TEXT[valueTone])}>
          {item.value}
        </p>
        {item.unit ? (
          <p className="mb-0.5 text-sm text-muted-foreground">{item.unit}</p>
        ) : null}
      </div>
      {item.progress ? (
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={Math.round(pct as number)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${item.label} ${Math.round(pct as number)}%`}
        >
          <div
            className={cn('h-full rounded-full transition-all', TONE_BAR[item.progress.tone])}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}
      {item.caption ? (
        <p className="mt-1.5 text-xs text-muted-foreground">{item.caption}</p>
      ) : null}
    </article>
  )
}

function StatRow({ item }: { item: WdGroupedStatItem }) {
  const valueTone = item.valueTone ?? 'neutral'
  return (
    <div
      role="listitem"
      className="flex items-baseline justify-between border-b border-border py-2 last:border-b-0"
    >
      <span className="text-sm text-muted-foreground">{item.label}</span>
      <span className="flex items-baseline gap-1">
        <span className={cn('text-base font-semibold tabular-nums', TONE_VALUE_TEXT[valueTone])}>
          {item.value}
        </span>
        {item.unit ? (
          <span className="text-xs font-medium text-muted-foreground">{item.unit}</span>
        ) : null}
      </span>
    </div>
  )
}

// ─── Component ──────────────────────────────────────────────

export function WdGroupedStatCard({
  title,
  subtitle,
  groups,
  layout,
  scrollBehavior = 'auto',
  emptyState,
  className,
}: WdGroupedStatCardProps) {
  const headingId = `wgsc-${title.replace(/\s+/g, '-')}`
  return (
    <section
      aria-labelledby={headingId}
      className={cn('rounded-2xl border border-border bg-card p-6', className)}
    >
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <h3 id={headingId} className="text-base font-bold tracking-[-0.02em] text-foreground">
          {title}
        </h3>
        {subtitle ? (
          <span className="text-xs text-muted-foreground">{subtitle}</span>
        ) : null}
      </div>

      {isEmpty(groups)
        ? emptyState ?? null
        : (
          <div className="space-y-4">
            {groups.map((group, gi) => (
              <div key={group.label ?? `g${gi}`}>
                {group.label ? (
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.label}
                  </p>
                ) : null}
                {layout === 'cards' ? (
                  <div role="list" className={SCROLL_CLASS[scrollBehavior]}>
                    {group.items.map((item) => (
                      <MiniCard key={item.id} item={item} />
                    ))}
                  </div>
                ) : (
                  <div role="list">
                    {group.items.map((item) => (
                      <StatRow key={item.id} item={item} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
    </section>
  )
}
