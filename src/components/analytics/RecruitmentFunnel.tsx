'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Recruitment Funnel (채용 파이프라인)
// Recharts Funnel — Phase 2-A 차트 다양성
// ═══════════════════════════════════════════════════════════

import { FunnelChart, Funnel, Tooltip, Cell, LabelList } from 'recharts'
import { ResponsiveContainer } from 'recharts'
import { CHART_THEME } from '@/lib/styles/chart'
import { EmptyChart } from './EmptyChart'
import type { RecruitmentFunnelStage } from '@/lib/analytics/types'

// ─── Types ──────────────────────────────────────────────────

interface RecruitmentFunnelProps {
  data: RecruitmentFunnelStage[]
}

// ─── Component ──────────────────────────────────────────────

export function RecruitmentFunnel({ data }: RecruitmentFunnelProps) {
  if (!data || data.length === 0) return <EmptyChart />

  const funnelData = data.map((d, i) => ({
    name: d.stage,
    value: d.count,
    conversionRate: d.conversionRate,
    fill: CHART_THEME.colors[i % CHART_THEME.colors.length],
  }))

  return (
    <div className="space-y-2">
      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <FunnelChart>
            <Tooltip
              contentStyle={{ borderRadius: 8, fontSize: 12 }}
              formatter={(value, name) => [`${value}명`, name]}
            />
            <Funnel dataKey="value" data={funnelData} isAnimationActive>
              {funnelData.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
              <LabelList
                position="center"
                fontSize={11}
                fontWeight={600}
                fill="#fff"
                formatter={(value) => `${value ?? ''}명`}
              />
            </Funnel>
          </FunnelChart>
        </ResponsiveContainer>
      </div>

      {/* 단계별 전환율 */}
      <div className="flex flex-wrap gap-2 justify-center">
        {data.map((stage, i) => (
          <div key={stage.stage} className="flex items-center gap-1 text-xs">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: CHART_THEME.colors[i % CHART_THEME.colors.length] }} />
            <span className="text-muted-foreground">{stage.stage}</span>
            <span className="font-medium">{stage.count}명</span>
            {stage.conversionRate !== undefined && i > 0 && (
              <span className="text-muted-foreground/60">({stage.conversionRate}%)</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
