'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — WdUsageBarChart (Phase 3a Stage4 PR-2, chart.ts 1-shot)
// 단일 시리즈 월별 사용 막대 + 인사이트 슬롯. 휴가 LV-002 소비.
// 색 = chart.ts CHART_THEME SSOT (카테고리 idx0 + axis/grid/tooltip).
// 출처: _design-reference page-my-space.jsx 월별 사용 패턴.
// ═══════════════════════════════════════════════════════════

import type { ReactNode } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from 'recharts'
import { CHART_THEME } from '@/lib/styles/chart'

// ─── Types ──────────────────────────────────────────────────

export interface WdUsageBarDatum {
  label: string
  value: number
}

interface WdUsageBarChartProps {
  title: string
  subtitle?: string
  data: WdUsageBarDatum[]
  /** 값 단위 (LV-002 = "건" — F3 가디언 m0008, 건수 기준) */
  unit?: string
  /** 인사이트 서술 슬롯 (프로토타입 인사이트 박스) */
  insight?: ReactNode
  emptyState?: ReactNode
  className?: string
}

// ─── Component ──────────────────────────────────────────────

export function WdUsageBarChart({
  title,
  subtitle,
  data,
  unit,
  insight,
  emptyState,
  className,
}: WdUsageBarChartProps) {
  const headingId = `wubc-${title.replace(/\s+/g, '-')}`
  const hasData = data.some((d) => d.value > 0)

  return (
    <section
      aria-labelledby={headingId}
      className={`rounded-2xl border border-border bg-card p-6 ${className ?? ''}`}
    >
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <h3 id={headingId} className="text-base font-bold tracking-[-0.02em] text-foreground">
          {title}
        </h3>
        {subtitle ? <span className="text-xs text-muted-foreground">{subtitle}</span> : null}
      </div>

      {hasData ? (
        <>
          <ResponsiveContainer width="100%" height={CHART_THEME.responsive.height}>
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid
                stroke={CHART_THEME.grid.stroke}
                strokeDasharray={CHART_THEME.grid.strokeDasharray}
                vertical={false}
              />
              <XAxis
                dataKey="label"
                stroke={CHART_THEME.axis.stroke}
                tick={CHART_THEME.axis.tick}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                allowDecimals={false}
                stroke={CHART_THEME.axis.stroke}
                tick={CHART_THEME.axis.tick}
                tickLine={false}
                axisLine={false}
                width={28}
              />
              <Tooltip
                contentStyle={CHART_THEME.tooltip.contentStyle}
                labelStyle={CHART_THEME.tooltip.labelStyle}
                cursor={{ fill: CHART_THEME.grid.stroke }}
                formatter={(v) => `${v}${unit ?? ''}`}
              />
              <Bar
                dataKey="value"
                fill={CHART_THEME.colors[0]}
                radius={[3, 3, 0, 0]}
                maxBarSize={48}
              >
                <LabelList
                  dataKey="value"
                  position="top"
                  className="fill-muted-foreground [font-family:var(--font-mono)] tabular-nums"
                  fontSize={11}
                  fontWeight={600}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {insight ? (
            <div className="mt-3 rounded-lg bg-muted/50 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
              {insight}
            </div>
          ) : null}
        </>
      ) : (
        emptyState ?? null
      )}
    </section>
  )
}
