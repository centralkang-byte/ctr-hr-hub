'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — WorkletGrid (PR-5A HR Admin 대시보드 카나리)
// 프로토타입 SSOT: _design-reference/page-dashboard-workday.jsx:247-266 (wd-worklets 섹션)
// 8 distinct colored 타일 — proto --wt-1~--wt-8 정합.
// HrAdminHomeV2 전용 — 표현 컴포넌트 (데이터는 caller에서 derive)
// ═══════════════════════════════════════════════════════════

import Link from 'next/link'
import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ELEVATION, MOTION, TYPOGRAPHY } from '@/lib/styles'

// ─── Types ──────────────────────────────────────────────────

export type WorkletTone =
  | 'primary'        // 1 employees (navy)
  | 'tertiary'       // 2 recruitment (green)
  | 'chart-2'        // 3 attendance (steel blue)
  | 'wd-orange'      // 4 leave (orange)
  | 'badge-accent'   // 5 performance (violet)
  | 'warning-bright' // 6 payroll (amber)
  | 'chart-4'        // 7 organization (slate)
  | 'info'           // 8 analytics (sky blue, PR-5A 신규 토큰)

export type WorkletInlineTone = 'danger' | 'warn' | 'neutral'

export interface WorkletInlineRow {
  tone: WorkletInlineTone
  /** dot 라벨 a11y용 짧은 텍스트 (예: "위험") */
  toneLabel?: string
  /** 표시 텍스트 (JSX 허용 — bold 강조 등) */
  text: React.ReactNode
}

export interface WorkletTile {
  id: string
  icon: LucideIcon
  tone: WorkletTone
  title: string
  subtitle: string
  href: string
  /** 우상단 배지 (옵셔널) — 미정의 시 미표시 */
  count?: number
  /** 인라인 dot 2줄 (옵셔널) */
  inline?: WorkletInlineRow[]
}

interface WorkletGridProps {
  tiles: WorkletTile[]
  className?: string
}

// ─── Tone styles ────────────────────────────────────────────

const TILE_BG: Record<WorkletTone, string> = {
  primary: 'bg-primary',
  tertiary: 'bg-tertiary',
  'chart-2': 'bg-chart-2',
  'wd-orange': 'bg-wd-orange',
  'badge-accent': 'bg-badge-accent',
  'warning-bright': 'bg-warning-bright',
  'chart-4': 'bg-chart-4',
  info: 'bg-info',
}

const DOT_BG: Record<WorkletInlineTone, string> = {
  danger: 'bg-destructive',
  warn: 'bg-warning-bright',
  neutral: 'bg-muted-foreground',
}

// ─── Component ──────────────────────────────────────────────

/**
 * 8 distinct colored worklet 타일 그리드.
 * - Mobile: 2 cols / sm: 3 cols / lg: 4 cols.
 * - 각 타일: Link wrapping article — title aria-labelledby + subtitle 보조.
 * - inline dot: 최대 2 rows, aria-label = toneLabel.
 */
export function WorkletGrid({ tiles, className }: WorkletGridProps) {
  return (
    <ul
      className={cn(
        'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4',
        className,
      )}
      role="list"
    >
      {tiles.map((tile) => {
        const Icon = tile.icon
        const titleId = `worklet-${tile.id}-title`

        return (
          <li key={tile.id} className="list-none">
            <Link
              href={tile.href}
              aria-labelledby={titleId}
              className={cn(
                'relative flex h-full flex-col gap-2 rounded-2xl bg-card p-4',
                ELEVATION.xs,
                MOTION.hoverLift,
                'hover:-translate-y-0.5 hover:shadow-md',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              )}
            >
              {/* Count badge — 우상단 */}
              {typeof tile.count === 'number' && tile.count > 0 ? (
                <span
                  className="absolute right-3 top-3 inline-flex min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-semibold text-destructive-foreground"
                  aria-label={`${tile.count}건 대기`}
                >
                  {tile.count}
                </span>
              ) : null}

              {/* Icon area 48×48 */}
              <div
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-xl text-white',
                  TILE_BG[tile.tone],
                )}
                aria-hidden="true"
              >
                <Icon className="h-6 w-6" strokeWidth={1.5} />
              </div>

              {/* Title + Subtitle */}
              <div>
                <h3 id={titleId} className={cn(TYPOGRAPHY.statLabel, 'text-sm font-semibold text-foreground')}>
                  {tile.title}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">{tile.subtitle}</p>
              </div>

              {/* Inline rows */}
              {tile.inline && tile.inline.length > 0 ? (
                <div className="mt-1 flex flex-col gap-1">
                  {tile.inline.slice(0, 2).map((row, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
                    >
                      <span
                        className={cn('h-1.5 w-1.5 shrink-0 rounded-full', DOT_BG[row.tone])}
                        aria-hidden="true"
                      />
                      {row.toneLabel ? (
                        <span className="sr-only">{row.toneLabel}</span>
                      ) : null}
                      <span className="truncate">{row.text}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
