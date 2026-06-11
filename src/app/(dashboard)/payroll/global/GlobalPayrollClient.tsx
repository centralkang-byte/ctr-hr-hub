'use client'

import { useTranslations, useLocale } from 'next-intl'

import { useState, useEffect, useCallback } from 'react'
import {
  Globe, ChevronLeft, ChevronRight, AlertTriangle, RefreshCw, Settings, Upload,
  Wallet, Users, TrendingUp, Building2,
} from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { WdStatStrip } from '@/components/shared/WdStatStrip'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import { TYPOGRAPHY, BUTTON_VARIANTS, BUTTON_SIZES } from '@/lib/styles'
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

// GL-IA: 차트 4종(recharts)·CHART_COLORS 제거 — 법인별 카드 그리드로 완전 전환 (프로토 :312-365)
// GL-1: 국기 이모지 맵 제거 — 통화코드 font-mono 칩으로 표기 (S287 SIM-3 패턴)

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

  // GL-IA: 차트 파생 배열(barData/pieData/trendData/headcountData) 제거 — trend 필드는 소비만 중단 (백엔드 무수정)
  // 현지 통화 금액 — 프로토 규칙 그대로 VND만 M 축약, 그 외 toLocaleString (G1 MED 금액 계약)
  const fmtLocal = (amount: number, currency: string) =>
    currency === 'VND' ? `${(amount / 1_000_000).toFixed(0)}M` : fmt(Math.round(amount))
  // card-head sub용 월 라벨 (월 네비와 동일 포맷)
  const monthLabel = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }).format(new Date(year, month - 1))

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

          {/* GL-IA: 법인별 카드 그리드 (프로토 :312-365 1:1) — 차트 4종·상세 테이블 대체 */}
          <section aria-labelledby="company-cards-title" className="bg-card rounded-2xl shadow-sm border border-border">
            {/* card-head: title + sub(YYYY년 M월) */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 id="company-cards-title" className={TYPOGRAPHY.cardTitle}>{t('globalPage.companyCards')}</h3>
              <span className="text-xs text-muted-foreground">{monthLabel}</span>
            </div>
            <div className="p-5">
              {/* G1 MED: 무데이터 월 — 안내 1줄 + 전 법인 미시작 카드 유지 (EmptyState 대체 금지) */}
              {!data.companies.some(c => c.hasData) && (
                <p className="mb-3 text-xs text-muted-foreground">{t('globalPage.noMonthData')}</p>
              )}
              <div role="list" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {data.companies.map(co => (
                  // 프로토 onClick=toast는 mock — 카드 비클릭 (dead cursor-pointer 금지)
                  <div
                    key={co.companyId}
                    role="listitem"
                    className={cn(
                      'rounded-xl border border-border bg-card px-[18px] py-4',
                      !co.hasData && 'opacity-60', // hasData=false → 카드 dim
                    )}
                  >
                    {/* 헤더 행: 통화코드 칩(SIM-3 — 프로토 국기 대체 편차) + 법인명 + 상태 칩 */}
                    <div className="flex items-center gap-2.5 mb-3">
                      <span className="shrink-0 rounded-md bg-muted px-1.5 py-1 font-mono tabular-nums text-[11px] font-semibold text-muted-foreground">
                        {co.currency}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-foreground truncate">{co.companyName}</div>
                        <div className="font-mono tabular-nums text-[11px] text-muted-foreground">{co.companyCode}</div>
                      </div>
                      {/* 프로토 지급완료/결재진행/이상검토 status는 API 미반환 → hasData 2값 편차 */}
                      {co.hasData ? (
                        <Badge variant="success">{t('globalPage.aggregated')}</Badge>
                      ) : (
                        <Badge variant="neutral">{t('status.notStarted')}</Badge>
                      )}
                    </div>

                    {/* 현지 통화 블록 (상하 1px 보더) */}
                    <div className="py-3 border-t border-b border-border mb-2.5">
                      <div className="flex justify-between text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground mb-1">
                        <span>{t('globalPage.localCurrency')}</span>
                        <span>{co.currency}</span>
                      </div>
                      <div className="text-lg font-semibold font-mono tabular-nums tracking-[-0.02em] text-foreground">
                        {co.hasData ? fmtLocal(co.totalGrossLocal, co.currency) : '—'}
                      </div>
                    </div>

                    {/* KRW 환산 블록 — 우측 FX delta%는 전월 환율 API 미반환 → 생략 (데이터 부재 편차) */}
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground mb-1">
                        {t('globalPage.krwConverted')}
                      </div>
                      <div className="text-base font-semibold font-mono tabular-nums text-primary-dim">
                        {co.hasData ? `₩${fmtBillion(co.totalGrossKRW)}` : '—'}
                      </div>
                    </div>

                    {/* 풋터: 인원 + 환율 — G1 HIGH 정직성: non-KRW 폴백 1 = "1 CCY = ₩1" 거짓 표기 금지 */}
                    <div className="mt-3 flex items-center justify-between rounded-md bg-muted px-2.5 py-1.5 text-[11px] text-muted-foreground">
                      <span>{co.headcount > 0 ? t('globalPage.headcountSuffix', { count: co.headcount }) : '—'}</span>
                      {co.currency !== 'KRW' && Number(co.exchangeRate) === 1 ? (
                        <span className="opacity-70">{t('globalPage.fxNotSet')}</span>
                      ) : (
                        <span className="font-mono tabular-nums">
                          1 {co.currency} = ₩{Number(co.exchangeRate).toLocaleString(locale, { maximumSignificantDigits: 4 })}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
