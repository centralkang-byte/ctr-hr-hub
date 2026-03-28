'use client'

import React from 'react'
import { TrendingUp, TrendingDown, Minus, Info, type LucideIcon } from 'lucide-react'
import { ResponsiveContainer, LineChart, Line } from 'recharts'
import { CHART_COLORS } from './chart-colors'

// ─── Types ──────────────────────────────────────────────────

interface KpiCardProps {
  label: string
  value: number | string
  unit?: string
  change?: number
  changeLabel?: string
  severity?: 'positive' | 'negative' | 'neutral'
  icon?: LucideIcon
  tooltip?: string
  sparkline?: number[]
}

// ─── Component ──────────────────────────────────────────────

export function KpiCard({ label, value, unit, change, changeLabel, severity = 'neutral', icon: Icon, tooltip, sparkline }: KpiCardProps) {
  const borderColor = severity === 'positive' ? 'border-l-emerald-500' : severity === 'negative' ? 'border-l-red-500' : 'border-l-[#4F46E5]'
  const changeColor = severity === 'positive' ? 'text-emerald-600' : severity === 'negative' ? 'text-red-600' : 'text-muted-foreground'
  const ChangeIcon = change !== undefined && change > 0 ? TrendingUp : change !== undefined && change < 0 ? TrendingDown : Minus
  const sparkColor = severity === 'positive' ? CHART_COLORS.success : severity === 'negative' ? CHART_COLORS.danger : CHART_COLORS.primary

  return (
    <div className={`bg-card rounded-xl border border-border border-l-4 ${borderColor} p-5 hover:shadow-md transition-shadow`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
          {tooltip && (
            <div className="relative group">
              <Info className="h-3.5 w-3.5 text-muted-foreground/40 cursor-help hover:text-muted-foreground transition-colors" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-popover text-popover-foreground text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none max-w-[240px] border">
                {tooltip}
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-popover" />
              </div>
            </div>
          )}
        </div>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground/60" />}
      </div>
      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-foreground">{value}</span>
            {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
          </div>
          {change !== undefined && (
            <div className={`flex items-center gap-1 mt-1 text-xs ${changeColor}`}>
              <ChangeIcon className="h-3 w-3" />
              <span>{change > 0 ? '+' : ''}{change}{unit === '%' ? 'p' : unit || ''}</span>
              {changeLabel && <span className="text-muted-foreground/60">({changeLabel})</span>}
            </div>
          )}
        </div>
        {sparkline && sparkline.length > 1 && (
          <div className="w-16 h-8 ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkline.map((v, i) => ({ v, i }))}>
                <Line type="monotone" dataKey="v" stroke={sparkColor} strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
