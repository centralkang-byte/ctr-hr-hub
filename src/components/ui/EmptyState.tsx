'use client'

import { type LucideIcon, Inbox } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface EmptyStateProps {
  icon?: LucideIcon
  title?: string
  description?: string
  action?: { label: string; href?: string; onClick?: () => void }
}

export function EmptyState({ icon: Icon = Inbox, title, description, action }: EmptyStateProps) {
  const t = useTranslations('common')
  const resolvedTitle = title || t('noData')
  const resolvedDesc = description || t('noDataDesc')
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-muted-foreground/60" />
      </div>
      <h3 className="text-sm font-medium text-foreground mb-1">{resolvedTitle}</h3>
      {resolvedDesc && <p className="text-xs text-muted-foreground text-center max-w-sm">{resolvedDesc}</p>}
      {action && (
        action.href ? (
          <a href={action.href} className="mt-4 text-sm font-medium text-primary hover:text-primary/80">
            {action.label} →
          </a>
        ) : (
          <button onClick={action.onClick} className="mt-4 text-sm font-medium text-primary hover:text-primary/80">
            {action.label}
          </button>
        )
      )}
    </div>
  )
}
