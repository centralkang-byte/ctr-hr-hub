'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — PlaceholderCard
// V3 Dashboard에서 실데이터가 아직 준비되지 않은 슬롯을 명시적으로
// 표시하는 카드. dashed border + icon + "곧 출시" 문구로
// "의도된 자리표시자"임을 사용자에게 전달한다.
// ═══════════════════════════════════════════════════════════

import { useTranslations } from 'next-intl'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────

interface PlaceholderCardProps {
  title: string
  icon: LucideIcon
  description?: string
  className?: string
}

// ─── Component ──────────────────────────────────────────────

export function PlaceholderCard({
  title,
  icon: Icon,
  description,
  className,
}: PlaceholderCardProps) {
  const t = useTranslations('home')
  const desc = description ?? t('placeholder.comingSoon')

  return (
    <div
      aria-label={`${title} — ${desc}`}
      className={cn(
        'flex min-h-[160px] flex-col items-center justify-center rounded-2xl border border-dashed border-outline-variant/20 bg-muted/30 p-6 text-center',
        className,
      )}
    >
      <Icon
        className="mb-2 h-8 w-8 stroke-[1.5] text-muted-foreground/60"
        aria-hidden="true"
      />
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
    </div>
  )
}
