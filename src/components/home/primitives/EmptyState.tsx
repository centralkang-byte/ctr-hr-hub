import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ELEVATION, MOTION } from '@/lib/styles'

// ─── Types ──────────────────────────────────────────────────

interface EmptyStateAction {
  label: string
  href: string
  variant?: 'primary' | 'ghost'
}

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: EmptyStateAction
  /** success tone은 "다 끝냈어요" 같은 긍정 컨텍스트 */
  tone?: 'neutral' | 'success'
  className?: string
}

// ─── Component ──────────────────────────────────────────────

/**
 * PlaceholderCard 대체 — "동기부여형" 빈 상태.
 * 단순 회색 박스 대신 icon circle + title + 선택적 action으로 다음 행동 유도.
 * Server component.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  tone = 'neutral',
  className,
}: EmptyStateProps) {
  const iconRingClass =
    tone === 'success'
      ? 'bg-tertiary/10 text-[#15803d]'
      : 'bg-muted text-muted-foreground'

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-2xl bg-card p-10 text-center',
        ELEVATION.xs,
        className,
      )}
    >
      <div
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-full',
          iconRingClass,
        )}
      >
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description ? (
        <p className="max-w-[320px] text-xs leading-[1.5] text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? (
        <Link
          href={action.href}
          className={cn(
            'mt-2 inline-flex min-h-[44px] items-center rounded-full px-4 text-sm font-medium',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            action.variant === 'ghost'
              ? 'text-primary hover:bg-primary/5'
              : 'bg-primary text-primary-foreground hover:bg-primary/90',
            MOTION.microOut,
          )}
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  )
}
