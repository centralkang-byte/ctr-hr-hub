'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — SuggestCard (Wave 1 홈)
// 프로토타입 SSOT: _design-reference/page-dashboard-workday.jsx:360-384 (wd-suggest-grid)
//                  styles.css:1017-1045 (.wd-suggest — ico-pill 32px + title/sub/cta)
// 실데이터 조건이 참일 때만 렌더 (가짜 "AI 감지" 조작 금지 — Codex G1 P1-5).
// 카드 전체 = 단일 Link, 내부 CTA는 시각 요소 (중첩 <a> 금지 — Codex G1 P2-11).
// ═══════════════════════════════════════════════════════════

import Link from 'next/link'
import { ArrowRight, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MOTION } from '@/lib/styles'

// ─── Types ──────────────────────────────────────────────────

/** proto .ico-pill 틴트 — s1=wt-1(navy)·s2=wt-2(teal)·s3=wt-4(purple) */
export type SuggestTone = 'wt-1' | 'wt-2' | 'wt-4'

interface SuggestCardProps {
  icon: LucideIcon
  tone: SuggestTone
  title: string
  description: string
  /** CTA 라벨 (시각 요소 — 카드 전체가 링크) */
  cta: string
  href: string
  className?: string
}

// ─── Tone styles ────────────────────────────────────────────

const ICO_TONE: Record<SuggestTone, string> = {
  'wt-1': 'bg-wt-1/10 text-wt-1',
  'wt-2': 'bg-wt-2/10 text-wt-2',
  'wt-4': 'bg-wt-4/10 text-wt-4',
}

// ─── Component ──────────────────────────────────────────────

/**
 * 권장 작업 카드 (proto .wd-suggest).
 * 그리드 배치는 caller 담당 (`grid gap-3 sm:grid-cols-2 lg:grid-cols-3`).
 */
export function SuggestCard({
  icon: Icon,
  tone,
  title,
  description,
  cta,
  href,
  className,
}: SuggestCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        'flex h-full flex-col gap-2 rounded-xl border border-border bg-card p-4',
        'hover:border-border-strong hover:shadow-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        MOTION.microOut,
        className,
      )}
    >
      <span
        className={cn(
          'mb-1 flex h-8 w-8 items-center justify-center rounded-[10px]',
          ICO_TONE[tone],
        )}
        aria-hidden="true"
      >
        <Icon className="h-4 w-4" strokeWidth={1.8} />
      </span>
      <span className="text-sm font-semibold leading-[1.35] text-foreground">{title}</span>
      <span className="text-xs leading-[1.5] text-muted-foreground">{description}</span>
      <span className="mt-auto inline-flex items-center gap-1 pt-1 text-xs font-semibold text-primary">
        {cta}
        <ArrowRight className="h-3 w-3" aria-hidden="true" />
      </span>
    </Link>
  )
}
