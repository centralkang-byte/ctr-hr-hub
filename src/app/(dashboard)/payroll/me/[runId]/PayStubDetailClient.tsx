'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { AlertCircle, ArrowLeft, Download, FileQuestion, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import PayStubBreakdown from '@/components/payroll/PayStubBreakdown'
import { apiClient } from '@/lib/api'
import { formatCurrency } from '@/lib/compensation'
import { TYPOGRAPHY } from '@/lib/styles'
import { formatToTz } from '@/lib/timezone'
import { toast } from '@/hooks/use-toast'
import type { SessionUser } from '@/types'
import type { PayrollItemDetail } from '@/lib/payroll/types'
// Wave 1 X-1: 로컬 normaliseDetail 사본 제거 — SSOT(normalise-detail.ts)가 슈퍼셋
// (legacy otherDeductions 보존 + Number.isFinite 가드)을 흡수
import { normaliseDetail } from '@/lib/payroll/normalise-detail'

// ─── Display helpers ──────────────────────────────────────────
// 급여 기간은 date-only(UTC 자정) 값 — KST 고정 표기 (raw ISO split 금지, OrgClient 컨벤션 미러)
function fmtDate(iso: string | null | undefined): string {
  return iso ? formatToTz(iso, 'Asia/Seoul', 'yyyy.MM.dd') : '-'
}

// ─── API response shape ───────────────────────────────────────
interface PayslipItem {
  id: string
  grossPay: string | number
  netPay: string | number
  deductions: string | number
  detail: unknown   // may be raw or already-normalised; null for overseas (no itemization)
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

interface PayStubDetailClientProps {
  user: SessionUser
  runId: string
}

export default function PayStubDetailClient({ user: _user, runId }: PayStubDetailClientProps) {
  const router = useRouter()
  const t = useTranslations('payStubDetail')
  const tCommon = useTranslations('common')
  const tPayroll = useTranslations('payroll')
  const [items, setItems] = useState<PayslipItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  // 3-상태 분리: error를 빈 결과(notFound)로 위장하지 않음 (rules/components.md)
  const fetchItems = useCallback(async () => {
    try {
      setLoading(true)
      setLoadError(false)
      const res = await apiClient.get<PayslipItem[]>('/api/v1/payroll/me')
      const data = (res.data ?? []) as PayslipItem[]
      setItems(data.filter((i) => i.run.id === runId))
    } catch (err) {
      setLoadError(true)
      toast({
        title: t('loadError'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [runId, t])

  useEffect(() => { fetchItems() }, [fetchItems])

  const handleDownloadPdf = async () => {
    try {
      const res = await window.fetch(`/api/v1/payroll/me/${runId}/pdf`)
      if (!res.ok) {
        toast({ title: t('downloadError'), description: t('downloadErrorDesc'), variant: 'destructive' })
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `payslip_${item?.run.yearMonth ?? 'unknown'}.html`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast({
        title: t('downloadError'),
        description: err instanceof Error ? err.message : t('downloadErrorDesc'),
        variant: 'destructive',
      })
    }
  }

  if (loading) {
    return (
      <div className="p-4 max-w-3xl mx-auto">
        <TableSkeleton rows={8} />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="p-4 max-w-3xl mx-auto">
        <EmptyState
          icon={AlertCircle}
          title={t('loadError')}
          sub={t('loadErrorSub')}
          action={{ label: tCommon('retry'), onClick: () => void fetchItems() }}
          size="lg"
          standalone
        />
      </div>
    )
  }

  const raw = items[0]
  if (!raw) {
    return (
      <div className="p-4 max-w-3xl mx-auto">
        <EmptyState
          icon={FileQuestion}
          title={t('notFound')}
          sub={t('notFoundSub')}
          action={{ label: t('backToList'), onClick: () => router.push('/payroll/me') }}
          size="lg"
          standalone
        />
      </div>
    )
  }

  // 해외 법인: 정본 명세서는 현지 시스템 발급 → 항목분해 미제공, 안내만 표시.
  // (서버가 payslipAvailable=false + detail=null 로 응답)
  if (raw.payslipAvailable === false) {
    return (
      <div className="p-4 space-y-4 max-w-3xl mx-auto">
        {/* Header — #153 [runId] 3페이지 컨벤션 미러 */}
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={tCommon('back')}
            onClick={() => router.push('/payroll/me')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className={TYPOGRAPHY.pageTitle}>
              {t('titleWithMonth', { month: raw.run.yearMonth })}
            </h1>
            <p className="text-[13px] text-muted-foreground mt-1">{raw.run.name}</p>
          </div>
        </div>
        {/* Pay Period Info — 요약(기간/지급일)은 해외도 유지: 동기화된 메타데이터 */}
        <div className="bg-card rounded-2xl shadow-sm border border-border p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">{t('payPeriod')}</p>
              <p className="font-medium font-mono tabular-nums">
                {fmtDate(raw.run.periodStart)} ~ {fmtDate(raw.run.periodEnd)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">{t('payDate')}</p>
              <p className="font-medium font-mono tabular-nums">
                {fmtDate(raw.run.paidAt ?? raw.run.payDate)}
              </p>
            </div>
          </div>
        </div>

        <EmptyState icon={Info} title={t('overseasNoticeTitle')} sub={t('overseasNotice')} standalone />
      </div>
    )
  }

  // Normalise detail on the client — handles both raw and pre-normalised formats
  const detail: PayrollItemDetail | null = normaliseDetail(
    raw.detail,
    Number(raw.grossPay),
    Number(raw.netPay),
  )

  // item alias for use in JSX below
  const item = raw

  if (!detail) {
    return (
      <div className="p-4 max-w-3xl mx-auto">
        <EmptyState
          icon={FileQuestion}
          title={t('notFound')}
          sub={t('notFoundSub')}
          action={{ label: t('backToList'), onClick: () => router.push('/payroll/me') }}
          size="lg"
          standalone
        />
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      {/* Header — #153 [runId] 3페이지 컨벤션 미러 */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={tCommon('back')}
            onClick={() => router.push('/payroll/me')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className={TYPOGRAPHY.pageTitle}>
              {t('titleWithMonth', { month: item.run.yearMonth })}
            </h1>
            <p className="text-[13px] text-muted-foreground mt-1">{item.run.name}</p>
          </div>
        </div>
        <Button type="button" onClick={handleDownloadPdf} variant="outline" className="gap-1">
          <Download className="h-4 w-4" />
          {t('downloadPdf')}
        </Button>
      </div>

      {/* 3-스탯 요약 + 기간 정보 (프로토 page-my-space 명세서 카드 시그니처) */}
      <div className="bg-card rounded-2xl shadow-sm border border-border p-4">
        {/* Codex G2: 375px에서 고정 3-col이면 컬럼당 ~104px라 22px 금액이 넘침 → 모바일 1열 스택 */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-0 pb-4 border-b border-border">
          <div aria-label={`${tPayroll('grossPay')} ${formatCurrency(Number(item.grossPay))}`}>
            <p aria-hidden="true" className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground mb-1">
              {tPayroll('grossPay')}
            </p>
            <p aria-hidden="true" className="text-[22px] font-semibold font-mono tabular-nums tracking-[-0.02em] text-foreground">
              {formatCurrency(Number(item.grossPay))}
            </p>
          </div>
          <div aria-label={`${tPayroll('deductions')} -${formatCurrency(detail.totalDeductions)}`}>
            <p aria-hidden="true" className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground mb-1">
              {tPayroll('deductions')}
            </p>
            <p aria-hidden="true" className="text-[22px] font-semibold font-mono tabular-nums tracking-[-0.02em] text-destructive">
              -{formatCurrency(detail.totalDeductions)}
            </p>
          </div>
          <div aria-label={`${tPayroll('netPay')} ${formatCurrency(Number(item.netPay))}`}>
            <p aria-hidden="true" className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground mb-1">
              {tPayroll('netPay')}
            </p>
            <p aria-hidden="true" className="text-[22px] font-semibold font-mono tabular-nums tracking-[-0.02em] text-primary">
              {formatCurrency(Number(item.netPay))}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm pt-4">
          <div>
            <p className="text-muted-foreground">{t('payPeriod')}</p>
            <p className="font-medium font-mono tabular-nums">
              {fmtDate(item.run.periodStart)} ~ {fmtDate(item.run.periodEnd)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">{t('payDate')}</p>
            <p className="font-medium font-mono tabular-nums">
              {fmtDate(item.run.paidAt ?? item.run.payDate)}
            </p>
          </div>
        </div>
      </div>

      {/* Breakdown */}
      <div className="bg-card rounded-2xl shadow-sm border border-border p-4">
        <PayStubBreakdown detail={detail} />
      </div>
    </div>
  )
}
