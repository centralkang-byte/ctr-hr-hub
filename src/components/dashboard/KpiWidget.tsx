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
import { CARD_STYLES } from '@/lib/styles'
import { CHART_THEME } from '@/lib/styles/chart'

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
      className={`${CARD_STYLES.kpi} ${
        drilldownPath ? 'cursor-pointer hover:border-primary transition-colors' : ''
      }`}
      onClick={() => drilldownPath && router.push(drilldownPath)}
    >
      <p className="text-sm font-semibold text-foreground mb-4">{title}</p>

      <ResponsiveContainer width="100%" height={height}>
        {chartType === 'bar' ? (
          <BarChart data={arrayData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
            <XAxis dataKey={nameKey} tick={CHART_THEME.axis.tick} />
            <YAxis tick={CHART_THEME.axis.tick} />
            <Tooltip contentStyle={CHART_THEME.tooltip.contentStyle} labelStyle={CHART_THEME.tooltip.labelStyle} />
            <Bar dataKey={dataKey} fill={CHART_THEME.colors[0]} radius={[4, 4, 0, 0]} cursor="pointer" />
          </BarChart>
        ) : chartType === 'bar-horizontal' ? (
          <BarChart
            layout="vertical"
            data={arrayData}
            margin={{ top: 4, right: 8, bottom: 4, left: 40 }}
          >
            <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
            <XAxis type="number" tick={CHART_THEME.axis.tick} />
            <YAxis
              dataKey={nameKey}
              type="category"
              tick={CHART_THEME.axis.tick}
              width={60}
            />
            <Tooltip contentStyle={CHART_THEME.tooltip.contentStyle} labelStyle={CHART_THEME.tooltip.labelStyle} />
            <Bar dataKey={dataKey} fill={CHART_THEME.colors[0]} radius={[0, 4, 4, 0]} cursor="pointer" />
          </BarChart>
        ) : chartType === 'line' ? (
          <LineChart data={arrayData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
            <XAxis dataKey={nameKey} tick={CHART_THEME.axis.tick} />
            <YAxis tick={CHART_THEME.axis.tick} />
            <Tooltip contentStyle={CHART_THEME.tooltip.contentStyle} labelStyle={CHART_THEME.tooltip.labelStyle} />
            <Line type="monotone" dataKey={dataKey} stroke={CHART_THEME.colors[0]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
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
                <Cell key={i} fill={CHART_THEME.colors[i % CHART_THEME.colors.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={CHART_THEME.tooltip.contentStyle} labelStyle={CHART_THEME.tooltip.labelStyle} />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            {typeof data === 'object' && data !== null ? (
              Object.entries(data as Record<string, unknown>).map(([k, v]) => (
                <div key={k} className="text-center">
                  <div className="text-3xl font-bold text-foreground">{String(v)}</div>
                  <div className="text-xs text-muted-foreground mt-1">{k}</div>
                </div>
              ))
            ) : (
              <span className="text-3xl font-bold text-foreground">{String(data)}</span>
            )}
          </div>
        )}
      </ResponsiveContainer>
    </div>
  )
}
