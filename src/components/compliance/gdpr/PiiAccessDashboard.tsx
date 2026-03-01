'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Eye, TrendingUp, Users, Calendar } from 'lucide-react'

interface DashboardData {
  total_30d: number
  today_count: number
  access_by_type: Array<{ access_type: string; count: number }>
  top_actors: Array<{ actor_name: string; count: number }>
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: number | string
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-500 mb-1">{label}</p>
          <p className="text-3xl font-bold text-slate-900">{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  )
}

export default function PiiAccessDashboard() {
  const t = useTranslations('compliance')
  const tc = useTranslations('common')

  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/v1/compliance/gdpr/pii-access/dashboard')
      .then((res) => res.json())
      .then((json) => {
        setData(json.data ?? json)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="p-8 text-center text-slate-500">{tc('loading')}</div>
  }

  if (!data) {
    return <div className="p-8 text-center text-slate-500">{tc('noData')}</div>
  }

  const maxByType = Math.max(...(data.access_by_type?.map((a) => a.count) ?? [1]))

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          label={`${t('gdpr.totalAccess')} (30d)`}
          value={data.total_30d ?? 0}
          icon={Eye}
          color="bg-blue-100 text-blue-600"
        />
        <StatCard
          label={tc('today')}
          value={data.today_count ?? 0}
          icon={Calendar}
          color="bg-emerald-100 text-emerald-600"
        />
      </div>

      {/* Access by Type + Top Actors */}
      <div className="grid grid-cols-2 gap-4">
        {/* Access by Type */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-700">{t('gdpr.accessByType')}</h3>
          </div>
          {data.access_by_type?.length === 0 ? (
            <p className="text-sm text-slate-400">{tc('noData')}</p>
          ) : (
            <div className="space-y-3">
              {data.access_by_type?.map((item) => (
                <div key={item.access_type}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-600">{item.access_type}</span>
                    <span className="text-xs font-bold text-slate-900">{item.count}</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${(item.count / maxByType) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Actors */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-700">{t('gdpr.topActors')}</h3>
          </div>
          {data.top_actors?.length === 0 ? (
            <p className="text-sm text-slate-400">{tc('noData')}</p>
          ) : (
            <div className="space-y-2">
              {data.top_actors?.slice(0, 8).map((actor, idx) => (
                <div key={actor.actor_name} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-xs flex items-center justify-center font-medium">
                      {idx + 1}
                    </span>
                    <span className="text-sm text-slate-700">{actor.actor_name}</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-900">{actor.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
