'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — WdStatStrip (Phase 2 P1, Workday 시그니처)
// 4-card KPI 스트립. 출처: _design-reference .wd-stat-strip / .ss-card
// DESIGN_RULES.md §3 패턴 A — 실수치 4개가 모두 운영 핵심인 페이지에서만 사용.
// ═══════════════════════════════════════════════════════════

import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { TYPOGRAPHY, MOTION } from '@/lib/styles'

// ─── Types ──────────────────────────────────────────────────

type WdStatTone = 'default' | 'info' | 'success' | 'warning' | 'danger'

interface WdStatItem {
  /** 헤더 라벨 (i18n 렌더 결과 문자열) */
  label: string
  /** 메인 수치 — 호출부에서 포맷·i18n 완료된 값 */
  value: string | number
  /** 값 뒤 단위 (예: %, 일, 명) — 선택 */
  unit?: string
  /** 헤더 아이콘 (lucide) — 선택 */
  icon?: LucideIcon
  /** 풋터 보조 문구 (예: "12 / 30일", "5건 처리 필요") — 선택 */
  foot?: ReactNode
  /** semantic 톤 — 값/아이콘 색. 동적 톤은 호출부에서 결정 */
  tone?: WdStatTone
}

interface WdStatStripProps {
  /** 카드 항목 — DESIGN_RULES.md §3: 정확히 4개 권장 */
  items: WdStatItem[]
  className?: string
}

// ─── Tone styles ────────────────────────────────────────────
// 신규 hex 도입 없음 — Phase 1 토큰 + 하우스 D17 값(StatCard 선례) 재사용.

const TONE_VALUE: Record<WdStatTone, string> = {
  default: 'text-foreground',
  info: 'text-foreground',
  success: 'text-foreground',
  warning: 'text-ctr-warning',
  danger: 'text-destructive',
}

const TONE_ICON: Record<WdStatTone, string> = {
  default: 'text-muted-foreground',
  info: 'text-primary',
  success: 'text-[#006b39]',
  warning: 'text-wd-orange',
  danger: 'text-destructive',
}

// ─── Component ──────────────────────────────────────────────

/**
 * Workday 4-card KPI 스트립. 카드별 헤더(아이콘+라벨) / 큰 수치(+단위) / 풋터.
 * a11y: 각 카드 section + aria-labelledby (StatCard 패턴 일관).
 * 숫자는 font-mono tabular-nums (DESIGN.md 숫자 규칙).
 */
export function WdStatStrip({ items, className }: WdStatStripProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4',
        className,
      )}
    >
      {items.map((it, i) => {
        const tone = it.tone ?? 'default'
        const Icon = it.icon
        const labelId = `wdstat-${i}-${it.label.replace(/\s+/g, '-')}`
        return (
          <section
            key={labelId}
            aria-labelledby={labelId}
            className={cn(
              'flex flex-col gap-2.5 rounded-2xl border border-border bg-card p-5',
              'hover:border-border-strong hover:shadow-sm',
              MOTION.microOut,
            )}
          >
            <div className="flex items-center gap-2">
              {Icon ? (
                <Icon
                  className={cn('h-4 w-4 shrink-0', TONE_ICON[tone])}
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
              ) : null}
              <h3 id={labelId} className={TYPOGRAPHY.statLabel}>
                {it.label}
              </h3>
            </div>

            {/* Wave 0: proto .ss-val = Pretendard 500 + tnum (mono 아님) */}
            <p className={cn(TYPOGRAPHY.displaySm, 'flex items-baseline gap-1 tabular-nums', TONE_VALUE[tone])}>
              {it.value}
              {it.unit ? (
                <span className="text-sm font-medium text-muted-foreground">{it.unit}</span>
              ) : null}
            </p>

            {it.foot ? (
              <p className="text-xs text-muted-foreground">{it.foot}</p>
            ) : null}
          </section>
        )
      })}
    </div>
  )
}
