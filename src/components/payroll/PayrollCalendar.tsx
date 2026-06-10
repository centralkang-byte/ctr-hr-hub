'use client'

// ═══════════════════════════════════════════════════════════
// PayrollCalendar.tsx — 급여 일정 테이블 (법인별 마감/지급일 + D-day)
// Wave 1: 프로토 PayrollMgmtPage "N월 일정" 테이블 정합 —
// 법인/마감일/지급일/현재 단계/상태 chip/D-day(지급일 기준).
// 마감 임박·지연 경고 배너(마감 기준)는 기능 보존.
// ═══════════════════════════════════════════════════════════

import { useTranslations, useLocale } from 'next-intl'
import { AlertTriangle } from 'lucide-react'
import { Badge, type BadgeVariant } from '@/components/ui/badge'
import { TYPOGRAPHY } from '@/lib/styles'
import { STATUS_STEP_SUB_KEY, type PipelineEntry } from './PayrollPipeline'

// ─── Types ──────────────────────────────────────────────────

type CalendarEntry = Pick<
    PipelineEntry,
    'companyCode' | 'companyName' | 'closingDeadline' | 'payDay' | 'dDayClosing' | 'dDayPay' | 'alertLevel' | 'currentStep' | 'status'
>

// ─── Status label keys ───────────────────────────────────────

const STATUS_LABEL_KEYS: Record<string, string> = {
    NOT_STARTED: 'status.notStarted',
    DRAFT: 'status.draft',
    ATTENDANCE_CLOSED: 'status.attendanceClosed',
    CALCULATING: 'status.calculating',
    ADJUSTMENT: 'status.adjustment',
    REVIEW: 'status.review',
    PENDING_APPROVAL: 'status.pendingApproval',
    APPROVED: 'status.approved',
    PAID: 'status.paid',
    CANCELLED: 'status.cancelled',
}

// 상태 chip — proto chip danger/warning/success/info → Badge 시맨틱 variant
function statusVariant(entry: CalendarEntry, isCompleted: boolean): BadgeVariant {
    if (isCompleted) return 'success'
    if (entry.alertLevel === 'red') return 'error'
    if (entry.alertLevel === 'amber') return 'warning'
    if (entry.status === 'NOT_STARTED' || entry.status === 'DRAFT') return 'neutral'
    return 'info'
}

// ─── Main Component ──────────────────────────────────────────

interface Props {
    entries: CalendarEntry[]
    yearMonth: string
}

export default function PayrollCalendar({ entries, yearMonth }: Props) {
    const t = useTranslations('payroll')
    const locale = useLocale()
    const [yr, mnRaw] = yearMonth.split('-')
    const mn = String(Number(mnRaw))  // "06" → "6" (제목 제로패딩 제거)
    const hasAlerts = entries.some((e) => e.alertLevel !== 'normal' && e.currentStep < 7)

    // D-Day 포맷터 (지급일 기준 — proto)
    function formatDDay(d: number | null, isCompleted: boolean): React.ReactNode {
        if (isCompleted) return <span className="text-xs text-[#006b39]">{t('calendar.complete')}</span>
        if (d == null) return <span className="text-xs text-muted-foreground">—</span>
        if (d < 0) return <span className="text-xs font-bold text-destructive">{t('calendar.overdue', { days: Math.abs(d) })}</span>
        if (d === 0) return <span className="text-xs font-bold text-destructive">D-Day</span>
        return <span className={`text-xs font-semibold ${d <= 3 ? 'text-ctr-warning' : 'text-muted-foreground'}`}>D-{d}</span>
    }

    // 날짜 포맷터 (로케일 기반)
    function formatDate(iso: string | null): string {
        if (!iso) return '—'
        const d = new Date(iso)
        return new Intl.DateTimeFormat(locale, { month: 'numeric', day: 'numeric' }).format(d)
    }

    // Sort: by closingDay ascending
    const sorted = [...entries].sort((a, b) => {
        const da = a.closingDeadline ? new Date(a.closingDeadline).getDate() : 99
        const db = b.closingDeadline ? new Date(b.closingDeadline).getDate() : 99
        return da - db
    })

    return (
        <div className="space-y-3">
            {/* Card head — proto: title + sub */}
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border pb-3">
                <h2 className={TYPOGRAPHY.cardTitle}>{t('calendar.title', { year: yr, month: mn })}</h2>
                <span className="text-xs text-muted-foreground">{t('calendar.subtitle')}</span>
                {hasAlerts && (
                    <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-wd-orange-soft px-2 py-0.5 text-xs text-wd-orange-ink">
                        <AlertTriangle className="h-3 w-3" aria-hidden="true" /> {t('calendar.deadlineAlert')}
                    </span>
                )}
            </div>

            {/* Table — proto .tbl */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            <th className="pb-2 text-left font-semibold">{t('calendar.company')}</th>
                            <th className="pb-2 text-left font-semibold">{t('calendar.closingDate')}</th>
                            <th className="pb-2 text-left font-semibold">{t('calendar.payDate')}</th>
                            <th className="pb-2 text-left font-semibold">{t('calendar.currentStep')}</th>
                            <th className="pb-2 text-left font-semibold">{t('calendar.status')}</th>
                            <th className="pb-2 text-right font-semibold">{t('calendar.remainingDays')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {sorted.map((entry) => {
                            const isCompleted = entry.currentStep >= 7
                            const stepSubKey = STATUS_STEP_SUB_KEY[entry.status] ?? null

                            return (
                                <tr key={entry.companyCode ?? entry.companyName}>
                                    <td className="py-2 pr-4 font-semibold text-foreground">
                                        {entry.companyName}
                                    </td>
                                    <td className="py-2 pr-4 font-mono text-xs tabular-nums text-muted-foreground">
                                        {formatDate(entry.closingDeadline)}
                                    </td>
                                    <td className="py-2 pr-4 font-mono text-xs font-semibold tabular-nums text-foreground">
                                        {formatDate(entry.payDay)}
                                    </td>
                                    <td className="py-2 pr-4 text-xs text-muted-foreground">
                                        {stepSubKey ? t(stepSubKey) : '—'}
                                    </td>
                                    <td className="py-2 pr-4">
                                        <Badge variant={statusVariant(entry, isCompleted)}>
                                            {STATUS_LABEL_KEYS[entry.status] ? t(STATUS_LABEL_KEYS[entry.status]) : entry.status}
                                        </Badge>
                                    </td>
                                    <td className="py-2 text-right font-mono tabular-nums">
                                        {formatDDay(entry.dDayPay, isCompleted)}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* 마감 경고 배너 (마감일 기준 — 기능 보존) */}
            {sorted.filter((e) => e.alertLevel !== 'normal' && e.currentStep < 7).map((entry) => (
                <div
                    key={entry.companyCode ?? entry.companyName}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${entry.alertLevel === 'red'
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-wd-orange-soft text-wd-orange-ink'
                        }`}
                >
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                    <span>
                        {entry.dDayClosing != null && entry.dDayClosing < 0
                            ? t('calendar.deadlineAlertOverdue', { company: entry.companyCode ?? entry.companyName, days: Math.abs(entry.dDayClosing) })
                            : entry.dDayClosing != null && entry.dDayClosing === 0
                                ? t('calendar.deadlineAlertToday', { company: entry.companyCode ?? entry.companyName })
                                : t('calendar.deadlineAlertSoon', { company: entry.companyCode ?? entry.companyName, days: entry.dDayClosing ?? 0, status: STATUS_LABEL_KEYS[entry.status] ? t(STATUS_LABEL_KEYS[entry.status]) : entry.status })
                        }
                    </span>
                </div>
            ))}
        </div>
    )
}
