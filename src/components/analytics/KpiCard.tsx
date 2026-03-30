'use client'

import React from 'react'
import { TrendingUp, TrendingDown, Minus, Info, type LucideIcon } from 'lucide-react'
import { ResponsiveContainer, LineChart, Line } from 'recharts'
import { CHART_COLORS } from './chart-colors'
import { cn } from '@/lib/utils'

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
  onClick?: () => void
  variant?: 'default' | 'hero'
  className?: string
}

// ─── Component ──────────────────────────────────────────────

export function KpiCard({
  label, value, unit, change, changeLabel,
  severity = 'neutral', icon: Icon, tooltip, sparkline,
  onClick, variant = 'default', className,
}: KpiCardProps) {
  const isHero = variant === 'hero'

  // severity 배경 tint — hero에서는 무시 (gradient 충돌 방지)
  const severityBg = isHero
    ? ''
    : severity === 'positive'
      ? 'bg-tertiary-container/10'
      : severity === 'negative'
        ? 'bg-destructive/5'
        : ''

  // severity 텍스트 색상 — hero에서는 white 계열로 표현
  const changeColor = isHero
    ? 'text-white/80'
    : severity === 'positive'
      ? 'text-emerald-600'
      : severity === 'negative'
        ? 'text-destructive'
        : 'text-muted-foreground'

  const ChangeIcon = change !== undefined && change > 0 ? TrendingUp : change !== undefined && change < 0 ? TrendingDown : Minus
  const sparkColor = severity === 'positive' ? CHART_COLORS.success : severity === 'negative' ? CHART_COLORS.danger : CHART_COLORS.primary

  const Wrapper = onClick ? 'button' : 'div'

  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        // Base: No-Line Rule (border 제거), Container radius, Soft Lift hover
        'rounded-2xl p-6 transition-all text-left w-full',
        'hover:-translate-y-0.5 hover:shadow-md',
        onClick && 'cursor-pointer',
        isHero
          ? // Hero: gradient + primary-tinted shadow + white text
            'bg-gradient-to-br from-primary to-primary-dim shadow-primary-tinted text-white'
          : // Default: card bg + shadow + severity tint
            cn('bg-card shadow-sm', severityBg),
        className,
      )}
    >
      {/* Label + Icon — top-left (Asymmetric Energy) */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <span className={cn(
            'text-sm font-medium',
            isHero ? 'text-white/70' : 'text-muted-foreground',
          )}>
            {label}
          </span>
          {tooltip && (
            <div className="relative group">
              <Info className={cn(
                'h-3.5 w-3.5 cursor-help transition-colors',
                isHero ? 'text-white/40 hover:text-white/70' : 'text-muted-foreground/40 hover:text-muted-foreground',
              )} />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-popover text-popover-foreground text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none max-w-[240px] border">
                {tooltip}
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-popover" />
              </div>
            </div>
          )}
        </div>
        {Icon && <Icon className={cn('h-4 w-4', isHero ? 'text-white/60' : 'text-muted-foreground/60')} />}
      </div>

      {/* Value + Sparkline — bottom area */}
      <div className="flex items-end justify-between">
        <div>
          {/* Display Typography — hero는 반응형 3단계, default는 display-sm */}
          <div className="flex items-baseline gap-1">
            <span className={cn(
              isHero
                ? 'text-4xl md:text-5xl xl:text-display-lg font-black font-display text-white'
                : 'text-display-sm font-extrabold text-foreground',
            )}>
              {value}
            </span>
            {unit && (
              <span className={cn(
                'text-sm',
                isHero ? 'text-white/60' : 'text-muted-foreground',
              )}>
                {unit}
              </span>
            )}
          </div>

          {/* Trend chip — bottom-right 대각선 흐름 (Asymmetric Energy) */}
          {change !== undefined && (
            <div className={cn('flex items-center gap-1 mt-1.5 text-xs', changeColor)}>
              <ChangeIcon className="h-3 w-3" />
              <span>{change > 0 ? '+' : ''}{change}{unit === '%' ? 'p' : unit || ''}</span>
              {changeLabel && (
                <span className={isHero ? 'text-white/50' : 'text-muted-foreground/60'}>
                  ({changeLabel})
                </span>
              )}
            </div>
          )}
        </div>

        {sparkline && sparkline.length > 1 && (
          <div className="w-16 h-8 ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkline.map((v, i) => ({ v, i }))}>
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke={isHero ? '#ffffff' : sparkColor}
                  strokeWidth={1.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Wrapper>
  )
}
