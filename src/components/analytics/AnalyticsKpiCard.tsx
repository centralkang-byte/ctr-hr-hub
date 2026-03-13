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
  default: 'border-[#E8E8E8]',
  success: 'border-[#A7F3D0]',
  warning: 'border-[#FCD34D]',
  danger: 'border-[#FECACA]',
  info: 'border-[#EEF2FF]',
}

const iconBgMap = {
  default: 'bg-[#F5F5F5] text-[#555]',
  success: 'bg-[#D1FAE5] text-[#059669]',
  warning: 'bg-[#FEF3C7] text-[#D97706]',
  danger: 'bg-[#FEE2E2] text-[#DC2626]',
  info: 'bg-[#EEF2FF] text-[#4F46E5]',
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
    <div className={cn('rounded-xl border bg-white p-5', colorMap[color])}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-[#666]">{label}</p>
          <p className="mt-1 text-3xl font-bold text-[#1A1A1A]">
            {value}
            {suffix && <span className="ml-1 text-base font-normal text-[#999]">{suffix}</span>}
          </p>
          {change && (
            <p
              className={cn(
                'mt-1 text-xs font-medium',
                change.value > 0 ? 'text-[#059669]' : change.value < 0 ? 'text-[#DC2626]' : 'text-[#666]',
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
