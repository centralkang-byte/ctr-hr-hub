'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { CHART_THEME } from '@/lib/styles/chart'

interface TrendItem {
  month: string
  avgScore: number
  highCount: number
  mediumCount: number
  lowCount: number
}

interface AttritionTrendChartProps {
  data: TrendItem[]
}

export default function AttritionTrendChart({ data }: AttritionTrendChartProps) {
  return (
    <div className="bg-card rounded-2xl shadow-sm p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">이탈 위험 추이</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid {...CHART_THEME.grid} />
          <XAxis dataKey="month" tick={CHART_THEME.axis.tick} />
          <YAxis tick={CHART_THEME.axis.tick} />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              return (
                <div className="rounded-md border bg-card p-3 shadow-lg">
                  <p className="font-medium text-sm mb-1">{label}</p>
                  {payload.map((p) => (
                    <p key={p.name} className="text-xs" style={{ color: p.color }}>
                      {p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}
                    </p>
                  ))}
                </div>
              )
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="avgScore"
            name="평균 점수"
            stroke={CHART_THEME.colors[0]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="highCount"
            name="고위험"
            stroke={CHART_THEME.colors[4]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="mediumCount"
            name="주의"
            stroke={CHART_THEME.colors[3]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
