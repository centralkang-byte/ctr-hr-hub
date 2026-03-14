'use client'

import React from 'react'
import { TrendingUp, TrendingDown, Minus, Info, type LucideIcon } from 'lucide-react'

interface KpiCardProps {
  label: string
  value: number | string
  unit?: string
  change?: number
  changeLabel?: string
  severity?: 'positive' | 'negative' | 'neutral'
  icon?: LucideIcon
  tooltip?: string
}

export function KpiCard({ label, value, unit, change, changeLabel, severity = 'neutral', icon: Icon, tooltip }: KpiCardProps) {
  const borderColor = severity === 'positive' ? 'border-l-emerald-500' : severity === 'negative' ? 'border-l-red-500' : 'border-l-[#5E81F4]'
  const changeColor = severity === 'positive' ? 'text-emerald-600' : severity === 'negative' ? 'text-red-600' : 'text-gray-500'
  const ChangeIcon = change !== undefined && change > 0 ? TrendingUp : change !== undefined && change < 0 ? TrendingDown : Minus

  return (
    <div className={`bg-white rounded-xl border border-gray-100 border-l-4 ${borderColor} p-5 hover:shadow-md transition-shadow`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-gray-500">{label}</span>
          {tooltip && (
            <div className="relative group">
              <Info className="h-3.5 w-3.5 text-gray-300 cursor-help hover:text-gray-500 transition-colors" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none max-w-[240px]">
                {tooltip}
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800" />
              </div>
            </div>
          )}
        </div>
        {Icon && <Icon className="h-4 w-4 text-gray-400" />}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-gray-900">{value}</span>
        {unit && <span className="text-sm text-gray-500">{unit}</span>}
      </div>
      {change !== undefined && (
        <div className={`flex items-center gap-1 mt-2 text-xs ${changeColor}`}>
          <ChangeIcon className="h-3 w-3" />
          <span>{change > 0 ? '+' : ''}{change}{unit === '%' ? 'p' : unit || ''}</span>
          {changeLabel && <span className="text-gray-400">({changeLabel})</span>}
        </div>
      )}
    </div>
  )
}
