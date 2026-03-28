'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 법인 비교 레이더 차트 (Phase 2-B1)
// 0-100 정규화 백분위 + Custom Tooltip 실제값 표시
// 5개 법인 제한 (그 이상은 EmptyState)
// ═══════════════════════════════════════════════════════════

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { AlertCircle } from 'lucide-react'
import { CHART_THEME } from '@/lib/styles/chart'
import type { CompareKpiKey } from '@/lib/analytics/types'

// ─── Types ──────────────────────────────────────────────────

interface CompanyData {
  companyId: string
  company: string // code
  name: string
  values: Partial<Record<CompareKpiKey, number | null>>
  percentiles: Partial<Record<CompareKpiKey, number | null>>
}

interface Props {
  companies: CompanyData[]
  kpis: CompareKpiKey[]
  kpiLabels: Record<string, string>
}

// ─── Constants ──────────────────────────────────────────────

const MAX_COMPANIES = 5
const COLORS = CHART_THEME.colors

const KPI_UNITS: Record<CompareKpiKey, string> = {
  turnover_rate: '%',
  leave_usage: '%',
  training_completion: '%',
  payroll_cost: '백만 KRW',
  headcount: '명',
  avg_tenure: '년',
  overtime_rate: '%',
  training_hours: '시간/인',
}

// ─── Helpers ────────────────────────────────────────────────

function formatValue(kpi: CompareKpiKey, value: number | null | undefined): string {
  if (value == null) return '-'
  const unit = KPI_UNITS[kpi]
  if (unit === '백만 KRW') return `${value.toLocaleString()}${unit}`
  if (unit === '명') return `${value.toLocaleString()}${unit}`
  return `${value}${unit}`
}

// ─── Component ──────────────────────────────────────────────

export function CompareRadarChart({ companies, kpis, kpiLabels }: Props) {
  if (companies.length > MAX_COMPANIES) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
        <AlertCircle className="h-8 w-8" />
        <p className="text-sm text-center">
          레이더 차트는 최대 {MAX_COMPANIES}개 법인까지 비교할 수 있습니다.
          <br />
          법인을 {MAX_COMPANIES}개 이하로 줄여주세요.
        </p>
      </div>
    )
  }

  if (companies.length === 0 || kpis.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
        데이터가 없습니다
      </div>
    )
  }

  // 레이더 데이터 구성: 축 = KPI, 값 = 백분위(0-100)
  const radarData = kpis.map(kpi => {
    const point: Record<string, unknown> = { kpi: kpiLabels[kpi] ?? kpi, _kpiKey: kpi }
    for (const c of companies) {
      point[c.company] = c.percentiles[kpi] ?? 0
      // 실제값은 tooltip용으로 별도 저장
      point[`_raw_${c.company}`] = c.values[kpi]
    }
    return point
  })

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
          <PolarGrid stroke="#E2E8F0" />
          <PolarAngleAxis dataKey="kpi" tick={{ fontSize: 11, fill: '#64748B' }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} tickCount={5} />
          {companies.map((c, i) => (
            <Radar
              key={c.companyId}
              name={c.company}
              dataKey={c.company}
              stroke={COLORS[i % COLORS.length]}
              fill={COLORS[i % COLORS.length]}
              fillOpacity={0.12}
              strokeWidth={2}
            />
          ))}
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const kpiKey = payload[0]?.payload?._kpiKey as CompareKpiKey | undefined
              return (
                <div className="rounded-lg border bg-card p-3 shadow-lg min-w-[160px]">
                  <p className="font-semibold text-sm mb-2">{label}</p>
                  {payload.map((entry, i) => {
                    const rawValue = kpiKey ? entry.payload[`_raw_${entry.name}`] : null
                    return (
                      <div key={i} className="flex items-center justify-between gap-4 text-xs py-0.5">
                        <span className="flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: entry.color }}
                          />
                          {entry.name}
                        </span>
                        <span className="font-mono text-muted-foreground">
                          {kpiKey ? formatValue(kpiKey, rawValue as number | null) : '-'}
                          <span className="text-[10px] ml-1 opacity-60">(P{entry.value})</span>
                        </span>
                      </div>
                    )
                  })}
                </div>
              )
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
