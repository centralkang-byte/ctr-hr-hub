'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'

import React, { useEffect, useState, useCallback } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,   ResponsiveContainer, PieChart, Pie, Cell, ReferenceLine,
} from 'recharts'
import { TrendingDown, Calendar, AlertTriangle, Users, Shield, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { KpiCard } from '@/components/analytics/KpiCard'
import { ChartCard } from '@/components/analytics/ChartCard'
import { EmptyChart } from '@/components/analytics/EmptyChart'
import { AnalyticsFilterBar } from '@/components/analytics/AnalyticsFilterBar'
import { CHART_COLORS } from '@/components/analytics/chart-colors'
import type { TurnoverResponse } from '@/lib/analytics/types'
import { Badge } from '@/components/ui/badge'
import { TABLE_STYLES } from '@/lib/styles'
import { CHART_THEME } from '@/lib/styles/chart'
import { cn } from '@/lib/utils'
import type { SessionUser } from '@/types'

export default function TurnoverClient({ user: _user }: { user: SessionUser }) {
  const t = useTranslations('analytics')
  const [data, setData] = useState<TurnoverResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [predictions, setPredictions] = useState<any>(null)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const [res, compRes, predRes] = await Promise.all([
        fetch(`/api/v1/analytics/turnover/overview${window.location.search}`),
        fetch('/api/v1/companies'),
        fetch(`/api/v1/analytics/prediction/turnover?limit=20`),
      ])
      if (res.ok) { const j = await res.json(); setData(j.data) }
      else { setError(true) }
      if (compRes.ok) { const c = await compRes.json(); setCompanies(c.data || []) }
      if (predRes.ok) { const p = await predRes.json(); setPredictions(p.data) }
    } catch { setError(true) } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) {
    return <div className="space-y-6 animate-pulse">{[...Array(5)].map((_, i) => <div key={i} className="h-48 bg-muted rounded-xl" />)}</div>
  }

  if (error || !data) {
    return (
      <EmptyState
        title={t('error.loadFailed')}
        description={t('error.loadFailedDescription')}
        action={{ label: t('retry'), onClick: () => fetchData() }}
      />
    )
  }

  const { kpis, charts, exitInterviewStats, benchmarkRate } = data

  return (
    <div className="space-y-6">
      <AnalyticsFilterBar companies={companies} />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard {...kpis.monthlyTurnoverRate} icon={TrendingDown} tooltip={t('turnover.tooltips.monthlyRate')} />
        <KpiCard {...kpis.annualCumulativeRate} icon={Calendar} tooltip={t('turnover.tooltips.annualRate')} />
        <div className={`${Number(kpis.regrettableTurnoverRate.value) > 5 ? 'ring-2 ring-red-200 rounded-xl' : ''}`}>
          <KpiCard {...kpis.regrettableTurnoverRate} icon={AlertTriangle} tooltip={t('turnover.tooltips.regrettableRate')} />
        </div>
        <KpiCard {...kpis.avgTenureAtExit} icon={Clock} tooltip={t('turnover.tooltips.avgTenure')} />
        <KpiCard {...kpis.highRiskPrediction} icon={Users} tooltip={t('turnover.tooltips.highRiskPrediction')} />
      </div>

      {/* 24-month turnover trend */}
      <ChartCard title={t('turnover.charts.monthlyTrend')}>
        {charts.turnoverTrend.length === 0 ? <EmptyChart /> : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={charts.turnoverTrend}>
              <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
              <XAxis dataKey="month" fontSize={10} tickFormatter={(v) => v.substring(2).replace('-', '/')} />
              <YAxis fontSize={11} unit="%" />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <ReferenceLine y={benchmarkRate} label={{ value: t('turnover.charts.industryAvg'), position: 'insideTopRight', fill: CHART_COLORS.danger, fontSize: 11 }} stroke={CHART_COLORS.danger} strokeDasharray="3 3" />
              <Line type="monotone" dataKey="rate" name={t('turnover.charts.turnoverRate')} stroke={CHART_COLORS.primary} strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title={t('turnover.charts.exitReasons')}>
          {charts.exitReasons.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={charts.exitReasons} dataKey="count" nameKey="reason" cx="50%" cy="50%" outerRadius={90} innerRadius={50}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  label={(entry: any) => `${entry.reason} ${entry.percentage}%`} labelLine={{ strokeWidth: 1 }}>
                  {charts.exitReasons.map((_, i) => (
                    <Cell key={i} fill={[CHART_COLORS.primary, ...CHART_COLORS.secondary][i % 8]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title={t('turnover.charts.deptTurnover')}>
          {charts.departmentTurnover.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={charts.departmentTurnover} layout="vertical">
                <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
                <XAxis type="number" fontSize={11} unit="%" />
                <YAxis type="category" dataKey="department" width={80} fontSize={11} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="rate" name={t('turnover.charts.turnoverRate')} fill={CHART_COLORS.secondary[3]} radius={[0, 4, 4, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <ChartCard title={t('turnover.charts.tenureDist')}>
        {charts.tenureAtExitDist.length === 0 ? <EmptyChart /> : (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={charts.tenureAtExitDist}>
              <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
              <XAxis dataKey="range" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" name={t('turnover.charts.exitCount')} fill={CHART_COLORS.warning} radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* G-2: Turnover Risk Prediction Table */}
      {predictions?.data && predictions.data.length > 0 && (
        <ChartCard title={t('turnover.charts.predictionTop20')}>
          {/* Summary row */}
          <div className="flex gap-4 mb-4 text-xs">
            <span className="px-2.5 py-1 rounded-full bg-muted/50 text-muted-foreground">
              {t('turnover.prediction.analyzed')} <strong>{t('turnover.prediction.personCount', { count: predictions.summary?.totalAnalyzed || 0 })}</strong>
            </span>
            <Badge variant="error">
              {t('turnover.prediction.highRisk')} <strong>{t('turnover.prediction.personCount', { count: predictions.summary?.highRisk || 0 })}</strong>
            </Badge>
            <Badge variant="warning">
              {t('turnover.prediction.mediumRisk')} <strong>{t('turnover.prediction.personCount', { count: predictions.summary?.mediumRisk || 0 })}</strong>
            </Badge>
            <Badge variant="success">
              {t('turnover.prediction.lowRisk')} <strong>{t('turnover.prediction.personCount', { count: predictions.summary?.lowRisk || 0 })}</strong>
            </Badge>
          </div>

          <div className="overflow-x-auto">
            <table className={TABLE_STYLES.table}>
              <thead className={TABLE_STYLES.header}>
                <tr>
                  <th className={TABLE_STYLES.headerCell}>{t('name')}</th>
                  <th className={TABLE_STYLES.headerCell}>{t('department')}</th>
                  <th className={TABLE_STYLES.headerCell}>{t('grade')}</th>
                  <th className={TABLE_STYLES.headerCellRight}>{t('risk_score')}</th>
                  <th className={cn(TABLE_STYLES.headerCell, 'text-center')}>{t('turnover.prediction.level')}</th>
                  <th className={cn(TABLE_STYLES.headerCell, 'text-center')}>{t('turnover.prediction.detail')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {predictions.data.map((emp: { employeeId: string; name: string; department: string; position: string; score: number; level: string; factors: { factor: string; contribution: number; detail: string }[] }) => (
                  <React.Fragment key={emp.employeeId}>
                    <tr className={TABLE_STYLES.row}>
                      <td className={TABLE_STYLES.cell}>{emp.name}</td>
                      <td className={TABLE_STYLES.cellMuted}>{emp.department}</td>
                      <td className={TABLE_STYLES.cellMuted}>{emp.position}</td>
                      <td className={TABLE_STYLES.cellRight}>
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${emp.level === 'HIGH' ? 'bg-destructive/50' : emp.level === 'MEDIUM' ? 'bg-amber-500/100' : 'bg-emerald-500/100'}`}
                              style={{ width: `${emp.score}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono tabular-nums text-foreground w-6 text-right">{emp.score}</span>
                        </div>
                      </td>
                      <td className={TABLE_STYLES.cell}>
                        <div className="flex justify-center">
                          <Badge variant={emp.level === 'HIGH' ? 'error' : emp.level === 'MEDIUM' ? 'warning' : 'success'}>
                            {emp.level === 'HIGH' ? t('turnover.risk.high') : emp.level === 'MEDIUM' ? t('turnover.risk.medium') : t('turnover.risk.low')}
                          </Badge>
                        </div>
                      </td>
                      <td className={TABLE_STYLES.cell}>
                        <div className="flex justify-center">
                          <button
                            onClick={() => setExpandedRow(expandedRow === emp.employeeId ? null : emp.employeeId)}
                            className="p-1.5 rounded hover:bg-indigo-500/15 text-muted-foreground transition-colors"
                          >
                            {expandedRow === emp.employeeId ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedRow === emp.employeeId && emp.factors.length > 0 && (
                      <tr>
                        <td colSpan={6} className="px-5 py-4 bg-muted/50 border-b border-border shadow-inner">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {emp.factors.map((f: { factor: string; contribution: number; detail: string }, i: number) => (
                              <div key={i} className="flex items-start gap-2 text-xs">
                                <span className="px-1.5 py-0.5 rounded bg-card border border-border text-foreground font-medium flex-shrink-0">
                                  +{f.contribution}
                                </span>
                                <div>
                                  <span className="font-medium text-foreground">{f.factor}:</span>{' '}
                                  <span className="text-muted-foreground">{f.detail}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}

      {/* Exit interview stats */}
      <ChartCard title={t('turnover.charts.exitInterviewStats')}>
        {!exitInterviewStats.canDisplay ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <Shield className="h-8 w-8 text-muted-foreground/40" />
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">
                {t('turnover.exitInterview.privacyProtection')}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {t('turnover.exitInterview.currentCount', { count: exitInterviewStats.totalCount })}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-xs text-muted-foreground mb-2">{t('turnover.exitInterview.reasonBreakdown')}</p>
              {exitInterviewStats.reasonBreakdown?.map((r) => (
                <div key={r.reason} className="flex items-center justify-between py-1">
                  <span className="text-sm text-foreground">{r.reason}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${r.percentage}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground">{r.percentage}%</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-col items-center justify-center">
              <p className="text-xs text-muted-foreground mb-2">{t('turnover.exitInterview.wouldRejoin')}</p>
              <div className="relative w-24 h-24">
                <svg viewBox="0 0 36 36" className="w-24 h-24">
                  <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#E5E7EB" strokeWidth="3" />
                  <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={CHART_THEME.colors[0]} strokeWidth="3"
                    strokeDasharray={`${exitInterviewStats.wouldRejoinRate || 0} ${100 - (exitInterviewStats.wouldRejoinRate || 0)}`} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold text-foreground">{exitInterviewStats.wouldRejoinRate}%</span>
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2">{t('turnover.exitInterview.satisfactionTrend')}</p>
              {exitInterviewStats.satisfactionTrend?.map((s) => (
                <div key={s.period} className="flex items-center gap-2 py-1">
                  <span className="text-sm text-foreground">{s.period}</span>
                  <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-red-400 via-amber-400 to-emerald-400 rounded-full" style={{ width: `${(s.score / 5) * 100}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground">{s.score}/5</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {exitInterviewStats.insufficientDepartments && exitInterviewStats.insufficientDepartments.length > 0 && (
          <div className="mt-3 p-2 bg-amber-500/10 rounded-lg">
            <p className="text-xs text-amber-700">
              {t('turnover.exitInterview.insufficientDepts', { departments: exitInterviewStats.insufficientDepartments.join(', ') })}
            </p>
          </div>
        )}
      </ChartCard>
    </div>
  )
}
