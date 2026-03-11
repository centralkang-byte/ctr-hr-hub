'use client'

import { type LucideIcon, Inbox } from 'lucide-react'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: { label: string; href?: string; onClick?: () => void }
}

export function EmptyState({ icon: Icon = Inbox, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-gray-400" />
      </div>
      <h3 className="text-sm font-medium text-gray-900 mb-1">{title}</h3>
      {description && <p className="text-xs text-gray-500 text-center max-w-sm">{description}</p>}
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
