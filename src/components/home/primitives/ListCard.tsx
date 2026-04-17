'use client'

import Link from 'next/link'
import { ArrowUpRight, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ELEVATION, MOTION, TYPOGRAPHY, STATUS_FG } from '@/lib/styles'
import type { StatusCategory } from '@/lib/styles/status'

// ─── Types ──────────────────────────────────────────────────

export interface ListRow {
  id: string
  primary: React.ReactNode
  secondary?: React.ReactNode
  statusDot?: StatusCategory
  /** 스크린 리더에 statusDot 의미 전달 — 색상만으로 상태 전달 금지 (accessibility.md) */
  statusLabel?: string
  href?: string
}

export interface ListCardInlineAction {
  icon: LucideIcon
  label: string
  onClick: () => void
}

interface ListCardProps<T> {
  title: string
  items: T[]
  renderItem: (item: T) => ListRow
  /** hover-reveal inline actions. 모바일에서는 항상 표시. */
  actions?: (item: T) => ListCardInlineAction[]
  /** 0건일 때 노출할 컨텐츠 */
  emptyState?: React.ReactNode
  /** 기본 5. 초과 시 "모두 보기" 링크 (viewAllHref 필수) */
  maxRows?: number
  viewAllHref?: string
  viewAllLabel?: string
  density?: 'compact' | 'comfortable'
  className?: string
}

// ─── Component ──────────────────────────────────────────────

/**
 * Attio-style list card.
 * Rows with status dot + primary/secondary text + hover-reveal inline actions.
 * Accessibility: section aria-labelledby, status dot has aria-label, listitem role on rows,
 * 44px tap target on mobile for any interactive row.
 */
export function ListCard<T>({
  title,
  items,
  renderItem,
  actions,
  emptyState,
  maxRows = 5,
  viewAllHref,
  viewAllLabel = '모두 보기',
  density = 'comfortable',
  className,
}: ListCardProps<T>) {
  const titleId = `listcard-${title.replace(/\s+/g, '-')}`
  const visible = items.slice(0, maxRows)
  const hasOverflow = items.length > maxRows

  const rowHeight = density === 'compact' ? 'min-h-[40px]' : 'min-h-[48px]'

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        'flex flex-col rounded-2xl bg-card',
        ELEVATION.xs,
        className,
      )}
    >
      <header className="flex items-center justify-between px-5 pt-5 pb-3">
        <h3 id={titleId} className="text-sm font-semibold text-foreground">
          {title}
        </h3>
        {hasOverflow && viewAllHref ? (
          <Link
            href={viewAllHref}
            className={cn(
              'inline-flex items-center gap-1 text-xs font-medium text-primary',
              'hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:rounded-sm',
              MOTION.microOut,
            )}
          >
            {viewAllLabel}
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        ) : null}
      </header>

      {items.length === 0 ? (
        <div className="px-5 pb-5">{emptyState ?? <DefaultEmpty />}</div>
      ) : (
        <div role="list" className="flex flex-col">
          {visible.map((item) => {
            const row = renderItem(item)
            const itemActions = actions?.(item) ?? []

            const rowContent = (
              <>
                {/* Status dot */}
                {row.statusDot ? (
                  <span
                    className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: STATUS_FG[row.statusDot] }}
                    aria-label={row.statusLabel}
                    role="img"
                  />
                ) : null}

                {/* Text */}
                <div className="min-w-0 flex-1">
                  <div className={TYPOGRAPHY.listPrimary}>{row.primary}</div>
                  {row.secondary ? (
                    <div className={cn(TYPOGRAPHY.listSecondary, 'mt-0.5')}>
                      {row.secondary}
                    </div>
                  ) : null}
                </div>
              </>
            )

            return (
              <div
                key={row.id}
                role="listitem"
                className={cn(
                  'group relative flex items-start gap-3 border-t border-border/40 px-5 py-3 first:border-t-0',
                  rowHeight,
                  row.href && 'hover:bg-muted/40',
                  MOTION.microOut,
                )}
              >
                {row.href ? (
                  <Link
                    href={row.href}
                    className={cn(
                      'absolute inset-0 z-10 rounded-none',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                    )}
                    aria-label={row.statusLabel ? `${row.statusLabel}: ${textPreview(row.primary)}` : undefined}
                  >
                    <span className="sr-only">{textPreview(row.primary)}</span>
                  </Link>
                ) : null}

                {/*
                  Codex Gate 2 P2 fix — href 있을 때 row content가 클릭 막는 문제:
                  1. Link를 z-10으로 올림
                  2. Content wrapper는 href 있을 때 pointer-events-none로 클릭을 Link에 투과
                  3. Action 버튼만 pointer-events-auto + z-20로 클릭 살림
                */}
                <div
                  className={cn(
                    'relative flex w-full items-start gap-3',
                    row.href && 'pointer-events-none',
                  )}
                >
                  {rowContent}

                  {/* Hover-reveal inline actions */}
                  {itemActions.length > 0 ? (
                    <div
                      className={cn(
                        'flex shrink-0 items-center gap-1',
                        // 모바일: 항상 표시 (hover 불가) / 데스크톱: hover/focus에서만
                        '[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100',
                        MOTION.microOut,
                      )}
                    >
                      {itemActions.map((a) => {
                        const Icon = a.icon
                        return (
                          <button
                            key={a.label}
                            type="button"
                            onClick={a.onClick}
                            aria-label={a.label}
                            className={cn(
                              // href 있을 때 부모 pointer-events-none → 버튼만 auto로 복원
                              'pointer-events-auto relative z-20 inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground',
                              'hover:bg-muted hover:text-foreground',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                              MOTION.microOut,
                            )}
                          >
                            <Icon className="h-4 w-4" aria-hidden="true" />
                          </button>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

// ─── Helpers ────────────────────────────────────────────────

function DefaultEmpty() {
  return <p className="text-center text-xs text-muted-foreground">표시할 항목이 없습니다.</p>
}

function textPreview(node: React.ReactNode): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  return ''
}
