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
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">이탈 위험 추이</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              return (
                <div className="rounded-md border bg-white p-3 shadow-lg">
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
            stroke="#6366F1"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="highCount"
            name="고위험"
            stroke="#EF4444"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="mediumCount"
            name="주의"
            stroke="#F59E0B"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
