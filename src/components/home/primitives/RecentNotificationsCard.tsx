'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — RecentNotificationsCard (Wave 1 홈)
// 프로토타입 SSOT: _design-reference/page-dashboard-workday.jsx:386-423 (활동 피드)
//                  styles.css:1062-1094 (.wd-inbox-card — unread dot=wd-orange)
// 데이터 = /api/v1/notifications (본인 알림 inbox preview) — "활동 피드" 아님
// (Codex G1 P1-3: per-user 알림이므로 명명은 "최근 알림", 헤더 Bell 중복은 의도적 수용)
// 독립 3-상태: loading skeleton / error+재시도 / empty (Codex G1 P1-4)
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ELEVATION, MOTION, TYPOGRAPHY } from '@/lib/styles'
import { apiClient } from '@/lib/api'

// ─── Types ──────────────────────────────────────────────────

interface NotificationRow {
  id: string
  title: string
  isRead: boolean
  link: string | null
  createdAt: string
}

interface RecentNotificationsCardProps {
  heading: string
  viewAllHref: string
  viewAllLabel: string
  emptyLabel: string
  errorLabel: string
  retryLabel: string
  /** 읽지 않음 dot의 sr 라벨 */
  unreadLabel: string
  /** createdAt ISO → 표시 문자열 (caller가 locale 적용) */
  dateFormatter: (iso: string) => string
  className?: string
}

const LIMIT = 5

// ─── Component ──────────────────────────────────────────────

/**
 * 최근 알림 카드 (notification inbox preview).
 * 자체 fetch — 홈 summary 실패와 독립적으로 동작.
 */
export function RecentNotificationsCard({
  heading,
  viewAllHref,
  viewAllLabel,
  emptyLabel,
  errorLabel,
  retryLabel,
  unreadLabel,
  dateFormatter,
  className,
}: RecentNotificationsCardProps) {
  const [rows, setRows] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchRows = useCallback(async () => {
    setError(false)
    setLoading(true)
    try {
      const res = await apiClient.getList<NotificationRow>('/api/v1/notifications', {
        page: 1,
        limit: LIMIT,
      })
      setRows(res.data)
    } catch {
      // 표시 실패는 카드 내 inline error + 재시도로 전달 (토스트 중복 회피 — 홈 핵심 데이터 아님)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchRows()
  }, [fetchRows])

  const headingId = 'recent-notifications-heading'

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        'flex flex-col rounded-2xl border border-border bg-card',
        ELEVATION.xs,
        className,
      )}
    >
      <header className="flex items-center justify-between px-5 pb-3 pt-5">
        <h3 id={headingId} className="text-sm font-semibold text-foreground">
          {heading}
        </h3>
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
      </header>

      {loading ? (
        <div className="flex flex-col gap-2 px-5 pb-5" aria-busy="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-2 px-5 pb-6 pt-2" role="alert">
          <p className="text-xs text-muted-foreground">{errorLabel}</p>
          <button
            type="button"
            onClick={() => void fetchRows()}
            className={cn(
              'inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium text-foreground',
              'hover:border-border-strong hover:bg-muted/40',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              MOTION.microOut,
            )}
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            {retryLabel}
          </button>
        </div>
      ) : rows.length === 0 ? (
        <p className="px-5 pb-6 pt-2 text-center text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div role="list" className="flex flex-col">
          {rows.map((row) => (
            <div
              key={row.id}
              role="listitem"
              className={cn(
                'relative flex min-h-[48px] items-center gap-3 border-t border-border px-5 py-3 first:border-t-0',
                'hover:bg-muted/40',
                MOTION.microOut,
              )}
            >
              <Link
                href={row.link ?? viewAllHref}
                className="absolute inset-0 z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <span className="sr-only">{row.title}</span>
              </Link>

              {/* unread dot — proto .row.unread .stat = wd-orange */}
              <span
                className={cn(
                  'h-2 w-2 shrink-0 rounded-full',
                  row.isRead ? 'bg-transparent' : 'bg-wd-orange',
                )}
                aria-hidden={row.isRead}
                {...(!row.isRead ? { role: 'img' as const, 'aria-label': unreadLabel } : {})}
              />

              <p
                className={cn(
                  TYPOGRAPHY.listPrimary,
                  'min-w-0 flex-1 truncate',
                  !row.isRead && 'font-semibold',
                )}
              >
                {row.title}
              </p>

              <span className="shrink-0 text-[11.5px] tabular-nums text-muted-foreground/70">
                {dateFormatter(row.createdAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
