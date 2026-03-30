'use client'

import React, { useState } from 'react'
import { RefreshCw, Maximize2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────

interface ChartCardProps {
  title: string
  children: React.ReactNode
  loading?: boolean
  error?: string
  onRetry?: () => void
  className?: string
  badge?: string
  badgeColor?: string
  expandable?: boolean
}

// ─── Component ──────────────────────────────────────────────

export function ChartCard({
  title, children, loading, error, onRetry,
  className = '', badge, badgeColor = 'bg-destructive/10 text-destructive',
  expandable = true,
}: ChartCardProps) {
  const [expanded, setExpanded] = useState(false)

  const content = (
    <>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <div className="flex items-center gap-2">
          {badge && (
            <span className={cn('text-xs px-2.5 py-0.5 rounded-full font-medium', badgeColor)}>{badge}</span>
          )}
          {expandable && !loading && !error && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1 rounded-lg text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted transition-colors"
              title={expanded ? '축소' : '확대'}
            >
              {expanded ? <X className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-pulse h-32 w-full bg-muted rounded-lg" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-48 gap-2">
          <p className="text-sm text-muted-foreground">데이터를 불러올 수 없습니다</p>
          {onRetry && (
            <button onClick={onRetry} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
              <RefreshCw className="h-3 w-3" /> 다시 시도
            </button>
          )}
        </div>
      ) : (
        children
      )}
    </>
  )

  // 전체화면 Dialog
  if (expanded) {
    return (
      <>
        {/* 원래 위치 placeholder */}
        <div className={cn('bg-card rounded-2xl shadow-sm p-6', className)}>
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            <button
              onClick={() => setExpanded(false)}
              className="p-1 rounded-lg text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted transition-colors"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            확대 모드로 표시 중
          </div>
        </div>
        {/* 오버레이 */}
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" onClick={() => setExpanded(false)} />
        <div className="fixed inset-4 z-50 bg-card rounded-2xl shadow-2xl p-8 overflow-auto">
          {content}
        </div>
      </>
    )
  }

  return (
    <div className={cn(
      'bg-card rounded-2xl shadow-sm p-6 transition-all hover:shadow-md hover:-translate-y-0.5',
      className,
    )}>
      {content}
    </div>
  )
}
