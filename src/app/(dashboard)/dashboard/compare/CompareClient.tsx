'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

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
  { key: 'turnover_rate', label: 'KPI_TURNOVER_RATE', unit: '%' },
  { key: 'leave_usage', label: 'KPI_LEAVE_USAGE', unit: '%' },
  { key: 'training_completion', label: 'KPI_TRAINING_COMPLETION', unit: '%' },
  { key: 'payroll_cost', label: 'KPI_PAYROLL_COST', unit: '백만 KRW' },
]
// Note: labels are translation keys; resolved via t(`compareKpi.${kpiKey}`) in JSX

const CHART_COLORS = ['#5E81F4', '#059669', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4']

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
  const t = useTranslations('home')
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
          <h1 className="text-2xl font-bold text-[#1A1A1A]">{t('compareTitle')}</h1>
          <p className="text-sm text-[#666] mt-1">{t('compareSubtitle')}</p>
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
              {t(`compareKpi.${o.key}`)}
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
              {y}{t('yearSuffix')}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <WidgetSkeleton height="h-64" />
      ) : !data ? (
        <EmptyState title={t('noData')} description={t('noDataDesc')} />
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <p className="text-sm font-semibold text-[#1A1A1A] mb-4">
              {t(`compareKpi.${kpi}`)} {t('compareByCompany')} ({year}{t('yearSuffix')}, {kpiOption?.unit})
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={data.results}
                layout="vertical"
                margin={{ left: 20, right: 20, top: 4, bottom: 4 }}
              >
                <CartesianGrid stroke="#E8E8E8" strokeDasharray="3 3" />
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
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <p className="text-sm font-semibold text-[#1A1A1A] mb-4">{t('monthlyTrend')}</p>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart
                  data={data.trend}
                  margin={{ top: 4, right: 8, bottom: 4, left: 0 }}
                >
                  <CartesianGrid stroke="#E8E8E8" strokeDasharray="3 3" />
                  <XAxis dataKey="snapshotDate" tick={{ fontSize: 11, fill: '#666' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#666' }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderColor: '#E8E8E8' }} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#5E81F4"
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
