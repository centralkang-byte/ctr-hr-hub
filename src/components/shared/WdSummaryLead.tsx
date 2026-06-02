'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — WdSummaryLead (Phase 2 P1, Workday 시그니처)
// 한 줄 서술형 요약 + 인라인 하이라이트 강조.
// 출처: _design-reference .wd-summary-lead (b / .hl-danger / .hl-warn)
// DESIGN_RULES.md §3 패턴 C — 사이클·진행 상황을 자연어로 설명.
// ═══════════════════════════════════════════════════════════

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────

type WdLeadTone = 'strong' | 'danger' | 'warn'

interface WdSummaryLeadProps {
  children: ReactNode
  className?: string
}

interface WdLeadProps {
  /** strong=수치 강조(중립) / danger=위험 / warn=주의 */
  tone?: WdLeadTone
  children: ReactNode
}

// ─── Tone styles ────────────────────────────────────────────
// 신규 hex 0 — foreground/destructive/wd-orange-ink(Phase1) 토큰만.

const LEAD_TONE: Record<WdLeadTone, string> = {
  strong: 'font-semibold text-foreground tabular-nums',
  danger: 'font-bold text-destructive tabular-nums',
  warn: 'font-bold text-wd-orange-ink tabular-nums',
}

// ─── Component ──────────────────────────────────────────────

/** 인라인 강조 토큰. 서술 문장 안에서 수치/상태를 강조. */
export function WdLead({ tone = 'strong', children }: WdLeadProps) {
  return <b className={LEAD_TONE[tone]}>{children}</b>
}

/**
 * Workday 요약 문장형 리드. 14px·leading-relaxed·fg-muted·max-w-[720px].
 * 진행 상태를 한 문장으로 서술하고 <WdLead>로 핵심 수치/상태를 강조.
 */
export function WdSummaryLead({ children, className }: WdSummaryLeadProps) {
  return (
    <p
      className={cn(
        'max-w-[720px] text-sm leading-relaxed tracking-[-0.005em] text-muted-foreground',
        className,
      )}
    >
      {children}
    </p>
  )
}
