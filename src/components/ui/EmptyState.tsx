'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — EmptyState (Phase 2 P1, Workday 정합)
// 출처: _design-reference ui.jsx EmptyState + .empty/.standalone/.lg/.sm
// 후방호환: 기존 icon/title/description/action props 유지.
// 추가(프로토타입 정합): sub(=description 별칭), size, standalone.
// ═══════════════════════════════════════════════════════════

import { type LucideIcon, Inbox } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────

interface EmptyStateProps {
  icon?: LucideIcon
  title?: string
  /** 보조 설명 (프로토타입 .em-sub). description 별칭 우선 */
  sub?: string
  /** @deprecated sub 사용 권장 — 후방호환 유지 */
  description?: string
  action?: { label: string; href?: string; onClick?: () => void }
  /** sm=p-6 / md=p-8(기본) / lg=p-10 (프로토타입 .empty.sm/.lg) */
  size?: 'sm' | 'md' | 'lg'
  /** 카드 밖 단독 사용 시 배경·테두리 부여 (프로토타입 .empty.standalone) */
  standalone?: boolean
  className?: string
}

// ─── Constants ──────────────────────────────────────────────

const SIZE_PAD: Record<NonNullable<EmptyStateProps['size']>, string> = {
  sm: 'p-6',
  md: 'p-8',
  lg: 'p-10',
}

// ─── Component ──────────────────────────────────────────────

export function EmptyState({
  icon: Icon = Inbox,
  title,
  sub,
  description,
  action,
  size = 'md',
  standalone = false,
  className,
}: EmptyStateProps) {
  const t = useTranslations('common')
  const resolvedTitle = title || t('noData')
  const resolvedSub = sub ?? description ?? t('noDataDesc')

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 text-center',
        SIZE_PAD[size],
        standalone && 'rounded-2xl border border-border/15 bg-card',
        className,
      )}
    >
      <Icon className="h-10 w-10 text-muted-foreground/60" strokeWidth={1.5} aria-hidden="true" />
      <h3 className="mt-1 text-sm text-muted-foreground">{resolvedTitle}</h3>
      {resolvedSub ? (
        <p className="max-w-[380px] text-xs leading-relaxed text-muted-foreground/80">
          {resolvedSub}
        </p>
      ) : null}
      {action ? (
        <div className="mt-3 flex gap-2">
          {action.href ? (
            <a
              href={action.href}
              className="text-sm font-medium text-primary hover:text-primary/80"
            >
              {action.label}
            </a>
          ) : (
            <button
              type="button"
              onClick={action.onClick}
              className="text-sm font-medium text-primary hover:text-primary/80"
            >
              {action.label}
            </button>
          )}
        </div>
      ) : null}
    </div>
  )
}
