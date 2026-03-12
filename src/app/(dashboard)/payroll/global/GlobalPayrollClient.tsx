'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

import { useState, useEffect, useCallback } from 'react'
import {
  Globe, ChevronLeft, ChevronRight, TrendingUp, Users,
  Banknote, AlertTriangle, RefreshCw, Settings, Upload
} from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import Link from 'next/link'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import { TABLE_STYLES } from '@/lib/styles'

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

const CHART_COLORS = ['#00C853', '#059669', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4']
const FLAG: Record<string, string> = { 'CTR-KR': '🇰🇷', 'CTR-CN': '🇨🇳', 'CTR-US': '🇺🇸', 'CTR-VN': '🇻🇳', 'CTR-MX': '🇲🇽', 'CTR-RU': '🇷🇺' }

const fmt = (n: number) => n.toLocaleString('ko-KR', { maximumFractionDigits: 0 })
const fmtBillion = (n: number) => {
  if (n >= 1_0000_0000) return `${(n / 1_0000_0000).toFixed(1)}억`
  if (n >= 1_000_0000) return `${(n / 1_000_0000).toFixed(0)}백만`
  return fmt(n)
}

export default function GlobalPayrollClient({
  const tCommon = useTranslations('common')
  const t = useTranslations('payroll') user }: { user: SessionUser }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [data, setData] = useState<GlobalData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<GlobalData>(`/api/v1/payroll/global?year=${year}&month=${month}`)
      setData(res.data)
    } catch {
      setData(null)
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

  const trendData = data?.trend.map(t => ({
    label: `${t.month}월`,
    totalKRW: Math.round(t.totalKRW / 10000),
    headcount: t.headcount,
  })) ?? []

  const headcountData = data?.companies.filter(c => c.headcount > 0).map((c, i) => ({
    name: c.companyCode.replace('CTR-', ''),
    headcount: c.headcount,
    avg: Math.round(c.avgPerHeadKRW / 10000),
    color: CHART_COLORS[i % CHART_COLORS.length],
  })) ?? []

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#E8F5E9] rounded-lg flex items-center justify-center">
            <Globe className="w-5 h-5 text-[#00C853]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1A1A1A]">글로벌 급여 현황</h1>
            <p className="text-sm text-[#666]">6개 법인 급여를 KRW로 통합하여 분석합니다</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/payroll/import"
            className="flex items-center gap-1.5 px-3 py-1.5 border border-[#D4D4D4] rounded-lg text-sm text-[#555] hover:bg-[#FAFAFA]"
          >
            <Upload className="w-4 h-4" /> 급여 업로드
          </Link>
          <Link
            href="/settings/exchange-rates"
            className="flex items-center gap-1.5 px-3 py-1.5 border border-[#D4D4D4] rounded-lg text-sm text-[#555] hover:bg-[#FAFAFA]"
          >
            <Settings className="w-4 h-4" /> 환율 설정
          </Link>
          <button onClick={fetchData} className="p-2 hover:bg-[#F5F5F5] rounded-lg">
            <RefreshCw className={`w-4 h-4 text-[#555] ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Month Nav */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={prevMonth} className="p-2 hover:bg-[#F5F5F5] rounded-lg">
          <ChevronLeft className="w-5 h-5 text-[#555]" />
        </button>
        <div className="text-lg font-semibold text-[#1A1A1A] min-w-[120px] text-center">
          {year}년 {month}월
        </div>
        <button onClick={nextMonth} className="p-2 hover:bg-[#F5F5F5] rounded-lg">
          <ChevronRight className="w-5 h-5 text-[#555]" />
        </button>
        {data && !data.hasExchangeRates && (
          <div className="flex items-center gap-1.5 text-sm text-[#B45309] bg-[#FEF3C7] px-3 py-1.5 rounded-lg">
            <AlertTriangle className="w-4 h-4" />
            환율 미설정 — KRW 환산이 정확하지 않을 수 있습니다
            <Link href="/settings/exchange-rates" className="underline ml-1">환율 설정</Link>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20 text-[#999] text-sm gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" /> 데이터 로딩 중...
        </div>
      )}

      {!loading && data && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <p className="text-xs text-[#666] mb-1">전사 총 급여 (KRW)</p>
              <p className="text-3xl font-bold text-[#1A1A1A]">₩{fmtBillion(data.totalKRW)}</p>
              <p className="text-xs text-[#999] mt-1">{fmt(Math.round(data.totalKRW / 10000))}만원</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <p className="text-xs text-[#666] mb-1">전체 급여 인원</p>
              <p className="text-3xl font-bold text-[#1A1A1A]">{data.totalHeadcount.toLocaleString()}명</p>
              <p className="text-xs text-[#999] mt-1">{data.companies.filter(c => c.hasData).length}개 법인 집계</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <p className="text-xs text-[#666] mb-1">인당 평균 급여 (KRW)</p>
              <p className="text-3xl font-bold text-[#1A1A1A]">
                ₩{data.totalHeadcount > 0 ? fmtBillion(data.totalKRW / data.totalHeadcount) : '—'}
              </p>
              <p className="text-xs text-[#999] mt-1">전사 평균</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <p className="text-xs text-[#666] mb-1">데이터 있는 법인</p>
              <p className="text-3xl font-bold text-[#1A1A1A]">
                {data.companies.filter(c => c.hasData).length} / {data.companies.length}
              </p>
              <p className="text-xs text-[#999] mt-1">개 법인 집계 완료</p>
            </div>
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* Bar: 법인별 총지급 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-sm font-semibold text-[#1A1A1A] mb-4">법인별 급여 총액 (KRW 만원)</h3>
              {barData.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-sm text-[#999]">데이터 없음</div>
              ) : (
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={barData} margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v.toLocaleString()}만`} />
                    <Tooltip formatter={(v: number | undefined) => [`${(v ?? 0).toLocaleString()}만원`, ''] as [string, string]} />
                    <Legend />
                    <Bar dataKey="gross" name="총지급" fill={CHART_THEME.colors[3]} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="net" name="실지급" fill="#059669" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Pie: 법인 비중 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-sm font-semibold text-[#1A1A1A] mb-4">법인별 급여 비중</h3>
              {pieData.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-sm text-[#999]">데이터 없음</div>
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
                    <Tooltip formatter={(v: number | undefined) => [`${(v ?? 0).toLocaleString()}만원`, ''] as [string, string]} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* Line: 월별 트렌드 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-sm font-semibold text-[#1A1A1A] mb-4">최근 6개월 급여 트렌드 (KRW 만원)</h3>
              <ResponsiveContainer width="100%" height={210}>
                <LineChart data={trendData} margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v.toLocaleString()}만`} />
                  <Tooltip formatter={(v: number | undefined) => [`${(v ?? 0).toLocaleString()}만원`, ''] as [string, string]} />
                  <Legend />
                  <Line type="monotone" dataKey="totalKRW" name="총급여(만원)" stroke={CHART_THEME.colors[3]} strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Bar: 인당 평균 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-sm font-semibold text-[#1A1A1A] mb-4">법인별 인당 평균 급여 (KRW 만원)</h3>
              {headcountData.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-sm text-[#999]">데이터 없음</div>
              ) : (
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={headcountData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 24 }}>
                    <CartesianGrid stroke={CHART_THEME.grid.stroke} strokeDasharray={CHART_THEME.grid.strokeDasharray} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${v}만`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={40} />
                    <Tooltip formatter={(v: number | undefined) => [`${(v ?? 0).toLocaleString()}만원`, '인당 평균'] as [string, string]} />
                    <Bar dataKey="avg" name="인당 평균(만원)" radius={[0, 4, 4, 0]}>
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
          <div className="bg-white rounded-xl border border-[#E8E8E8] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#F5F5F5]">
              <h3 className="text-sm font-semibold text-[#1A1A1A]">법인별 상세 현황</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={TABLE_STYLES.header}>
                    <th className={TABLE_STYLES.headerCell}>법인</th>
                    <th className={TABLE_STYLES.headerCell}>통화</th>
                    <th className={TABLE_STYLES.headerCellRight}>환율 (→KRW)</th>
                    <th className={TABLE_STYLES.headerCellRight}>총지급 (현지)</th>
                    <th className={TABLE_STYLES.headerCellRight}>총지급 (KRW)</th>
                    <th className={TABLE_STYLES.headerCellRight}>인원</th>
                    <th className={TABLE_STYLES.headerCellRight}>인당 평균 (KRW)</th>
                    <th className={TABLE_STYLES.headerCell}>데이터</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5F5F5]">
                  {data.companies.map(co => (
                    <tr key={co.companyId} className={TABLE_STYLES.row}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{FLAG[co.companyCode] ?? '🏢'}</span>
                          <div>
                            <div className="font-medium text-[#1A1A1A]">{co.companyCode}</div>
                            <div className="text-xs text-[#999]">{co.companyName}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-[#555]">{co.currency}</td>
                      <td className="px-4 py-3 text-right font-mono text-[#555]">
                        {co.currency === 'KRW' ? '—' : `${Number(co.exchangeRate).toLocaleString('ko-KR', { maximumFractionDigits: 4 })}`}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[#555]">
                        {co.hasData ? `${fmt(Math.round(co.totalGrossLocal))} ${co.currency}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-[#1A1A1A]">
                        {co.hasData ? `₩${fmtBillion(co.totalGrossKRW)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-[#555]">
                        {co.headcount > 0 ? `${co.headcount}명` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[#555]">
                        {co.avgPerHeadKRW > 0 ? `₩${fmtBillion(co.avgPerHeadKRW)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {co.hasData ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-[#D1FAE5] text-[#047857]">집계됨</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-[#F5F5F5] text-[#999]">미집계</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className={TABLE_STYLES.header}>
                    <td colSpan={4} className="px-4 py-3 font-semibold text-sm text-[#1A1A1A]">합계</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-[#1A1A1A]">₩{fmtBillion(data.totalKRW)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-[#1A1A1A]">{data.totalHeadcount}명</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-[#1A1A1A]">
                      {data.totalHeadcount > 0 ? `₩${fmtBillion(data.totalKRW / data.totalHeadcount)}` : '—'}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="px-5 py-3 bg-[#FAFAFA] border-t border-[#F5F5F5]">
              <p className="text-xs text-[#999]">
                * 환율은 {year}년 {month}월 설정값 기준. 설정되지 않은 법인은 환율 1:1로 계산됩니다.
                실제 환율과 차이가 있을 수 있습니다.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
