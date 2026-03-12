'use client'

import { useState, useEffect } from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { WidgetSkeleton } from '@/components/dashboard/WidgetSkeleton'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

type KpiKey = 'turnover_rate' | 'leave_usage' | 'training_completion' | 'payroll_cost'

const KPI_OPTIONS: { key: KpiKey; label: string; unit: string }[] = [
  { key: 'turnover_rate', label: '이직률', unit: '%' },
  { key: 'leave_usage', label: '연차 사용률', unit: '%' },
  { key: 'training_completion', label: '교육 이수율', unit: '%' },
  { key: 'payroll_cost', label: '인건비', unit: '백만 KRW' },
]

const CHART_COLORS = ['#00C853', '#059669', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4']

interface CompareResult {
  company: string
  value: number | null
}

interface CompareData {
  results: CompareResult[]
  trend: Array<{ companyId: string; snapshotDate: string; data: unknown }>
}

export function CompareClient() {
  const router = useRouter()
  const [kpi, setKpi] = useState<KpiKey>('turnover_rate')
  const [year, setYear] = useState(new Date().getFullYear())
  const [data, setData] = useState<CompareData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/v1/dashboard/compare?kpi=${kpi}&year=${year}`)
      .then((r) => r.json())
      .then((json) => setData(json.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [kpi, year])

  const kpiOption = KPI_OPTIONS.find((o) => o.key === kpi)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/dashboard')}
          className="p-2 hover:bg-[#F5F5F5] rounded-lg"
        >
          <ArrowLeft className="w-5 h-5 text-[#555]" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">글로벌 법인 비교</h1>
          <p className="text-sm text-[#666] mt-1">6개 법인 KPI 나란히 비교</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <select
          value={kpi}
          onChange={(e) => setKpi(e.target.value as KpiKey)}
          className="px-3 py-2 text-sm border border-[#D4D4D4] rounded-lg"
        >
          {KPI_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="px-3 py-2 text-sm border border-[#D4D4D4] rounded-lg"
        >
          {[2025, 2026].map((y) => (
            <option key={y} value={y}>
              {y}년
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <WidgetSkeleton height="h-64" />
      ) : !data ? (
        <div className="bg-white rounded-xl border border-[#E8E8E8] p-10 text-center text-sm text-[#999]">
          데이터를 불러올 수 없습니다
        </div>
      ) : (
        <>
          <div className={}>
            <p className="text-sm font-semibold text-[#1A1A1A] mb-4">
              {kpiOption?.label} 법인 비교 ({year}년, {kpiOption?.unit})
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={data.results}
                layout="vertical"
                margin={{ left: 20, right: 20, top: 4, bottom: 4 }}
              >
                <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#666' }} />
                <YAxis
                  dataKey="company"
                  type="category"
                  tick={{ fontSize: 12, fill: '#333' }}
                  width={50}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderColor: '#E8E8E8' }}
                  formatter={(v: unknown) => [`${v} ${kpiOption?.unit}`, kpiOption?.label ?? '']}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {data.results.map((_: unknown, i: number) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {data.trend.length > 0 && (
            <div className={}>
              <p className="text-sm font-semibold text-[#1A1A1A] mb-4">월별 추이</p>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart
                  data={data.trend}
                  margin={{ top: 4, right: 8, bottom: 4, left: 0 }}
                >
                  <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
                  <XAxis dataKey="snapshotDate" tick={{ fontSize: 11, fill: '#666' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#666' }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderColor: '#E8E8E8' }} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={CHART_THEME.colors[3]}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  )
}
