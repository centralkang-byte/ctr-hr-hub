'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — WdStatusHeatGrid (Phase 3a Stage4 PR-2)
// N일 근태 상태 히트 그리드 + 범례. 근태 AT-004 소비.
// 색 = status.ts STATUS_FG SSOT (이산 상태 의미색 — chart.ts 미경유,
// HEATMAP_COLORS=연속 스펙트럼이라 5 이산 상태에 부적합).
// ATT_STATUS_TONE = 컴포넌트-로컬(status.ts 무변경, N3 확인).
// 출처: _design-reference page-my-space.jsx 최근 30일 근무.
// ═══════════════════════════════════════════════════════════

import type { ReactNode } from 'react'
import { STATUS_FG, type StatusCategory } from '@/lib/styles/status'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────

// 프로토 5 의미상태 + 6번째 'off'(주말/공휴일 neutral track, page-my-space.jsx
// var(--bg-sunk)). 'off'/null 은 status.ts 미경유 — 컴포넌트-로컬 neutral.
export type AttStatusKey = 'present' | 'late' | 'absent' | 'leave' | 'overtime' | 'off'

/** 색 매핑 대상 = 5 의미상태만 (status.ts SSOT). 'off' 제외 */
type AttSemanticKey = Exclude<AttStatusKey, 'off'>

export interface WdHeatCell {
  date: string
  /** 'off'/null = 무기록·휴무 → neutral track (status.ts 미경유) */
  status: AttStatusKey | null
}

interface WdStatusHeatGridProps {
  title: string
  subtitle?: string
  cells: WdHeatCell[]
  legend?: boolean
  emptyState?: ReactNode
  className?: string
}

// ─── Constants ──────────────────────────────────────────────
// AttStatusKey → status.ts StatusCategory (N3: STATUS_FG 6카테고리 전수 존재)

const ATT_STATUS_TONE: Record<AttSemanticKey, StatusCategory> = {
  present: 'success',
  late: 'warning',
  absent: 'error',
  leave: 'info',
  overtime: 'accent',
}

const LEGEND_LABEL: Record<AttSemanticKey, string> = {
  present: '정상',
  late: '지각',
  absent: '결근',
  leave: '휴가',
  overtime: '초과근무',
}

// 프로토 범례 = 5 의미상태 ('off'/null 은 neutral track, 범례 비표시 — 프로토 충실)
const LEGEND_ORDER: AttSemanticKey[] = ['present', 'late', 'absent', 'leave', 'overtime']

// ─── Helpers ────────────────────────────────────────────────

function cellColor(status: AttStatusKey | null): string | undefined {
  if (!status || status === 'off') return undefined // neutral track = bg-muted
  return STATUS_FG[ATT_STATUS_TONE[status]]
}

/** 'YYYY-MM-DD' → 일(N) 숫자 (프로토 title="{N}일") */
function dayOf(date: string): string {
  const d = date.slice(8, 10)
  return d ? String(Number(d)) : date
}

function cellLabel(status: AttStatusKey | null): string | null {
  return status && status !== 'off' ? LEGEND_LABEL[status] : null
}

// ─── Component ──────────────────────────────────────────────

export function WdStatusHeatGrid({
  title,
  subtitle,
  cells,
  legend = true,
  emptyState,
  className,
}: WdStatusHeatGridProps) {
  const headingId = `wshg-${title.replace(/\s+/g, '-')}`
  const hasData = cells.some((c) => c.status !== null)

  return (
    <section
      aria-labelledby={headingId}
      className={cn('rounded-2xl border border-border bg-card p-6', className)}
    >
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <h3 id={headingId} className="text-base font-bold tracking-[-0.02em] text-foreground">
          {title}
        </h3>
        {subtitle ? <span className="text-xs text-muted-foreground">{subtitle}</span> : null}
      </div>

      {hasData ? (
        <>
          <div
            role="list"
            aria-label={title}
            className="grid grid-cols-[repeat(10,minmax(0,1fr))] gap-[5px]"
          >
            {cells.map((c) => {
              const color = cellColor(c.status)
              const label = cellLabel(c.status)
              return (
                <div
                  key={c.date}
                  role="listitem"
                  title={`${dayOf(c.date)}일${label ? ` · ${label}` : ''}`}
                  aria-label={`${c.date}${label ? ` ${label}` : ''}`}
                  className={cn(
                    'aspect-square rounded-[5px]',
                    color ? 'opacity-[0.78]' : 'bg-muted',
                  )}
                  style={color ? { backgroundColor: color } : undefined}
                />
              )
            })}
          </div>
          {legend ? (
            <div className="mt-4 flex flex-wrap gap-4">
              {LEGEND_ORDER.map((k) => (
                <span key={k} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    className="h-2.5 w-2.5 rounded-[2px] opacity-[0.78]"
                    style={{ backgroundColor: STATUS_FG[ATT_STATUS_TONE[k]] }}
                    aria-hidden="true"
                  />
                  {LEGEND_LABEL[k]}
                </span>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        emptyState ?? null
      )}
    </section>
  )
}
