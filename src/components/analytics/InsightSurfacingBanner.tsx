'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — InsightSurfacingBanner
// 규칙 기반 위험 신호 상위 3개 표시, 24h dismiss, 더보기 토글
// ═══════════════════════════════════════════════════════════

import { useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ShieldAlert, Info, X, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SurfacedInsight } from '@/lib/analytics/insight-surfacing'
import { dismissInsight } from '@/lib/analytics/insight-surfacing'

// ─── Types ──────────────────────────────────────────────────

interface Props {
  insights: SurfacedInsight[]
}

// ─── Constants ──────────────────────────────────────────────

const MAX_VISIBLE = 3

const SEVERITY_STYLES = {
  CRITICAL: { bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800', icon: ShieldAlert, iconColor: 'text-red-600 dark:text-red-400' },
  HIGH: { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', icon: AlertTriangle, iconColor: 'text-amber-600 dark:text-amber-400' },
  MEDIUM: { bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800', icon: Info, iconColor: 'text-blue-600 dark:text-blue-400' },
} as const

// ─── Component ──────────────────────────────────────────────

export function InsightSurfacingBanner({ insights }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState(false)

  const visible = insights.filter((i) => !dismissed.has(i.id))
  if (visible.length === 0) return null

  const shown = expanded ? visible : visible.slice(0, MAX_VISIBLE)
  const remaining = visible.length - MAX_VISIBLE

  const handleDismiss = (id: string) => {
    dismissInsight(id)
    setDismissed((prev) => new Set(prev).add(id))
  }

  return (
    <div className="space-y-2">
      {shown.map((insight) => {
        const style = SEVERITY_STYLES[insight.severity]
        const Icon = style.icon
        return (
          <Link
            key={insight.id}
            href={insight.link}
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-lg border transition-all hover:shadow-sm group',
              style.bg,
              style.border,
            )}
          >
            <Icon className={cn('h-4 w-4 flex-shrink-0', style.iconColor)} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{insight.title}</p>
              <p className="text-xs text-muted-foreground truncate">{insight.description}</p>
            </div>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDismiss(insight.id) }}
              className="p-1 rounded-md text-muted-foreground/40 hover:text-muted-foreground hover:bg-background/50 transition-colors flex-shrink-0"
              title="24시간 숨기기"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </Link>
        )
      })}

      {remaining > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-4 py-1"
        >
          {expanded ? (
            <><ChevronUp className="h-3 w-3" /> 접기</>
          ) : (
            <><ChevronDown className="h-3 w-3" /> {remaining}건 더보기</>
          )}
        </button>
      )}
    </div>
  )
}
