'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — WdStatusChips (Phase 2 P1, Workday 시그니처)
// 인라인 상태 칩 행. 출처: _design-reference .wd-status-chips / .sc
// DESIGN_RULES.md §3 패턴 B — 2~4개 단순 카운트/상태를 헤더에 가볍게 표시.
// ═══════════════════════════════════════════════════════════

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────

type WdChipTone = 'default' | 'accent' | 'warn' | 'danger' | 'success'

interface WdChipItem {
  /** 칩 라벨 */
  label: string
  /** 굵게 강조될 수치/값 — 선택 (tnum) */
  value?: ReactNode
  /** semantic 톤 */
  tone?: WdChipTone
  /** 0건/비활성 → 자동 약화(opacity). 프로토타입 .sc.zero */
  muted?: boolean
}

interface WdStatusChipsProps {
  items: WdChipItem[]
  /** 행 전체 의미 (스크린리더) */
  'aria-label'?: string
  className?: string
}

// ─── Tone styles ────────────────────────────────────────────
// 신규 hex 0 — Phase 1 토큰 + 하우스 D17값(StatCard/WdStatStrip 선례) 재사용.

const TONE_CHIP: Record<WdChipTone, string> = {
  default: 'bg-muted text-muted-foreground',
  accent: 'bg-primary-container/40 text-primary',
  warn: 'bg-wd-orange-soft text-wd-orange-ink',
  danger: 'bg-alert-red/10 text-destructive',
  success: 'bg-tertiary/10 text-[#006b39]',
}

const TONE_DOT: Record<WdChipTone, string> = {
  default: 'bg-muted-foreground/40',
  accent: 'bg-primary',
  warn: 'bg-wd-orange',
  danger: 'bg-destructive',
  success: 'bg-tertiary',
}

// ─── Component ──────────────────────────────────────────────

/**
 * Workday 인라인 상태 칩 행. 각 칩 = dot + 라벨 (+ 굵은 수치).
 * pill shape, 12px, flex-wrap. tone별 bg/text/dot, muted=opacity 약화.
 */
export function WdStatusChips({ items, className, ...rest }: WdStatusChipsProps) {
  return (
    <div
      role="list"
      aria-label={rest['aria-label']}
      className={cn('flex flex-wrap items-center gap-1.5', className)}
    >
      {items.map((it, i) => {
        const tone = it.tone ?? 'default'
        return (
          <span
            key={`${it.label}-${i}`}
            role="listitem"
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full py-1 pl-2 pr-2.5 text-xs font-medium',
              TONE_CHIP[tone],
              it.muted && 'opacity-[.55]',
            )}
          >
            <span
              className={cn('h-1.5 w-1.5 shrink-0 rounded-full', TONE_DOT[tone])}
              aria-hidden="true"
            />
            <span>{it.label}</span>
            {it.value != null ? (
              <b className="font-bold tabular-nums">{it.value}</b>
            ) : null}
          </span>
        )
      })}
    </div>
  )
}
