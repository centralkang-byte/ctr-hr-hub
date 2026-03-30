/**
 * CRITICAL: BadgeVariant is SEMANTIC ('success', 'warning', etc.).
 * DB enums → badge mapping should happen in page/component code via a MAPPER.
 */
type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'muted'

const BADGE_STYLES: Record<BadgeVariant, string> = {
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-rose-50 text-rose-700',
  info: 'bg-primary/5 text-primary',
  neutral: 'bg-muted text-foreground',
  muted: 'bg-muted/50 text-muted-foreground',
}

interface StatusBadgeProps {
  variant: BadgeVariant
  children: React.ReactNode
  className?: string
}

export function StatusBadge({ variant, children, className = '' }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${BADGE_STYLES[variant]} ${className}`}>
      {children}
    </span>
  )
}

export type { BadgeVariant }
