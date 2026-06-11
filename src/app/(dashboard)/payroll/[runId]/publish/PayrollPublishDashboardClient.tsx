'use client'

// ═══════════════════════════════════════════════════════════
// GP#3-C: HR 급여 발행 대시보드 — /payroll/[runId]/publish
// 발행 현황 + 열람률 + 다운로드 + 승인 이력 + 재알림
// Wave 1: 프로토 정합 (WdStatStrip·flat 진행바·StatusBadge·Button)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import {
    AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff, Download,
    Bell, FileQuestion, FileSpreadsheet, FileText, CreditCard,
    Users, DollarSign, Loader2, ChevronDown,
    Clock, XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Skeleton } from '@/components/ui/skeleton'
import { KpiCardsSkeleton, ChartSkeleton } from '@/components/shared/PageSkeleton'
import { WdStatStrip } from '@/components/shared/WdStatStrip'
import { EmptyState } from '@/components/ui/EmptyState'
import { apiClient } from '@/lib/api'
import { AppError } from '@/lib/errors'
import { CARD_STYLES, TYPOGRAPHY } from '@/lib/styles'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import type { SessionUser } from '@/types'

// ─── Types ──────────────────────────────────────────────

interface PublishStatus {
    run: {
        id: string
        companyId: string
        yearMonth: string
        status: string
        headcount: number | null
        totalNet: string | number | null
        totalGross: string | number | null
        totalDeductions: string | number | null
        approvedAt: string | null
        paidAt: string | null
        adjustmentCount: number | null
    }
    payslipStats: {
        total: number
        viewed: number
        unviewed: number
        viewRate: number
    }
    transferBatches: Array<{
        id: string
        status: string
        totalAmount: string | number
        totalCount: number
        generatedAt: string | null
        createdAt: string
        note: string | null
    }>
    approvalHistory: Array<{
        stepNumber: number
        roleRequired: string
        approverName: string | null
        status: string
        comment: string | null
        decidedAt: string | null
    }>
}

// fmt, fmtDate은 컴포넌트 내부에서 t()와 locale을 사용하도록 이동

// ─── Helpers ─────────────────────────────────────────────

// Content-Disposition 헤더에서 파일명 추출 (RFC 5987 `filename*=UTF-8''` 우선, plain filename fallback)
function filenameFromDisposition(disposition: string | null): string {
    const fallback = '급여이체파일.csv'
    if (!disposition) return fallback
    const star = disposition.match(/filename\*=UTF-8''([^;]+)/i)
    if (star?.[1]) {
        try { return decodeURIComponent(star[1]) } catch { return fallback }
    }
    const plain = disposition.match(/filename="?([^";]+)"?/i)
    return plain?.[1]?.trim() ?? fallback
}

// ─── Progress Bar ────────────────────────────────────────

function ViewProgressBar({ viewed, total }: { viewed: number; total: number }) {
    const t = useTranslations('payroll')
    const pct = total > 0 ? Math.round((viewed / total) * 100) : 0
    return (
        <div>
            <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-muted-foreground">{t('publishPage.viewRate')}</span>
                <span className="text-sm font-bold text-foreground">{pct}%</span>
            </div>
            {/* 프로토 .progress 정합: flat solid fill (그라데이션 금지) — WdGroupedStatCard 선례 */}
            <div
                className="h-2 w-full bg-muted rounded-full overflow-hidden"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${t('publishPage.viewRate')} ${pct}%`}
            >
                <div
                    className="h-full rounded-full transition-all duration-700 bg-primary"
                    style={{ width: `${pct}%` }}
                />
            </div>
            <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Eye className="h-3 w-3" aria-hidden="true" /> {t('publishPage.viewed', { count: viewed })}</span>
                <span className="flex items-center gap-1"><EyeOff className="h-3 w-3" aria-hidden="true" /> {t('publishPage.unviewed', { count: total - viewed })}</span>
            </div>
        </div>
    )
}

// ─── Main Component ──────────────────────────────────────

interface Props {
    user: SessionUser
    runId: string
}

export default function PayrollPublishDashboardClient({ user: _user, runId }: Props) {
  const t = useTranslations('payroll')
  const tc = useTranslations('common')
  const locale = useLocale()

  const fmt = (n: number | string | null | undefined) => {
      if (n == null) return '—'
      return t('fmt.amountWon', { n: Number(n).toLocaleString() })
  }
  const fmtDate = (d: string | null | undefined) => {
      if (!d) return '—'
      return new Date(d).toLocaleString(locale, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }
  // 이체 배치 상태 라벨 — raw enum 노출 대신 i18n (StatusBadge children용)
  const batchStatusLabel = (status: string): string => {
      switch (status) {
          case 'DRAFT': return t('publishPage.batchStatus.draft')
          case 'GENERATING': return t('publishPage.batchStatus.generating')
          case 'GENERATED': return t('publishPage.batchStatus.generated')
          case 'SUBMITTED': return t('publishPage.batchStatus.submitted')
          case 'PARTIALLY_COMPLETED': return t('publishPage.batchStatus.partiallyCompleted')
          case 'COMPLETED': return t('publishPage.batchStatus.completed')
          case 'FAILED': return t('publishPage.batchStatus.failed')
          default: return status
      }
  }

    const router = useRouter()
    const [data, setData] = useState<PublishStatus | null>(null)
    const [loading, setLoading] = useState(true)
    const [notifying, setNotifying] = useState(false)
    const [notifyResult, setNotifyResult] = useState<string | null>(null)
    const [showDownloads, setShowDownloads] = useState(false)
    const [markingPaid, setMarkingPaid] = useState(false)
    const [downloadingTransfer, setDownloadingTransfer] = useState(false)

    // 로드 실패 구분: 404(notFound/접근불가) vs 그 외(일시 오류 → 재시도)
    const [loadError, setLoadError] = useState<'notFound' | 'error' | null>(null)

    // publish-status는 1회 조회 + 액션 후 수동 재조회 (폴링 아님 — Codex G1 #1)
    const fetchData = useCallback(async () => {
        try {
            const res = await apiClient.get<PublishStatus>(`/api/v1/payroll/${runId}/publish-status`)
            setData(res.data)
            setLoadError(null)
        } catch (err) {
            if (err instanceof AppError && err.statusCode === 404) {
                setLoadError('notFound')
            } else {
                setLoadError('error')
                toast({ title: t('publishPage.loadFailed'), description: err instanceof Error ? err.message : '', variant: 'destructive' })
            }
        } finally {
            setLoading(false)
        }
    }, [runId])

    useEffect(() => { void fetchData() }, [fetchData])

    const handleNotifyUnread = async () => {
        setNotifying(true)
        setNotifyResult(null)
        try {
            const res = await apiClient.post<{ notifiedCount: number; message: string }>(
                `/api/v1/payroll/${runId}/notify-unread`,
                {},
            )
            setNotifyResult(res.data.message)
            await fetchData()
        } catch (err) {
            toast({ title: t('publishPage.notifyFailed'), description: err instanceof Error ? err.message : '', variant: 'destructive' })
        } finally {
            setNotifying(false)
        }
    }

    const handleMarkPaid = async () => {
        setMarkingPaid(true)
        try {
            await apiClient.put(`/api/v1/payroll/runs/${runId}/paid`)
            toast({ title: tc('completed') })
            await fetchData()
        } catch (err) {
            toast({ title: tc('error'), description: err instanceof Error ? err.message : '', variant: 'destructive' })
        } finally {
            setMarkingPaid(false)
        }
    }

    // GET export (저널·대장·비교) — 부수효과 없는 읽기라 단순 앵커 다운로드.
    const triggerDownload = (url: string) => {
        const a = document.createElement('a')
        a.href = url
        a.click()
    }

    // 이체파일 생성은 매 호출마다 BankTransferBatch를 만드는 쓰기 작업 → POST.
    // (앵커 href = GET 이면 prefetch·재시도·CSRF로 무단 배치가 생김.)
    // apiClient는 JSON 파싱이라 바이너리 CSV에 부적합 → raw fetch + blob 다운로드.
    // 파일명은 서버 Content-Disposition을 보존한다.
    const triggerTransferDownload = async (url: string) => {
        setDownloadingTransfer(true)
        try {
            const res = await fetch(url, { method: 'POST' })
            if (!res.ok) {
                const body = (await res.json().catch(() => null)) as { error?: { message?: string } | string } | null
                const msg = typeof body?.error === 'string' ? body.error : body?.error?.message
                throw new Error(msg || `${res.status}`)
            }
            const blob = await res.blob()
            const objectUrl = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = objectUrl
            a.download = filenameFromDisposition(res.headers.get('Content-Disposition'))
            a.click()
            window.URL.revokeObjectURL(objectUrl)
        } catch (err) {
            toast({ title: tc('error'), description: err instanceof Error ? err.message : '', variant: 'destructive' })
        } finally {
            setDownloadingTransfer(false)
        }
    }

    if (loading) {
        return (
            <div className="p-6 max-w-4xl mx-auto space-y-5">
                <Skeleton className="h-8 w-48" />
                <KpiCardsSkeleton className="gap-3" />
                <ChartSkeleton />
            </div>
        )
    }

    // 명시적 not-found/오류 상태 — 무한 스켈레톤 금지 (rules/components.md 3-상태)
    if (!data) {
        const isNotFound = loadError === 'notFound'
        return (
            <div className="p-6 max-w-4xl mx-auto">
                <EmptyState
                    icon={isNotFound ? FileQuestion : AlertCircle}
                    title={isNotFound ? t('runLoad.notFoundTitle') : t('runLoad.errorTitle')}
                    sub={isNotFound ? t('runLoad.notFoundSub') : t('runLoad.errorSub')}
                    action={isNotFound
                        ? { label: t('runLoad.backToHub'), onClick: () => router.push('/payroll') }
                        : { label: tc('retry'), onClick: () => { setLoading(true); void fetchData() } }}
                    size="lg"
                    standalone
                />
            </div>
        )
    }

    const { run, payslipStats, transferBatches, approvalHistory } = data
    const isApproved = ['APPROVED', 'PAID'].includes(run.status)
    // SUPER_ADMIN = 전 법인 급여 운영자(CEO 결정 S285) — 쓰기성 액션 cross-company 게이트 제거.
    // 본인 법인 강제는 API 가드(소유권 우선 403)가 담당; 비-SUPER는 read 라우트(#154)에서 이미 차단.

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-5">
            {/* Header — proto .page-h 골격: pageTitle + 부제(yearMonth) 좌측, 주 액션 우측 끝 */}
            <div className="flex items-start gap-3">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => router.push('/payroll')}
                    aria-label={tc('back')}
                >
                    <ArrowLeft aria-hidden="true" />
                </Button>
                <div>
                    <h1 className={TYPOGRAPHY.pageTitle}>{t('kr_kebb09ced_status')}</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[13px] text-muted-foreground">{run.yearMonth}</span>
                        {isApproved && (
                            <Badge variant="success">
                                <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden="true" />
                                {t('kr_kebb09ced_complete')}
                            </Badge>
                        )}
                    </div>
                </div>
                {run.status === 'APPROVED' && (
                    <span className="ml-auto">
                        <Button
                            type="button"
                            onClick={handleMarkPaid}
                            disabled={markingPaid}
                        >
                            {markingPaid ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CreditCard aria-hidden="true" />}
                            {t('kr_keca780ea_complete')}
                        </Button>
                    </span>
                )}
            </div>

            {/* KPI Strip — DESIGN_RULES §3 패턴 A (실수치 4개: 인원·실지급액·발행·열람) */}
            <WdStatStrip
                items={[
                    {
                        label: t('kr_kecb49d_kec9db8ec'),
                        value: run.headcount ?? 0,
                        unit: t('publishPage.unitPersons'),
                        icon: Users,
                        tone: 'info',
                    },
                    {
                        label: t('netPay'),
                        value: fmt(Number(run.totalNet ?? 0)),
                        icon: DollarSign,
                        tone: 'success',
                    },
                    {
                        label: t('persons_kec84b8ec_kebb09ced'),
                        value: payslipStats.total,
                        unit: t('publishPage.unitCases'),
                        icon: FileText,
                        tone: 'info',
                    },
                    {
                        label: t('kr_kec97b4eb'),
                        value: payslipStats.viewed,
                        unit: t('publishPage.unitPersons'),
                        icon: Eye,
                        tone: 'info',
                        foot: t('publishPage.viewedFoot', { rate: payslipStats.viewRate }),
                    },
                ]}
            />

            {/* Payslip View Rate */}
            <section className={`${CARD_STYLES.kpi} space-y-4`} aria-labelledby="publish-view-rate-title">
                <div className="flex items-center justify-between">
                    <h2 id="publish-view-rate-title" className={TYPOGRAPHY.cardTitle}>{t('payStub_kec97b4eb_status')}</h2>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleNotifyUnread}
                        disabled={notifying || payslipStats.unviewed === 0}
                    >
                        {notifying ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Bell aria-hidden="true" />}
                        {t('publishPage.resendReminder', { count: payslipStats.unviewed })}
                    </Button>
                </div>
                <ViewProgressBar viewed={payslipStats.viewed} total={payslipStats.total} />
                {notifyResult && (
                    <p className="text-xs text-[#006b39] bg-tertiary/10 rounded-lg px-3 py-2">{notifyResult}</p>
                )}
            </section>

            {/* Downloads */}
            <section className={CARD_STYLES.padded} aria-labelledby="publish-downloads-title">
                <div className="flex items-center justify-between mb-4">
                    <h2 id="publish-downloads-title" className={TYPOGRAPHY.cardTitle}>{t('kr_ked8c8cec_keb8ba4ec')}</h2>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowDownloads(!showDownloads)}
                        aria-label={t('kr_kec9db4ec_ked8c8cec_kec839dec_')}
                        aria-expanded={showDownloads}
                    >
                        <ChevronDown className={`transition-transform ${showDownloads ? 'rotate-180' : ''}`} aria-hidden="true" />
                    </Button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        {
                            label: t('kr_kec9d80ed_kec9db4ec'),
                            sub: 'CSV',
                            icon: <CreditCard className="h-5 w-5 text-[#006b39]" aria-hidden="true" />,
                            bg: 'bg-tertiary/10',
                            disabled: !isApproved,
                            title: undefined,
                            url: `/api/v1/payroll/${runId}/export/transfer`,
                            method: 'POST' as const,  // 이체 배치 생성(쓰기) — POST + blob 다운로드
                        },
                        {
                            // 기존 '급여월' 키 오용 교정 — 급여대장 export 라벨 (플랜 §1.7 보너스 수정과 동일 결함)
                            label: t('publishPage.exportLedger'),
                            sub: 'Excel',
                            icon: <FileSpreadsheet className="h-5 w-5 text-primary/90" aria-hidden="true" />,
                            bg: 'bg-primary/15',
                            disabled: false,
                            title: undefined,
                            url: `/api/v1/payroll/${runId}/export/ledger`,
                            method: 'GET' as const,
                        },
                        {
                            label: t('kr_keca084ec_keb8c80eb_kebb984ea'),
                            sub: 'Excel',
                            icon: <FileSpreadsheet className="h-5 w-5 text-wd-orange" aria-hidden="true" />,
                            bg: 'bg-warning-bright/15',
                            disabled: false,
                            title: undefined,
                            url: `/api/v1/payroll/${runId}/export/comparison`,
                            method: 'GET' as const,
                        },
                        {
                            label: t('kr_kec9db8ea_keca084ed'),
                            sub: 'Excel',
                            icon: <FileText className="h-5 w-5 text-primary" aria-hidden="true" />,
                            bg: 'bg-wt-4/10',
                            disabled: false,
                            title: undefined,
                            url: `/api/v1/payroll/${runId}/export/journal`,
                            method: 'GET' as const,
                        },
                    ].map((item) => (
                        <button
                            key={item.label}
                            type="button"
                            onClick={() => {
                                if (item.disabled) return
                                if (item.method === 'POST') void triggerTransferDownload(item.url)
                                else triggerDownload(item.url)
                            }}
                            disabled={item.disabled || (item.method === 'POST' && downloadingTransfer)}
                            title={item.title}
                            className={`flex flex-col items-center gap-2 p-4 rounded-xl border border-border transition-colors ${item.disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-background cursor-pointer'}`}
                        >
                            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${item.bg}`}>
                                {item.icon}
                            </div>
                            <div className="text-center">
                                <p className="text-xs font-semibold text-foreground">{item.label}</p>
                                <p className="text-[10px] text-muted-foreground">{item.sub}</p>
                            </div>
                            <Download className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                        </button>
                    ))}
                </div>

                {/* Transfer batch history */}
                {transferBatches.length > 0 && showDownloads && (
                    <div className="mt-4 border-t border-border pt-4">
                        <p className="text-xs font-semibold text-muted-foreground mb-2">{t('kr_kec9db4ec_ked8c8cec_kec839dec_')}</p>
                        <div className="space-y-1">
                            {transferBatches.map((b) => (
                                <div key={b.id} className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                    <span>{fmtDate(b.createdAt)}</span>
                                    <span>{t('publishPage.personCount', { count: b.totalCount })} / {fmt(Number(b.totalAmount))}</span>
                                    <StatusBadge status={b.status}>{batchStatusLabel(b.status)}</StatusBadge>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </section>

            {/* Approval History */}
            {approvalHistory.length > 0 && (
                <section className={CARD_STYLES.padded} aria-labelledby="publish-approval-history-title">
                    <h2 id="publish-approval-history-title" className={cn(TYPOGRAPHY.cardTitle, 'mb-4')}>{t('approve_kec9db4eb')}</h2>
                    <div className="space-y-3">
                        {approvalHistory.map((step) => {
                            // 기존 결함 교정 (의도된 개선): PENDING이 destructive(반려)로 표시되던 것을
                            // STATUS_MAP(PENDING→warning) 기반 StatusBadge로 자연 교정
                            const stepLabel = step.status === 'APPROVED'
                                ? t('publishPage.approvedLabel')
                                : step.status === 'REJECTED'
                                    ? t('publishPage.rejectedLabel')
                                    : t('publishPage.pendingLabel')
                            return (
                                <div key={step.stepNumber} className="flex items-start gap-3">
                                    <div className={cn(
                                        'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full',
                                        step.status === 'APPROVED'
                                            ? 'bg-tertiary/10'
                                            : step.status === 'REJECTED'
                                                ? 'bg-destructive/10'
                                                : 'bg-warning-bright/15',
                                    )}>
                                        {step.status === 'APPROVED'
                                            ? <CheckCircle2 className="h-3.5 w-3.5 text-[#006b39]" aria-hidden="true" />
                                            : step.status === 'REJECTED'
                                                ? <XCircle className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
                                                : <Clock className="h-3.5 w-3.5 text-ctr-warning" aria-hidden="true" />}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="text-sm font-medium text-foreground">{step.approverName ?? step.roleRequired}</p>
                                            <StatusBadge status={step.status}>{stepLabel}</StatusBadge>
                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Clock className="h-3 w-3" aria-hidden="true" />
                                                {fmtDate(step.decidedAt)}
                                            </span>
                                        </div>
                                        {step.comment && (
                                            <p className="text-sm text-muted-foreground mt-0.5 italic">&quot;{step.comment}&quot;</p>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </section>
            )}
        </div>
    )
}
