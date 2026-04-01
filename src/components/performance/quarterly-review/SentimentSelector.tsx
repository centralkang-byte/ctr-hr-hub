'use client'

import { cn } from '@/lib/utils'
import { Smile, MinusCircle, AlertTriangle } from 'lucide-react'
import { useTranslations } from 'next-intl'

// ─── Types ──────────────────────────────────────────────────

type SentimentType = 'POSITIVE' | 'NEUTRAL' | 'CONCERN'

interface Props {
  value: SentimentType | null
  onChange: (value: SentimentType) => void
  disabled?: boolean
}

// ─── Constants ──────────────────────────────────────────────

const OPTIONS: { value: SentimentType; icon: typeof Smile; style: string; activeStyle: string }[] = [
  {
    value: 'POSITIVE',
    icon: Smile,
    style: 'text-emerald-600',
    activeStyle: 'bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/30',
  },
  {
    value: 'NEUTRAL',
    icon: MinusCircle,
    style: 'text-amber-600',
    activeStyle: 'bg-amber-500/15 text-amber-700 ring-1 ring-amber-500/30',
  },
  {
    value: 'CONCERN',
    icon: AlertTriangle,
    style: 'text-red-600',
    activeStyle: 'bg-red-500/15 text-red-700 ring-1 ring-red-500/30',
  },
]

// ─── Component ──────────────────────────────────────────────

export default function SentimentSelector({ value, onChange, disabled }: Props) {
  const t = useTranslations('performance.quarterlyReview.sentiment')

  return (
    <div className="flex gap-2">
      {OPTIONS.map((opt) => {
        const Icon = opt.icon
        const isActive = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
              isActive ? opt.activeStyle : 'bg-muted/50 text-muted-foreground hover:bg-muted',
              disabled && 'opacity-50 cursor-not-allowed',
            )}
          >
            <Icon className="h-4 w-4" />
            {t(opt.value)}
          </button>
        )
      })}
    </div>
  )
}
