'use client'

import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'
import { CARD_STYLES } from '@/lib/styles'

interface KpiSummaryCardProps {
  label: string
  value: string | number | null
  unit?: string
  change?: number | null
  changeLabel?: string
  status?: 'default' | 'danger' | 'warning' | 'success'
  onClick?: () => void
}

export function KpiSummaryCard({
  label,
  value,
  unit,
  change,
  changeLabel,
  status = 'default',
  onClick,
}: KpiSummaryCardProps) {
  const statusColors: Record<string, string> = {
    default: 'text-[#1A1A1A]',
    danger: 'text-[#EF4444]',
    warning: 'text-[#B45309]',
    success: 'text-[#059669]',
  }

  const displayValue = value === null || value === undefined ? '–' : value

  return (
    <div
      className={`${CARD_STYLES.kpi} ${onClick ? 'cursor-pointer hover:border-[#00C853] transition-colors' : ''}`}
      onClick={onClick}
    >
      <p className="text-xs text-[#666] mb-1">{label}</p>
      <p className={`text-3xl font-bold mb-1 ${statusColors[status]}`}>
        {displayValue}
        {unit && <span className="text-base font-normal text-[#666] ml-1">{unit}</span>}
      </p>
      {change !== null && change !== undefined && (
        <div className="flex items-center gap-1 text-xs">
          {change > 0 ? (
            <ArrowUpRight className="w-3 h-3 text-[#059669]" />
          ) : change < 0 ? (
            <ArrowDownRight className="w-3 h-3 text-[#EF4444]" />
          ) : (
            <Minus className="w-3 h-3 text-[#999]" />
          )}
          <span
            className={
              change > 0 ? 'text-[#059669]' : change < 0 ? 'text-[#EF4444]' : 'text-[#999]'
            }
          >
            {change > 0 ? '+' : ''}
            {change} {changeLabel ?? '전월 대비'}
          </span>
        </div>
      )}
    </div>
  )
}
