'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { WidgetSkeleton } from './WidgetSkeleton'
import { WidgetEmpty } from './WidgetEmpty'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

export type ChartType = 'bar' | 'bar-horizontal' | 'line' | 'donut' | 'number'

interface KpiWidgetProps {
  title: string
  widgetId: string
  companyId: string | null
  year: number
  chartType: ChartType
  drilldownPath?: string
  dataKey?: string
  nameKey?: string
  height?: number
}

const CHART_COLORS = ['#00C853', '#059669', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4']

export function KpiWidget({
  title,
  widgetId,
  companyId,
  year,
  chartType,
  drilldownPath,
  dataKey = 'count',
  nameKey = 'name',
  height = 200,
}: KpiWidgetProps) {
  const router = useRouter()
  const [data, setData] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const params = new URLSearchParams({ year: year.toString() })
      if (companyId) params.set('companyId', companyId)
      else params.set('companyId', 'all')
      const res = await fetch(`/api/v1/dashboard/widgets/${widgetId}?${params}`)
      if (!res.ok) throw new Error('fetch failed')
      const json = await res.json()
      setData(json.data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [widgetId, companyId, year])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) return <WidgetSkeleton />
  if (error || data === null)
    return <WidgetEmpty title={title} message="데이터를 불러올 수 없습니다" />

  const arrayData = Array.isArray(data) ? data : []

  return (
    <div
      className={`bg-white rounded-xl border border-[#E8E8E8] p-5 ${
        drilldownPath ? 'cursor-pointer hover:border-[#00C853] transition-colors' : ''
      }`}
      onClick={() => drilldownPath && router.push(drilldownPath)}
    >
      <p className="text-sm font-semibold text-[#1A1A1A] mb-4">{title}</p>

      <ResponsiveContainer width="100%" height={height}>
        {chartType === 'bar' ? (
          <BarChart data={arrayData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5" />
            <XAxis dataKey={nameKey} tick={{ fontSize: 11, fill: '#666' }} />
            <YAxis tick={{ fontSize: 11, fill: '#666' }} />
            <Tooltip contentStyle={{ fontSize: 12, borderColor: '#E8E8E8' }} />
            <Bar dataKey={dataKey} fill="#00C853" radius={[4, 4, 0, 0]} />
          </BarChart>
        ) : chartType === 'bar-horizontal' ? (
          <BarChart
            layout="vertical"
            data={arrayData}
            margin={{ top: 4, right: 8, bottom: 4, left: 40 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5" />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#666' }} />
            <YAxis
              dataKey={nameKey}
              type="category"
              tick={{ fontSize: 11, fill: '#666' }}
              width={60}
            />
            <Tooltip contentStyle={{ fontSize: 12, borderColor: '#E8E8E8' }} />
            <Bar dataKey={dataKey} fill="#00C853" radius={[0, 4, 4, 0]} />
          </BarChart>
        ) : chartType === 'line' ? (
          <LineChart data={arrayData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5" />
            <XAxis dataKey={nameKey} tick={{ fontSize: 11, fill: '#666' }} />
            <YAxis tick={{ fontSize: 11, fill: '#666' }} />
            <Tooltip contentStyle={{ fontSize: 12, borderColor: '#E8E8E8' }} />
            <Line type="monotone" dataKey={dataKey} stroke="#00C853" strokeWidth={2} dot={false} />
          </LineChart>
        ) : chartType === 'donut' ? (
          <PieChart>
            <Pie
              data={arrayData}
              dataKey={dataKey}
              nameKey={nameKey}
              innerRadius={height * 0.25}
              outerRadius={height * 0.45}
              paddingAngle={2}
            >
              {arrayData.map((_: unknown, i: number) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ fontSize: 12, borderColor: '#E8E8E8' }} />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        ) : (
          <div className="flex items-center justify-center h-full">
            <span className="text-3xl font-bold text-[#1A1A1A]">{String(data)}</span>
          </div>
        )}
      </ResponsiveContainer>
    </div>
  )
}
