'use client'

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

interface Factor {
  factor: string
  weight: number
  value: number
  description: string
}

interface AttritionRadarChartProps {
  factors: Factor[]
}

const FACTOR_LABELS: Record<string, string> = {
  TENURE: '근속',
  COMPENSATION: '보상',
  PERFORMANCE: '성과',
  MANAGER: '매니저',
  ENGAGEMENT: '참여',
  ATTENDANCE: '근태',
}

export default function AttritionRadarChart({ factors }: AttritionRadarChartProps) {
  const data = factors.map((f) => ({
    subject: FACTOR_LABELS[f.factor] ?? f.description,
    score: f.value,
    weight: f.weight * 100,
    fullMark: 100,
  }))

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
          <PolarGrid stroke="#E2E8F0" />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fill: '#64748B' }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
          <Radar
            name="위험 점수"
            dataKey="score"
            stroke="#EF4444"
            fill="#EF4444"
            fillOpacity={0.2}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0].payload
              return (
                <div className="rounded-md border bg-white p-3 shadow-lg">
                  <p className="font-medium text-sm">{d.subject}</p>
                  <p className="text-xs text-slate-500">점수: {d.score}/100</p>
                  <p className="text-xs text-slate-400">가중치: {d.weight}%</p>
                </div>
              )
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
