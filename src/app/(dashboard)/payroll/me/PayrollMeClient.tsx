'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 내 급여명세서 (/payroll/me)
// Wave 1: 프로토 PayslipMyPage(page-my-space.jsx:382-510) 정합 —
// page-h 골격 + 최근 명세서 hero + 12개월 추이 + 전체 명세서 그리드.
// 기능 보존 재스킨 (overseas 배너·MoM 델타·내비 무변경).
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { Wallet, Sparkles, TrendingUp, TrendingDown, Minus, Info, Download } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { apiClient } from '@/lib/api'
import { formatCurrency } from '@/lib/compensation'
import { cn } from '@/lib/utils'
import { TYPOGRAPHY, BUTTON_VARIANTS, BUTTON_SIZES } from '@/lib/styles'
import type { SessionUser } from '@/types'

// ─── Types ──────────────────────────────────────────────────

interface PayslipItem {
  id: string
  payslipId: string | null
  isViewed: boolean
  viewedAt: string | null
  baseSalary: string | number
  grossPay: string | number
  deductions: string | number
  netPay: string | number
  payslipAvailable?: boolean   // false = 해외 법인(정본은 현지 시스템 발급)
  run: {
    id: string
    name: string
    yearMonth: string
    periodStart: string
    periodEnd: string
    payDate: string | null
    paidAt: string | null
  }
}

interface PayrollMeClientProps {
  user: SessionUser
  /** 연말정산 셀프서비스 진입 노출 (KR + 1~3월 — 서버에서 판정, 종전 rail 조건 보존) */
  showYearEnd?: boolean
}

// ─── Helpers ────────────────────────────────────────────────

/** 'yyyy-MM' → locale 월 라벨 (연·월 숫자 조립 — PayrollClient 월 내비게이터와 동일 패턴, 타임스탬프 아님) */
function formatMonthLabel(yearMonth: string, locale: string): string {
  const [y, m] = yearMonth.split('-').map(Number)
  if (!y || !m) return yearMonth
  return new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(y, m - 1))
}

// ─── MoM Delta ─────────────────────────────────────────

function MoMDelta({ current, previous, sameLabel }: { current: number; previous: number | null; sameLabel: string }) {
  if (!previous || previous === 0) return null
  const diff = current - previous
  const pct = Math.round((diff / previous) * 100)
  if (diff === 0) return (
    <span className="text-xs text-muted-foreground flex items-center gap-0.5">
      <Minus className="h-3 w-3" /> {sameLabel}
    </span>
  )
  if (diff > 0) return (
    <span className="text-xs text-[#006b39] flex items-center gap-0.5">
      <TrendingUp className="h-3 w-3" /> +{pct}% ({formatCurrency(diff)})
    </span>
  )
  return (
    <span className="text-xs text-destructive flex items-center gap-0.5">
      <TrendingDown className="h-3 w-3" /> {pct}% ({formatCurrency(diff)})
    </span>
  )
}

// ─── Component ──────────────────────────────────────────────

export default function PayrollMeClient({
 user: _user, showYearEnd = false }: PayrollMeClientProps) {
  const t = useTranslations('payrollMe')
  const tn = useTranslations('nav')
  const tr = useTranslations('totalRewards')
  const locale = useLocale()
  const router = useRouter()
  const [items, setItems] = useState<PayslipItem[]>([])
  const [loading, setLoading] = useState(true)
  const [yearFilter, setYearFilter] = useState('all')
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await apiClient.get<PayslipItem[]>('/api/v1/payroll/me')
        setItems(res.data ?? [])
      } catch (err) {
        toast({ title: t('loadError'), description: err instanceof Error ? err.message : t('loadErrorDesc'), variant: 'destructive' })
      } finally {
        setLoading(false)
      }
    }
    void fetchItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 마운트 1회 fetch, t는 에러 토스트 카피 전용
  }, [])

  // 연도 옵션 — items run.yearMonth('yyyy-MM')에서 추출, 최신 연도 우선
  const years = useMemo(
    () => Array.from(new Set(items.map((i) => i.run.yearMonth.slice(0, 4)))).sort().reverse(),
    [items],
  )

  // 단일 소스: hero·12개월 차트·건수·그리드 전부 filteredItems에서 파생 (연도 섞임 금지)
  const filteredItems = useMemo(
    () => (yearFilter === 'all' ? items : items.filter((i) => i.run.yearMonth.startsWith(yearFilter))),
    [items, yearFilter],
  )

  // MoM 비교 전월 매핑 — 인접월 정직 비교를 위해 연도 필터와 무관하게 전체 items(desc 정렬) 기준
  const prevById = useMemo(
    () => new Map(items.map((it, idx) => [it.id, items[idx + 1] ?? null])),
    [items],
  )

  // 12개월 추이 — filteredItems 최근 12건을 시간순(과거→최신)으로
  const trendData = useMemo(() => {
    const recent = filteredItems.slice(0, 12).map((i) => ({
      id: i.id,
      yearMonth: i.run.yearMonth,
      netPay: Number(i.netPay),
    }))
    return recent.reverse()
  }, [filteredItems])
  const trendMax = Math.max(...trendData.map((d) => d.netPay), 1)

  if (loading) return <TableSkeleton rows={8} />

  const newCount = filteredItems.filter((i) => !i.isViewed).length
  // 해외 법인: 정본 명세서는 현지 시스템 발급 → 목록 상단 안내 배너(법인 단위 안내라 연도 필터 무관 전체 items 기준)
  const overseasPayroll = items.some((i) => i.payslipAvailable === false)
  const latest = filteredItems[0] ?? null // API가 periodEnd desc 정렬 — [0] = 최신
  // PDF API는 PAID(지급 완료)만 지원 + 해외 법인은 정본 미발급 → 둘 다 충족 시에만 버튼 노출 (Codex G1 P1)
  const latestPdfAvailable = Boolean(latest && latest.run.paidAt && latest.payslipAvailable !== false)

  const handleDownloadPdf = async () => {
    if (!latest) return
    setDownloading(true)
    try {
      // blob 다운로드라 apiClient 대신 raw fetch — PayStubDetailClient.tsx 동일 패턴
      const res = await window.fetch(`/api/v1/payroll/me/${latest.run.id}/pdf`)
      if (!res.ok) throw new Error(t('pdfErrorDesc'))
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `payslip_${latest.run.yearMonth}.html`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast({ title: t('pdfError'), description: err instanceof Error ? err.message : t('pdfErrorDesc'), variant: 'destructive' })
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4">

      {/* ── Header (proto .page-h) ───────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className={TYPOGRAPHY.pageTitle}>{t('title')}</h1>
          {newCount > 0 ? (
            <p className="mt-1 flex items-center gap-1 text-[13px] font-semibold text-wd-orange-ink">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              {t('unreadCount', { count: newCount })}
            </p>
          ) : (
            <p className="mt-1 text-[13px] text-muted-foreground">{t('subtitle')}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* S339 고아 라우트 배선: 총 보상 명세는 rail 미노출 — 급여명세서 허브가 유일 진입점 */}
          <Link
            href="/my/total-rewards"
            className={cn(
              'inline-flex items-center justify-center font-medium',
              BUTTON_VARIANTS.secondary,
              BUTTON_SIZES.sm,
            )}
          >
            {tr('title')}
          </Link>
          {/* Wave1 IA 데모션 4: 연말정산(self) rail → 급여명세서 허브 진입 (2026-06-12 제안 확정) */}
          {showYearEnd && (
            <Link
              href="/my/year-end"
              className={cn(
                'inline-flex items-center justify-center font-medium',
                BUTTON_VARIANTS.secondary,
                BUTTON_SIZES.sm,
              )}
            >
              {tn('mySpace.yearEnd')}
            </Link>
          )}
          {years.length > 0 && (
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="w-[120px]" aria-label={t('yearFilterAria')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allYears')}</SelectItem>
                {years.map((y) => (
                  <SelectItem key={y} value={y}>{t('yearOption', { year: y })}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {overseasPayroll && (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          <Info className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
          <span>{t('overseasNotice')}</span>
        </div>
      )}

      {filteredItems.length === 0 || !latest ? (
        <EmptyState icon={Wallet} title={t('emptyMessage')} sub="" size="lg" standalone />
      ) : (
        <>
          {/* ── 최근 명세서 + 12개월 추이 (proto .grid-21) ────── */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">

            {/* 최근 명세서 hero (proto Card '최근 명세서') */}
            <section className="rounded-2xl border border-border bg-card" aria-labelledby="latest-payslip-title">
              <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
                <h2 id="latest-payslip-title" className={TYPOGRAPHY.cardTitle}>{t('latestPayslip')}</h2>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">{latest.run.yearMonth}</span>
                {latestPdfAvailable && (
                  <button
                    type="button"
                    onClick={() => void handleDownloadPdf()}
                    disabled={downloading}
                    className={cn(BUTTON_VARIANTS.secondary, BUTTON_SIZES.sm, 'ml-auto inline-flex items-center gap-1 font-medium disabled:opacity-50')}
                  >
                    <Download className="h-3 w-3" aria-hidden="true" />
                    {t('pdfButton')}
                  </button>
                )}
              </div>
              {/* 수당 breakdown 행은 목록 API에 detail이 없어 생략 (프로토 mock 서사 — Pixel Gate 기록) */}
              <div className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-3 sm:gap-0">
                <div>
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">{t('grossPay')}</div>
                  <div className="font-mono text-[22px] font-semibold tabular-nums tracking-[-0.02em] text-foreground">
                    {formatCurrency(Number(latest.grossPay))}
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">{t('deductions')}</div>
                  <div className="font-mono text-[22px] font-semibold tabular-nums tracking-[-0.02em] text-destructive">
                    -{formatCurrency(Number(latest.deductions))}
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">{t('netPay')}</div>
                  <div className="font-mono text-[22px] font-semibold tabular-nums tracking-[-0.02em] text-primary">
                    {formatCurrency(Number(latest.netPay))}
                  </div>
                </div>
              </div>
            </section>

            {/* 12개월 추이 (proto Card '12개월 추이' — div 막대, 최신=primary) */}
            <section className="rounded-2xl border border-border bg-card" aria-labelledby="payslip-trend-title">
              <div className="flex items-baseline gap-2 border-b border-border px-5 py-3">
                <h2 id="payslip-trend-title" className={TYPOGRAPHY.cardTitle}>{t('trendTitle')}</h2>
                <span className="text-xs text-muted-foreground">{t('netPay')}</span>
              </div>
              <div className="px-5 py-4">
                <div
                  role="img"
                  aria-label={t('trendAria', { count: trendData.length })}
                  className="grid h-[130px] grid-cols-12 gap-[3px]"
                >
                  {trendData.map((d, i) => (
                    <div key={d.id} className="flex h-full min-w-0 flex-col items-center justify-end gap-[3px]" aria-hidden="true">
                      <div
                        className={cn(
                          'w-[72%] min-h-[4px] rounded-t-sm',
                          i === trendData.length - 1 ? 'bg-primary' : 'bg-primary-container',
                        )}
                        // 프로토와 동일하게 축 상한에 여유를 둠 (최대 88%)
                        style={{ height: `${Math.max((d.netPay / trendMax) * 88, 3)}%` }}
                      />
                      <div className="text-[9px] text-muted-foreground">{formatMonthLabel(d.yearMonth, locale)}</div>
                    </div>
                  ))}
                </div>
                {/* 프로토 하단 정기 인상 각주는 데이터 소스 없음 → 생략 (Pixel Gate 기록) */}
              </div>
            </section>
          </div>

          {/* ── 전체 명세서 (proto .wd-section-h + grid-3) ────── */}
          <div>
            <div className="mb-3 flex items-baseline gap-2">
              <h2 className={TYPOGRAPHY.sectionTitle}>{t('allPayslips')}</h2>
              <span className="text-xs text-muted-foreground">{t('countUnit', { count: filteredItems.length })}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map((item) => {
                const prevItem = prevById.get(item.id) ?? null
                const isNew = !item.isViewed
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => router.push(`/payroll/me/${item.run.id}`)}
                    className={cn(
                      'relative block w-full overflow-hidden rounded-2xl border bg-card p-4 text-left shadow-sm hover:shadow-md motion-safe:transition-[transform,box-shadow] motion-safe:duration-150 motion-safe:hover:-translate-y-0.5',
                      isNew ? 'border-primary ring-1 ring-primary/30' : 'border-border',
                    )}
                  >
                    {/* NEW badge (proto accent-soft 칩) */}
                    {isNew && (
                      <Badge variant="accent" className="absolute right-3 top-3 gap-1">
                        <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
                        {t('newBadge')}
                      </Badge>
                    )}

                    <div className="flex items-center justify-between mb-3 pr-12">
                      <h3 className="font-mono text-base font-semibold tabular-nums tracking-[-0.01em] text-foreground">
                        {item.run.yearMonth}
                      </h3>
                      {!isNew && (
                        <Badge variant="success">{t('paid')}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{item.run.name}</p>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t('grossPay')}</span>
                        <span className="font-mono font-semibold tabular-nums">{formatCurrency(Number(item.grossPay))}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t('deductions')}</span>
                        <span className="font-mono tabular-nums text-destructive">-{formatCurrency(Number(item.deductions))}</span>
                      </div>
                      {/* 실수령 — dashed 구분선 + primary 강조 (proto :514-516) */}
                      <div className="flex justify-between items-baseline pt-1.5 border-t border-dashed border-border">
                        <span className="text-sm font-semibold text-primary">{t('netPay')}</span>
                        <span className="font-mono text-[15px] font-bold tabular-nums text-primary">{formatCurrency(Number(item.netPay))}</span>
                      </div>
                      {/* MoM comparison mini-widget — 프로토보다 풍부한 기능, 보존 */}
                      {prevItem && (
                        <div className="pt-1.5 flex justify-end">
                          <MoMDelta current={Number(item.netPay)} previous={Number(prevItem.netPay)} sameLabel={t('momSame')} />
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
