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
  default: 'border-slate-200',
  success: 'border-emerald-200',
  warning: 'border-amber-200',
  danger: 'border-red-200',
  info: 'border-blue-200',
}

const iconBgMap = {
  default: 'bg-slate-100 text-slate-600',
  success: 'bg-emerald-100 text-emerald-600',
  warning: 'bg-amber-100 text-amber-600',
  danger: 'bg-red-100 text-red-600',
  info: 'bg-blue-100 text-blue-600',
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
    <div className={cn('rounded-xl border bg-white p-5 shadow-sm', colorMap[color])}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">
            {value}
            {suffix && <span className="ml-1 text-base font-normal text-slate-400">{suffix}</span>}
          </p>
          {change && (
            <p
              className={cn(
                'mt-1 text-xs font-medium',
                change.value > 0 ? 'text-emerald-600' : change.value < 0 ? 'text-red-600' : 'text-slate-500',
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
