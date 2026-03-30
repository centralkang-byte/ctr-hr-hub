'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Analytics KPI Card
// 값 + 변화량 + 아이콘 + 스파크라인
// ═══════════════════════════════════════════════════════════

import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AnalyticsKpiCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  change?: { value: number; label?: string }
  color?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  suffix?: string
}

const colorMap = {
  default: 'border-border',
  success: 'border-emerald-200',
  warning: 'border-amber-300',
  danger: 'border-destructive/20',
  info: 'border-primary/20',
}

const iconBgMap = {
  default: 'bg-muted text-[#555]',
  success: 'bg-emerald-100 text-emerald-600',
  warning: 'bg-amber-100 text-amber-600',
  danger: 'bg-destructive/10 text-destructive',
  info: 'bg-primary/10 text-primary',
}

export function AnalyticsKpiCard({
  label,
  value,
  icon: Icon,
  change,
  color = 'default',
  suffix,
}: AnalyticsKpiCardProps) {
  return (
    <div className={cn('rounded-xl border bg-card p-5', colorMap[color])}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-[#666]">{label}</p>
          <p className="mt-1 text-3xl font-bold text-foreground">
            {value}
            {suffix && <span className="ml-1 text-base font-normal text-[#999]">{suffix}</span>}
          </p>
          {change && (
            <p
              className={cn(
                'mt-1 text-xs font-medium',
                change.value > 0 ? 'text-emerald-600' : change.value < 0 ? 'text-destructive' : 'text-[#666]',
              )}
            >
              {change.value > 0 ? '\u2191' : change.value < 0 ? '\u2193' : ''}
              {' '}{Math.abs(change.value)}{change.label ?? ''}
            </p>
          )}
        </div>
        <div className={cn('rounded-lg p-2.5', iconBgMap[color])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}
