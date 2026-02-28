'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

interface DistributionItem {
  level: string
  count: number
  percentage: number
}

interface AttritionDonutChartProps {
  distribution: DistributionItem[]
  totalCount: number
}

const LEVEL_COLORS: Record<string, string> = {
  LOW: '#10B981',
  MEDIUM: '#F59E0B',
  HIGH: '#F97316',
  CRITICAL: '#EF4444',
}

const LEVEL_LABELS: Record<string, string> = {
  LOW: '낮음',
  MEDIUM: '주의',
  HIGH: '높음',
  CRITICAL: '위험',
}

export default function AttritionDonutChart({
  distribution,
  totalCount,
}: AttritionDonutChartProps) {
  const data = distribution.map((d) => ({
    ...d,
    label: LEVEL_LABELS[d.level] ?? d.level,
    color: LEVEL_COLORS[d.level] ?? '#94A3B8',
  }))

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">위험 분포</h3>
      <div className="flex items-center gap-6">
        <div className="relative w-48 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="count"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload as (typeof data)[0]
                  return (
                    <div className="rounded-md border bg-white p-3 shadow-lg">
                      <p className="font-medium text-sm">{d.label}</p>
                      <p className="text-xs text-slate-500">
                        {d.count}명 ({d.percentage.toFixed(1)}%)
                      </p>
                    </div>
                  )
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900">{totalCount}</p>
              <p className="text-xs text-slate-500">전체</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {data.map((d) => (
            <div key={d.level} className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: d.color }}
              />
              <span className="text-sm text-slate-700">{d.label}</span>
              <span className="text-sm font-medium text-slate-900">{d.count}명</span>
              <span className="text-xs text-slate-400">({d.percentage.toFixed(1)}%)</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
