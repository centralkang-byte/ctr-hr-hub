'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'

import React, { useEffect, useState, useCallback } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, ReferenceLine,
} from 'recharts'
import { TrendingDown, Calendar, AlertTriangle, Users, Shield, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { KpiCard } from '@/components/analytics/KpiCard'
import { ChartCard } from '@/components/analytics/ChartCard'
import { EmptyChart } from '@/components/analytics/EmptyChart'
import { AnalyticsFilterBar } from '@/components/analytics/AnalyticsFilterBar'
import { CHART_COLORS } from '@/components/analytics/chart-colors'
import type { TurnoverResponse } from '@/lib/analytics/types'
import { TABLE_STYLES } from '@/lib/styles'
import { CHART_THEME } from '@/lib/styles/chart'
import { cn } from '@/lib/utils'
import type { SessionUser } from '@/types'

export default function TurnoverClient({ user }: { user: SessionUser }) {
  const tCommon = useTranslations('common')
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
    return <div className="space-y-6 animate-pulse">{[...Array(5)].map((_, i) => <div key={i} className="h-48 bg-gray-100 rounded-xl" />)}</div>
  }

  if (error || !data) {
    return (
      <EmptyState
        title="데이터를 불러올 수 없습니다"
        description="인사이트 데이터를 불러오는 중 오류가 발생했습니다. 새로고침하거나 잠시 후 다시 시도해주세요."
        action={{ label: t('retry'), onClick: () => fetchData() }}
      />
    )
  }

  const { kpis, charts, exitInterviewStats, benchmarkRate } = data

  return (
    <div className="space-y-6">
      <AnalyticsFilterBar companies={companies} />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard {...kpis.monthlyTurnoverRate} icon={TrendingDown} tooltip="당월 퇴사자 ÷ 전월 말 재직자 × 100" />
        <KpiCard {...kpis.annualCumulativeRate} icon={Calendar} tooltip="최근 12개월 누적 퇴사자 ÷ 평균 재직자 수 × 100" />
        <div className={`${Number(kpis.regrettableTurnoverRate.value) > 5 ? 'ring-2 ring-red-200 rounded-xl' : ''}`}>
          <KpiCard {...kpis.regrettableTurnoverRate} icon={AlertTriangle} tooltip="성과 M+(충족 이상) 등급 퇴사자 ÷ M+ 전체 인원 × 100" />
        </div>
        <KpiCard {...kpis.avgTenureAtExit} icon={Clock} tooltip="퇴사자의 평균 근속 연수" />
        <KpiCard {...kpis.highRiskPrediction} icon={Users} tooltip="7개 변수 기반 이직 예측 모델에서 70점 이상 (G-2 예측 엔진)" />
      </div>

      {/* 24-month turnover trend */}
      <ChartCard title="📉 월별 이직률 추이 (24개월)">
        {charts.turnoverTrend.length === 0 ? <EmptyChart /> : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={charts.turnoverTrend}>
              <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
              <XAxis dataKey="month" fontSize={10} tickFormatter={(v) => v.substring(2).replace('-', '/')} />
              <YAxis fontSize={11} unit="%" />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <ReferenceLine y={benchmarkRate} label={{ value: t('kr_kec9785ea_average'), position: 'insideTopRight', fill: '#EF4444', fontSize: 11 }} stroke={CHART_COLORS.danger} strokeDasharray="3 3" />
              <Line type="monotone" dataKey="rate" name="이직률" stroke={CHART_COLORS.primary} strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="📊 퇴직 사유 분류">
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

        <ChartCard title="🏢 부서별 이직률">
          {charts.departmentTurnover.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={charts.departmentTurnover} layout="vertical">
                <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
                <XAxis type="number" fontSize={11} unit="%" />
                <YAxis type="category" dataKey="department" width={80} fontSize={11} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="rate" name="이직률" fill={CHART_COLORS.secondary[3]} radius={[0, 4, 4, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <ChartCard title="📅 근속별 이직 분포">
        {charts.tenureAtExitDist.length === 0 ? <EmptyChart /> : (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={charts.tenureAtExitDist}>
              <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
              <XAxis dataKey="range" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" name="퇴사자 수" fill={CHART_COLORS.warning} radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* G-2: Turnover Risk Prediction Table */}
      {predictions?.data && predictions.data.length > 0 && (
        <ChartCard title="🔮 이직 예측 고위험 Top 20">
          {/* Summary row */}
          <div className="flex gap-4 mb-4 text-xs">
            <span className="px-2.5 py-1 rounded-full bg-gray-50 text-gray-600">
              {t('analytics_keb8c80ec')} <strong>{predictions.summary?.totalAnalyzed || 0}명</strong>
            </span>
            <span className="px-2.5 py-1 rounded-full bg-red-50 text-red-700">
              {t('kr_keab3a0ec')} <strong>{predictions.summary?.highRisk || 0}명</strong>
            </span>
            <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">
              {t('kr_keca3bcec')} <strong>{predictions.summary?.mediumRisk || 0}명</strong>
            </span>
            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">
              {t('kr_kec9588ec')} <strong>{predictions.summary?.lowRisk || 0}명</strong>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className={TABLE_STYLES.table}>
              <thead className={TABLE_STYLES.header}>
                <tr>
                  <th className={TABLE_STYLES.headerCell}>{t('name')}</th>
                  <th className={TABLE_STYLES.headerCell}>{t('department')}</th>
                  <th className={TABLE_STYLES.headerCell}>{t('grade')}</th>
                  <th className={TABLE_STYLES.headerCellRight}>{t('risk_score')}</th>
                  <th className={cn(TABLE_STYLES.headerCell, 'text-center')}>{t('kr_kec8898ec')}</th>
                  <th className={cn(TABLE_STYLES.headerCell, 'text-center')}>{t('kr_kec8381ec')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F0F3]">
                {predictions.data.map((emp: { employeeId: string; name: string; department: string; position: string; score: number; level: string; factors: { factor: string; contribution: number; detail: string }[] }) => (
                  <React.Fragment key={emp.employeeId}>
                    <tr className={TABLE_STYLES.row}>
                      <td className={TABLE_STYLES.cell}>{emp.name}</td>
                      <td className={TABLE_STYLES.cellMuted}>{emp.department}</td>
                      <td className={TABLE_STYLES.cellMuted}>{emp.position}</td>
                      <td className={TABLE_STYLES.cellRight}>
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${emp.level === 'HIGH' ? 'bg-red-500' : emp.level === 'MEDIUM' ? 'bg-amber-500' : 'bg-emerald-500'}`}
                              style={{ width: `${emp.score}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono tabular-nums text-gray-700 w-6 text-right">{emp.score}</span>
                        </div>
                      </td>
                      <td className={TABLE_STYLES.cell}>
                        <div className="flex justify-center">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium ${
                            emp.level === 'HIGH' ? 'bg-red-50 text-red-600' :
                            emp.level === 'MEDIUM' ? 'bg-amber-50 text-amber-600' :
                            'bg-emerald-50 text-[#047857]'
                          }`}>
                            {emp.level === 'HIGH' ? '고위험' : emp.level === 'MEDIUM' ? t('caution') : '안전'}
                          </span>
                        </div>
                      </td>
                      <td className={TABLE_STYLES.cell}>
                        <div className="flex justify-center">
                          <button
                            onClick={() => setExpandedRow(expandedRow === emp.employeeId ? null : emp.employeeId)}
                            className="p-1.5 rounded hover:bg-[#E0E7FF] text-[#8181A5] transition-colors"
                          >
                            {expandedRow === emp.employeeId ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedRow === emp.employeeId && emp.factors.length > 0 && (
                      <tr>
                        <td colSpan={6} className="px-5 py-4 bg-[#F8F9FA] border-b border-[#F0F0F3] shadow-inner">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {emp.factors.map((f: { factor: string; contribution: number; detail: string }, i: number) => (
                              <div key={i} className="flex items-start gap-2 text-xs">
                                <span className="px-1.5 py-0.5 rounded bg-white border border-[#E8E8F0] text-[#1C1D21] font-medium flex-shrink-0">
                                  +{f.contribution}
                                </span>
                                <div>
                                  <span className="font-medium text-[#1C1D21]">{f.factor}:</span>{' '}
                                  <span className="text-[#8181A5]">{f.detail}</span>
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
      <ChartCard title="🔒 퇴직 면담 익명 통계">
        {!exitInterviewStats.canDisplay ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <Shield className="h-8 w-8 text-gray-300" />
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">
                {t('kr_keab09cec_kebb3b4ed_kec9c84ed_')}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                현재: {exitInterviewStats.totalCount}건
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-xs text-gray-500 mb-2">{t('kr_ked87b4ec_kec82acec_kebb984ec')}</p>
              {exitInterviewStats.reasonBreakdown?.map((r) => (
                <div key={r.reason} className="flex items-center justify-between py-1">
                  <span className="text-sm text-gray-700">{r.reason}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#5E81F4] rounded-full" style={{ width: `${r.percentage}%` }} />
                    </div>
                    <span className="text-xs text-gray-500">{r.percentage}%</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-col items-center justify-center">
              <p className="text-xs text-gray-500 mb-2">{t('kr_kec9eacec_kec9d98ed')}</p>
              <div className="relative w-24 h-24">
                <svg viewBox="0 0 36 36" className="w-24 h-24">
                  <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#E5E7EB" strokeWidth="3" />
                  <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={CHART_THEME.colors[0]} strokeWidth="3"
                    strokeDasharray={`${exitInterviewStats.wouldRejoinRate || 0} ${100 - (exitInterviewStats.wouldRejoinRate || 0)}`} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold text-gray-900">{exitInterviewStats.wouldRejoinRate}%</span>
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-2">{t('kr_keba78cec_kecb694ec')}</p>
              {exitInterviewStats.satisfactionTrend?.map((s) => (
                <div key={s.period} className="flex items-center gap-2 py-1">
                  <span className="text-sm text-gray-700">{s.period}</span>
                  <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-red-400 via-amber-400 to-emerald-400 rounded-full" style={{ width: `${(s.score / 5) * 100}%` }} />
                  </div>
                  <span className="text-xs text-gray-500">{s.score}/5</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {exitInterviewStats.insufficientDepartments && exitInterviewStats.insufficientDepartments.length > 0 && (
          <div className="mt-3 p-2 bg-amber-50 rounded-lg">
            <p className="text-xs text-amber-700">
              ⚠️ 통계 미생성 부서: {exitInterviewStats.insufficientDepartments.join(', ')} (5건 미만)
            </p>
          </div>
        )}
      </ChartCard>
    </div>
  )
}
