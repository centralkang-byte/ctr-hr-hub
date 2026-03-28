'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Org Treemap (법인별 인력 분포)
// Recharts Treemap — Phase 2-A 차트 다양성
// ═══════════════════════════════════════════════════════════

import { Treemap, ResponsiveContainer, Tooltip } from 'recharts'
import { CHART_THEME } from '@/lib/styles/chart'
import { EmptyChart } from './EmptyChart'

// ─── Types ──────────────────────────────────────────────────

interface OrgTreemapProps {
  data: { company: string; count: number; percentage: number }[]
}

interface TreemapNode {
  x: number
  y: number
  width: number
  height: number
  name: string
  size: number
  percentage: number
  fill: string
}

// ─── Custom Content ─────────────────────────────────────────

function CustomContent(props: TreemapNode) {
  const { x, y, width, height, name, size, percentage, fill } = props
  if (width < 40 || height < 30) return null

  const fontSize = width > 100 && height > 50 ? 12 : 10
  const showDetail = width > 60 && height > 40

  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} rx={4} stroke="var(--border)" strokeWidth={1} />
      <text x={x + width / 2} y={y + height / 2 - (showDetail ? 8 : 0)} textAnchor="middle" dominantBaseline="central" fontSize={fontSize} fontWeight={600} fill="#fff">
        {name}
      </text>
      {showDetail && (
        <text x={x + width / 2} y={y + height / 2 + 10} textAnchor="middle" dominantBaseline="central" fontSize={10} fill="rgba(255,255,255,0.8)">
          {size}명 ({percentage}%)
        </text>
      )}
    </g>
  )
}

// ─── Component ──────────────────────────────────────────────

export function OrgTreemap({ data }: OrgTreemapProps) {
  if (!data || data.length === 0) return <EmptyChart />

  const treemapData = data.map((d, i) => ({
    name: d.company,
    size: d.count,
    percentage: d.percentage,
    fill: CHART_THEME.colors[i % CHART_THEME.colors.length],
  }))

  return (
    // AD-3: 명시적 높이 고정 — ResponsiveContainer + Treemap 높이 0px 버그 방어
    <div className="h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <Treemap
          data={treemapData}
          dataKey="size"
          nameKey="name"
          content={<CustomContent x={0} y={0} width={0} height={0} name="" size={0} percentage={0} fill="" />}
        >
          <Tooltip
            contentStyle={{ borderRadius: 8, fontSize: 12 }}
            formatter={(value, _name, props) => [
              `${value}명 (${(props.payload as { percentage?: number })?.percentage ?? 0}%)`,
              (props.payload as { name?: string })?.name ?? '',
            ]}
          />
        </Treemap>
      </ResponsiveContainer>
    </div>
  )
}
