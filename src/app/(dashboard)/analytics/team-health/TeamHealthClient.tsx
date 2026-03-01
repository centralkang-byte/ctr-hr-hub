'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Team Health Analytics Client
// 팀 건강 분석 (부서별 종합점수 + 번아웃 위험)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { apiClient } from '@/lib/api'
import { AnalyticsPageLayout } from '@/components/analytics/AnalyticsPageLayout'
import { ChartCard } from '@/components/analytics/ChartCard'
import { EmptyChart } from '@/components/analytics/EmptyChart'
import { BurnoutBadge } from '@/components/analytics/BurnoutBadge'
import type { TeamHealthData, TeamHealthRow } from '@/lib/analytics/types'

export default function TeamHealthClient() {
  const searchParams = useSearchParams()
  const companyId = searchParams.get('company_id') ?? undefined
  const t = useTranslations('analytics.teamHealthPage')

  function buildRadarData(team: TeamHealthRow) {
    return [
      { metric: t('radarPerformance'), value: (team.avg_performance_score ?? 0) * 20 },
      { metric: t('radarAttendance'), value: Math.max(0, 100 - (team.avg_late_count_4w ?? 0) * 20) },
      { metric: t('radarLeave'), value: Math.min(100, (team.avg_unused_leave_days ?? 0) * 4) },
      { metric: t('radarOneOnOne'), value: team.one_on_one_coverage_pct ?? 0 },
    ]
  }

  const [data, setData] = useState<TeamHealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedTeam, setSelectedTeam] = useState<TeamHealthRow | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<TeamHealthData>('/api/v1/analytics/team-health', {
        company_id: companyId,
      })
      setData(res.data)
      if (res.data.teams.length > 0) {
        setSelectedTeam(res.data.teams[0])
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) {
    return (
      <AnalyticsPageLayout title={t('title')}>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </AnalyticsPageLayout>
    )
  }

  if (!data) {
    return (
      <AnalyticsPageLayout title={t('title')}>
        <EmptyChart />
      </AnalyticsPageLayout>
    )
  }

  const coverageData = data.teams.map((tm) => ({
    department_name: tm.department_name,
    coverage: tm.one_on_one_coverage_pct ?? 0,
  }))

  return (
    <AnalyticsPageLayout title={t('title')} description={t('description')}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Radar Chart for selected team */}
        <ChartCard title={selectedTeam ? t('deptCompositeMetrics', { dept: selectedTeam.department_name }) : t('compositeMetrics')}>
          {selectedTeam ? (
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={buildRadarData(selectedTeam)}>
                <PolarGrid />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12 }} />
                <PolarRadiusAxis domain={[0, 100]} />
                <Radar dataKey="value" stroke="#2563EB" fill="#2563EB" fillOpacity={0.3} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>

        {/* 1:1 미팅 커버리지 */}
        <ChartCard title={t('oneOnOneCoverage')}>
          {coverageData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={coverageData} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} unit="%" />
                <YAxis type="category" dataKey="department_name" width={70} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="coverage" fill="#10B981" radius={[0, 4, 4, 0]} name={t('coveragePercent')} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>

        {/* 부서 건강지표 테이블 */}
        <ChartCard title={t('deptHealthMetrics')} className="lg:col-span-2">
          {data.teams.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">{t('department')}</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">{t('headcount')}</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">{t('performanceScore')}</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">{t('late4w')}</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">{t('overtime4w')}</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">{t('unusedLeave')}</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">{t('oneOnOneCoverageCol')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.teams.map((tm) => (
                    <tr
                      key={tm.department_id}
                      className={`cursor-pointer border-b border-slate-100 hover:bg-slate-50 ${selectedTeam?.department_id === tm.department_id ? 'bg-blue-50' : ''}`}
                      onClick={() => setSelectedTeam(tm)}
                    >
                      <td className="px-4 py-3 font-medium text-slate-700">{tm.department_name}</td>
                      <td className="px-4 py-3 text-center text-slate-600">{tm.team_size}</td>
                      <td className="px-4 py-3 text-center text-slate-600">{tm.avg_performance_score ?? '-'}</td>
                      <td className="px-4 py-3 text-center text-slate-600">{tm.avg_late_count_4w ?? '-'}</td>
                      <td className="px-4 py-3 text-center text-slate-600">{tm.avg_overtime_hours_4w ?? '-'}{t('hSuffix')}</td>
                      <td className="px-4 py-3 text-center text-slate-600">{tm.avg_unused_leave_days ?? '-'}{t('daySuffix')}</td>
                      <td className="px-4 py-3 text-center text-slate-600">{tm.one_on_one_coverage_pct ?? 0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>

        {/* 번아웃 위험 목록 */}
        <ChartCard title={t('burnoutRiskList')} className="lg:col-span-2">
          {data.burnoutList.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">{t('employeeName')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">{t('departmentCol')}</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">{t('level')}</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">{t('highIntensityWeeks')}</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">{t('unusedLeaveCol')}</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">{t('daysSinceOneOnOne')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.burnoutList.map((b) => (
                    <tr key={b.employee_id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-700">{b.name}</td>
                      <td className="px-4 py-3 text-slate-600">{b.department}</td>
                      <td className="px-4 py-3 text-center">
                        <BurnoutBadge isCritical={b.is_burnout_critical} />
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600">{b.consecutive_high_weeks}{t('weekSuffix')}</td>
                      <td className="px-4 py-3 text-center text-slate-600">{b.unused_days}{t('daySuffix')}</td>
                      <td className="px-4 py-3 text-center text-slate-600">{b.days_since_last_one_on_one}{t('daySuffix')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-emerald-600">
              {t('noBurnoutRisk')}
            </div>
          )}
        </ChartCard>
      </div>
    </AnalyticsPageLayout>
  )
}
