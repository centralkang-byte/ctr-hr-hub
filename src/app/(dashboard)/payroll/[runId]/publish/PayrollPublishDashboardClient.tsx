'use client'

import { useTranslations, useLocale } from 'next-intl'
import { toast } from '@/hooks/use-toast'

// ═══════════════════════════════════════════════════════════
// GP#3-C: HR 급여 발행 대시보드 — /payroll/[runId]/publish
// 발행 현황 + 열람률 + 다운로드 + 승인 이력 + 재알림
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
    ArrowLeft, CheckCircle2, Eye, EyeOff, Download,
    Bell, FileSpreadsheet, FileText, CreditCard,
    Users, DollarSign, Loader2, ChevronDown,
    Clock, XCircle,
} from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import { CARD_STYLES } from '@/lib/styles'

// ─── Types ──────────────────────────────────────────────

interface PublishStatus {
    run: {
        id: string
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
            <div className="h-3 w-full bg-border rounded-full overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-[#5E81F4] to-[#A855F7]"
                    style={{ width: `${pct}%` }}
                />
            </div>
            <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {t('publishPage.viewed', { count: viewed })}</span>
                <span className="flex items-center gap-1"><EyeOff className="h-3 w-3" /> {t('publishPage.unviewed', { count: total - viewed })}</span>
            </div>
        </div>
    )
}

// ─── Main Component ──────────────────────────────────────

interface Props {
    user: SessionUser
    runId: string
}

export default function PayrollPublishDashboardClient({user: _user, runId }: Props) {
  const t = useTranslations('payroll')
  const locale = useLocale()

  const fmt = (n: number | string | null | undefined) => {
      if (n == null) return '—'
      return t('fmt.amountWon', { n: Number(n).toLocaleString() })
  }
  const fmtDate = (d: string | null | undefined) => {
      if (!d) return '—'
      return new Date(d).toLocaleString(locale, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

    const router = useRouter()
    const [data, setData] = useState<PublishStatus | null>(null)
    const [loading, setLoading] = useState(true)
    const [notifying, setNotifying] = useState(false)
    const [notifyResult, setNotifyResult] = useState<string | null>(null)
    const [showDownloads, setShowDownloads] = useState(false)

    const fetchData = useCallback(async () => {
        try {
            const res = await apiClient.get<PublishStatus>(`/api/v1/payroll/${runId}/publish-status`)
            setData(res.data)
        } catch (err) {
            toast({ title: t('publishPage.loadFailed'), description: err instanceof Error ? err.message : '', variant: 'destructive' })
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

    const triggerDownload = (url: string) => {
        const a = document.createElement('a')
        a.href = url
        a.click()
    }

    if (loading || !data) {
        return (
            <div className="p-6 flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    const { run, payslipStats, transferBatches, approvalHistory } = data
    const isApproved = ['APPROVED', 'PAID'].includes(run.status)

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3">
                <button onClick={() => router.push('/payroll')} className="text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em]">{t('kr_kebb09ced_status')}</h1>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-sm text-muted-foreground">{run.yearMonth}</span>
                        {isApproved && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="h-3 w-3" /> {t('kr_kebb09ced_complete')}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: t('kr_kecb49d_kec9db8ec'), value: `${run.headcount ?? 0}명`, icon: <Users className="h-4 w-4 text-primary/90" /> },
                    { label: t('netPay'), value: fmt(Number(run.totalNet ?? 0)), icon: <DollarSign className="h-4 w-4 text-emerald-600" /> },
                    { label: t('persons_kec84b8ec_kebb09ced'), value: `${payslipStats.total}건`, icon: <FileText className="h-4 w-4 text-primary" /> },
                    { label: t('kr_kec97b4eb'), value: `${payslipStats.viewed}명 (${payslipStats.viewRate}%)`, icon: <Eye className="h-4 w-4 text-violet-500" /> },
                ].map((kpi) => (
                    <div key={kpi.label} className={CARD_STYLES.padded}>
                        <div className="flex items-center justify-between mb-1">
                            <p className="text-xs text-muted-foreground">{kpi.label}</p>
                            {kpi.icon}
                        </div>
                        <p className="text-sm font-bold text-foreground leading-tight">{kpi.value}</p>
                    </div>
                ))}
            </div>

            {/* Payslip View Rate */}
            <div className={`${CARD_STYLES.kpi} space-y-4`}>
                <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-foreground">{t('payStub_kec97b4eb_status')}</h2>
                    <button
                        onClick={handleNotifyUnread}
                        disabled={notifying || payslipStats.unviewed === 0}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted disabled:opacity-40"
                    >
                        {notifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                        {t('publishPage.resendReminder', { count: payslipStats.unviewed })}
                    </button>
                </div>
                <ViewProgressBar viewed={payslipStats.viewed} total={payslipStats.total} />
                {notifyResult && (
                    <p className="text-xs text-emerald-600 bg-emerald-500/15 rounded-lg px-3 py-2">{notifyResult}</p>
                )}
            </div>

            {/* Downloads */}
            <div className={CARD_STYLES.padded}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-foreground">{t('kr_ked8c8cec_keb8ba4ec')}</h2>
                    <button
                        onClick={() => setShowDownloads(!showDownloads)}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        <ChevronDown className={`h-4 w-4 transition-transform ${showDownloads ? 'rotate-180' : ''}`} />
                    </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        {
                            label: t('kr_kec9d80ed_kec9db4ec'),
                            sub: 'CSV',
                            icon: <CreditCard className="h-5 w-5 text-emerald-600" />,
                            bg: 'bg-emerald-500/15',
                            disabled: !isApproved,
                            url: `/api/v1/payroll/${runId}/export/transfer`,
                        },
                        {
                            label: t('kr_keab889ec'),
                            sub: 'Excel',
                            icon: <FileSpreadsheet className="h-5 w-5 text-primary/90" />,
                            bg: 'bg-indigo-500/15',
                            disabled: false,
                            url: `/api/v1/payroll/${runId}/export/ledger`,
                        },
                        {
                            label: t('kr_keca084ec_keb8c80eb_kebb984ea'),
                            sub: 'Excel',
                            icon: <FileSpreadsheet className="h-5 w-5 text-amber-500" />,
                            bg: 'bg-amber-500/15',
                            disabled: false,
                            url: `/api/v1/payroll/${runId}/export/comparison`,
                        },
                        {
                            label: t('kr_kec9db8ea_keca084ed'),
                            sub: 'Excel',
                            icon: <FileText className="h-5 w-5 text-violet-500" />,
                            bg: 'bg-purple-500/10',
                            disabled: false,
                            url: `/api/v1/payroll/${runId}/export/journal`,
                        },
                    ].map((item) => (
                        <button
                            key={item.label}
                            onClick={() => !item.disabled && triggerDownload(item.url)}
                            disabled={item.disabled}
                            className={`flex flex-col items-center gap-2 p-4 rounded-xl border border-border transition-colors ${item.disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-background cursor-pointer'}`}
                        >
                            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${item.bg}`}>
                                {item.icon}
                            </div>
                            <div className="text-center">
                                <p className="text-xs font-semibold text-foreground">{item.label}</p>
                                <p className="text-[10px] text-muted-foreground">{item.sub}</p>
                            </div>
                            <Download className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                    ))}
                </div>

                {/* Transfer batch history */}
                {transferBatches.length > 0 && showDownloads && (
                    <div className="mt-4 border-t border-border pt-4">
                        <p className="text-xs font-semibold text-muted-foreground mb-2">{t('kr_kec9db4ec_ked8c8cec_kec839dec_')}</p>
                        <div className="space-y-1">
                            {transferBatches.map((b) => (
                                <div key={b.id} className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>{fmtDate(b.createdAt)}</span>
                                    <span>{b.totalCount}명 / {fmt(Number(b.totalAmount))}</span>
                                    <span className="text-muted-foreground">{b.status}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Approval History */}
            {approvalHistory.length > 0 && (
                <div className={CARD_STYLES.padded}>
                    <h2 className="font-semibold text-foreground mb-4">{t('approve_kec9db4eb')}</h2>
                    <div className="space-y-3">
                        {approvalHistory.map((step) => (
                            <div key={step.stepNumber} className="flex items-start gap-3">
                                <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${step.status === 'APPROVED' ? 'bg-emerald-500/15' : 'bg-destructive/10'}`}>
                                    {step.status === 'APPROVED'
                                        ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                        : <XCircle className="h-3.5 w-3.5 text-destructive" />
                                    }
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="text-sm font-medium text-foreground">{step.approverName ?? step.roleRequired}</p>
                                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${step.status === 'APPROVED' ? 'bg-emerald-500/15 text-emerald-700' : 'bg-destructive/10 text-destructive'}`}>
                                            {step.status === 'APPROVED' ? t('publishPage.approvedLabel') : t('publishPage.rejectedLabel')}
                                        </span>
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {fmtDate(step.decidedAt)}
                                        </span>
                                    </div>
                                    {step.comment && (
                                        <p className="text-sm text-muted-foreground mt-0.5 italic">&quot;{step.comment}&quot;</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
