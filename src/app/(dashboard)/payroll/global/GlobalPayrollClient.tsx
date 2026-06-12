'use client'

import { useTranslations, useLocale } from 'next-intl'

import { useState, useEffect, useCallback } from 'react'
import {
  Globe, ChevronLeft, ChevronRight, AlertTriangle, RefreshCw, Settings, Upload,
  Wallet, Users, TrendingUp, Building2,
} from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { WdStatStrip } from '@/components/shared/WdStatStrip'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import { TABLE_STYLES, CHART_THEME, TYPOGRAPHY, BUTTON_VARIANTS, BUTTON_SIZES } from '@/lib/styles'
import { cn } from '@/lib/utils'

interface CompanyStat {
  companyId: string
  companyCode: string
  companyName: string
  currency: string
  exchangeRate: number
  totalGrossLocal: number
  totalNetLocal: number
  totalGrossKRW: number
  totalNetKRW: number
  headcount: number
  avgPerHeadKRW: number
  hasData: boolean
}

interface TrendPoint {
  year: number
  month: number
  totalKRW: number
  headcount: number
}

interface GlobalData {
  year: number
  month: number
  totalKRW: number
  totalHeadcount: number
  companies: CompanyStat[]
  trend: TrendPoint[]
  hasExchangeRates: boolean
}

const CHART_COLORS = [...CHART_THEME.colors]
// GL-1: 국기 이모지 맵 제거 — 법인 코드 font-mono 텍스트로 표기 (S287 SIM-3 패턴)

// fmt, fmtBillion은 컴포넌트 내부에서 t()를 사용하도록 이동

export default function GlobalPayrollClient({ user: _user }: { user: SessionUser }) {
  const t = useTranslations('payroll')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const now = new Date()

  const fmt = (n: number) => n.toLocaleString(locale, { maximumFractionDigits: 0 })
  const fmtBillion = (n: number) => {
    if (n >= 1_0000_0000) return t('globalPage.billionUnit', { n: (n / 1_0000_0000).toFixed(1) })
    if (n >= 1_000_0000) return t('globalPage.millionUnit', { n: (n / 1_000_0000).toFixed(0) })
    return fmt(n)
  }
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [data, setData] = useState<GlobalData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await apiClient.get<GlobalData>(`/api/v1/payroll/global?year=${year}&month=${month}`)
      setData(res.data)
    } catch {
      // GL-5: fetch 실패 → 에러 상태 (본문 대신 EmptyState + 재시도)
      setData(null)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => { fetchData() }, [fetchData])

  const prevMonth = () => month === 1 ? (setYear(y => y - 1), setMonth(12)) : setMonth(m => m - 1)
  const nextMonth = () => month === 12 ? (setYear(y => y + 1), setMonth(1)) : setMonth(m => m + 1)

  // Chart data
  const barData = data?.companies.filter(c => c.hasData).map((c, i) => ({
    name: c.companyCode.replace('CTR-', ''),
    gross: Math.round(c.totalGrossKRW / 10000),
    net: Math.round(c.totalNetKRW / 10000),
    color: CHART_COLORS[i % CHART_COLORS.length],
  })) ?? []

  const pieData = data?.companies.filter(c => c.totalGrossKRW > 0).map((c, i) => ({
    name: c.companyCode.replace('CTR-', ''),
    value: Math.round(c.totalGrossKRW / 10000),
    color: CHART_COLORS[i % CHART_COLORS.length],
  })) ?? []

  const trendData = data?.trend.map(tp => ({
    label: new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(tp.year, tp.month - 1)),
    totalKRW: Math.round(tp.totalKRW / 10000),
    headcount: tp.headcount,
  })) ?? []

  const headcountData = data?.companies.filter(c => c.headcount > 0).map((c, i) => ({
    name: c.companyCode.replace('CTR-', ''),
    headcount: c.headcount,
    avg: Math.round(c.avgPerHeadKRW / 10000),
    color: CHART_COLORS[i % CHART_COLORS.length],
  })) ?? []

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4">
      {/* ── Header (GL-3: proto .page-h — 56px 아이콘 타일 + pageTitle + 13px sub) ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px] bg-accent text-primary">
            <Globe className="h-[26px] w-[26px]" aria-hidden="true" />
          </div>
          <div>
            <h1 className={TYPOGRAPHY.pageTitle}>{t('globalPage.title')}</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">{t('globalPage.subtitle')}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/payroll/import"
            className={cn(BUTTON_VARIANTS.secondary, BUTTON_SIZES.md, 'inline-flex items-center gap-1.5')}
          >
            <Upload className="w-4 h-4" aria-hidden="true" /> {t('globalPage.uploadPayroll')}
          </Link>
          <Link
            href="/settings/exchange-rates"
            className={cn(BUTTON_VARIANTS.secondary, BUTTON_SIZES.md, 'inline-flex items-center gap-1.5')}
          >
            <Settings className="w-4 h-4" aria-hidden="true" /> {t('globalPage.exchangeSettings')}
          </Link>
          <button
            type="button"
            onClick={fetchData}
            aria-label={tCommon('refresh')}
            className={cn(BUTTON_VARIANTS.ghost, 'rounded-lg p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring')}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Month Nav */}
      <div className="flex items-center gap-4">
        <button type="button" onClick={prevMonth} aria-label={t('dashboard.prevMonth')} className="p-2 hover:bg-muted rounded-lg">
          <ChevronLeft className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
        </button>
        <div className="text-lg font-semibold text-foreground min-w-[120px] text-center">
          {new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }).format(new Date(year, month - 1))}
        </div>
        <button type="button" onClick={nextMonth} aria-label={t('dashboard.nextMonth')} className="p-2 hover:bg-muted rounded-lg">
          <ChevronRight className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
        </button>
        {data && !data.hasExchangeRates && (
          // GL-6: 환율 경고 — ALL-4 warning 토큰 (D17 bg/text 분리)
          <div className="flex items-center gap-1.5 text-sm text-ctr-warning bg-warning-bright/15 px-3 py-1.5 rounded-lg">
            <AlertTriangle className="w-4 h-4" aria-hidden="true" />
            {t('globalPage.exchangeWarning')}
            <Link href="/settings/exchange-rates" className="underline ml-1">{t('globalPage.exchangeSettings')}</Link>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" /> {t('globalPage.dataLoading')}
        </div>
      )}

      {/* GL-5: fetch 에러 — 본문 대신 EmptyState + 재시도 */}
      {!loading && error && (
        <EmptyState
          icon={AlertTriangle}
          title={t('loadFailed')}
          sub={tCommon('errorDesc')}
          action={{ label: tCommon('retry'), onClick: () => { void fetchData() } }}
          standalone
        />
      )}

      {!loading && data && (
        <>
          {/* KPI — GL-4: proto .wd-stat-strip (정확히 4개 실수치, 의미별 tone) */}
          <WdStatStrip
            items={[
              {
                label: t('globalPage.totalPayrollKRW'),
                value: `₩${fmtBillion(data.totalKRW)}`,
                icon: Wallet,
                tone: 'info',
                foot: `${fmt(Math.round(data.totalKRW / 10000))} ${t('globalPage.manWonUnit')}`,
              },
              {
                label: t('globalPage.totalHeadcount'),
                value: t('globalPage.headcountSuffix', { count: data.totalHeadcount.toLocaleString() }),
                icon: Users,
                foot: t('globalPage.companiesCount', { count: data.companies.filter(c => c.hasData).length }),
              },
              {
                label: t('globalPage.avgPayPerPerson'),
                value: data.totalHeadcount > 0 ? `₩${fmtBillion(data.totalKRW / data.totalHeadcount)}` : '—',
                icon: TrendingUp,
                foot: t('globalPage.companyAvg'),
              },
              {
                label: t('globalPage.companiesWithData'),
                value: `${data.companies.filter(c => c.hasData).length} / ${data.companies.length}`,
                icon: Building2,
                tone: data.companies.filter(c => c.hasData).length === data.companies.length ? 'success' : 'warning',
                foot: t('globalPage.companiesCompleted', { count: data.companies.filter(c => c.hasData).length }),
              },
            ]}
          />

          {/* Charts Row 1 */}
          <div className="grid grid-cols-2 gap-4">
            {/* Bar: 법인별 총지급 */}
            <div className="bg-card rounded-xl shadow-sm border border-border p-4">
              <h3 className="text-sm font-semibold text-foreground mb-4">{t('globalPage.companyPayrollTotal')}</h3>
              {barData.length === 0 ? (
                <div className="h-52 flex items-center justify-center">
                  <EmptyState size="sm" title={t('globalPage.noData')} sub="" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={barData} margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v.toLocaleString()}`} />
                    <Tooltip formatter={(v) => [`${(Number(v) || 0).toLocaleString()} ${t('globalPage.manWonUnit')}`, ''] as [string, string]} />
                    <Legend />
                    <Bar dataKey="gross" name={t('globalPage.grossTotal')} fill={CHART_THEME.colors[3]} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="net" name={t('globalPage.netTotal')} fill="#059669" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Pie: 법인 비중 */}
            <div className="bg-card rounded-xl shadow-sm border border-border p-4">
              <h3 className="text-sm font-semibold text-foreground mb-4">{t('globalPage.companyPayrollShare')}</h3>
              {pieData.length === 0 ? (
                <div className="h-52 flex items-center justify-center">
                  <EmptyState size="sm" title={t('globalPage.noData')} sub="" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={210}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {pieData.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => [`${(Number(v) || 0).toLocaleString()} ${t('globalPage.manWonUnit')}`, ''] as [string, string]} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-2 gap-4">
            {/* Line: 월별 트렌드 */}
            <div className="bg-card rounded-xl shadow-sm border border-border p-4">
              <h3 className="text-sm font-semibold text-foreground mb-4">{t('globalPage.trendTitle')}</h3>
              <ResponsiveContainer width="100%" height={210}>
                <LineChart data={trendData} margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v.toLocaleString()}`} />
                  <Tooltip formatter={(v) => [`${(Number(v) || 0).toLocaleString()} ${t('globalPage.manWonUnit')}`, ''] as [string, string]} />
                  <Legend />
                  <Line type="monotone" dataKey="totalKRW" name={t('globalPage.totalPayroll')} stroke={CHART_THEME.colors[3]} strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Bar: 인당 평균 */}
            <div className="bg-card rounded-xl shadow-sm border border-border p-4">
              <h3 className="text-sm font-semibold text-foreground mb-4">{t('globalPage.avgPayPerPersonChart')}</h3>
              {headcountData.length === 0 ? (
                <div className="h-52 flex items-center justify-center">
                  <EmptyState size="sm" title={t('globalPage.noData')} sub="" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={headcountData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 24 }}>
                    <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${v}`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={40} />
                    <Tooltip formatter={(v) => [`${(Number(v) || 0).toLocaleString()} ${t('globalPage.manWonUnit')}`, t('globalPage.avgPerPerson')] as [string, string]} />
                    <Bar dataKey="avg" name={t('globalPage.avgPerPerson')} radius={[0, 4, 4, 0]}>
                      {headcountData.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Company Detail Table */}
          <div className={TABLE_STYLES.wrapper}>
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">{t('globalPage.companyDetailTitle')}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className={TABLE_STYLES.table}>
                <thead>
                  <tr className={TABLE_STYLES.header}>
                    <th className={TABLE_STYLES.headerCell}>{t('globalPage.colCompany')}</th>
                    <th className={TABLE_STYLES.headerCell}>{t('globalPage.colCurrency')}</th>
                    <th className={TABLE_STYLES.headerCellRight}>{t('globalPage.colExchangeRate')}</th>
                    <th className={TABLE_STYLES.headerCellRight}>{t('globalPage.colGrossLocal')}</th>
                    <th className={TABLE_STYLES.headerCellRight}>{t('globalPage.colGrossKRW')}</th>
                    <th className={TABLE_STYLES.headerCellRight}>{t('globalPage.colHeadcount')}</th>
                    <th className={TABLE_STYLES.headerCellRight}>{t('globalPage.colAvgPerHead')}</th>
                    <th className={cn(TABLE_STYLES.headerCell, "text-center")}>{t('globalPage.colData')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.companies.map(co => (
                    <tr key={co.companyId} className={TABLE_STYLES.row}>
                      <td className={TABLE_STYLES.cell}>
                        {/* GL-1: 국기 이모지 → 법인 코드 font-mono 텍스트 */}
                        <div>
                          <div className="font-mono tabular-nums font-medium text-foreground">{co.companyCode}</div>
                          <div className="text-xs text-muted-foreground">{co.companyName}</div>
                        </div>
                      </td>
                      <td className={cn(TABLE_STYLES.cell, "font-mono tabular-nums text-muted-foreground")}>{co.currency}</td>
                      <td className={cn(TABLE_STYLES.cellRight, "font-mono tabular-nums text-muted-foreground")}>
                        {co.currency === 'KRW' ? '—' : `${Number(co.exchangeRate).toLocaleString(locale, { maximumFractionDigits: 4 })}`}
                      </td>
                      <td className={cn(TABLE_STYLES.cellRight, "font-mono tabular-nums text-muted-foreground")}>
                        {co.hasData ? `${fmt(Math.round(co.totalGrossLocal))} ${co.currency}` : '—'}
                      </td>
                      <td className={cn(TABLE_STYLES.cellRight, "font-mono tabular-nums font-semibold text-foreground")}>
                        {co.hasData ? `₩${fmtBillion(co.totalGrossKRW)}` : '—'}
                      </td>
                      <td className={cn(TABLE_STYLES.cellRight, "text-muted-foreground")}>
                        {co.headcount > 0 ? t('globalPage.headcountSuffix', { count: co.headcount }) : '—'}
                      </td>
                      <td className={cn(TABLE_STYLES.cellRight, "font-mono tabular-nums text-muted-foreground")}>
                        {co.avgPerHeadKRW > 0 ? `₩${fmtBillion(co.avgPerHeadKRW)}` : '—'}
                      </td>
                      <td className={cn(TABLE_STYLES.cell, "text-center")}>
                        {/* GL-2: raw emerald → Badge 시맨틱 토큰 */}
                        {co.hasData ? (
                          <Badge variant="success">{t('globalPage.aggregated')}</Badge>
                        ) : (
                          <Badge variant="neutral">{t('globalPage.notStarted')}</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className={TABLE_STYLES.header}>
                    <td colSpan={4} className="px-4 py-3 font-semibold text-sm text-foreground">{tCommon('total')}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-foreground">₩{fmtBillion(data.totalKRW)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground">{t('globalPage.headcountSuffix', { count: data.totalHeadcount })}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-foreground">
                      {data.totalHeadcount > 0 ? `₩${fmtBillion(data.totalKRW / data.totalHeadcount)}` : '—'}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="px-5 py-3 bg-background border-t border-border">
              <p className="text-xs text-muted-foreground">
                {t('globalPage.exchangeNote', { year, month })}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
