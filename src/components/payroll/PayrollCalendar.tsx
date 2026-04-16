'use client'

// ═══════════════════════════════════════════════════════════
// PayrollCalendar.tsx — 급여 캘린더 (법인별 마감일/지급일 + D-day 알림)
// ═══════════════════════════════════════════════════════════

import { useTranslations, useLocale } from 'next-intl'
import { AlertTriangle, CheckCircle2, Clock, Calendar } from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────

interface CalendarEntry {
    companyCode: string | null
    companyName: string
    closingDeadline: string | null
    payDay: string | null
    dDayClosing: number | null
    dDayPay: number | null
    alertLevel: 'red' | 'amber' | 'normal'
    currentStep: number
    status: string
}

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

// ─── Main Component ──────────────────────────────────────────

interface Props {
    entries: CalendarEntry[]
    yearMonth: string
}

export default function PayrollCalendar({ entries, yearMonth }: Props) {
    const t = useTranslations('payroll')
    const locale = useLocale()
    const [yr, mn] = yearMonth.split('-')
    const hasAlerts = entries.some((e) => e.alertLevel !== 'normal' && e.currentStep < 7)

    // D-Day 포맷터
    function formatDDay(d: number | null, isCompleted: boolean): React.ReactNode {
        if (isCompleted) return <span className="text-emerald-600 text-xs">{t('calendar.complete')}</span>
        if (d == null) return <span className="text-muted-foreground text-xs">—</span>
        if (d < 0) return <span className="text-destructive text-xs font-bold">{t('calendar.overdue', { days: Math.abs(d) })}</span>
        if (d === 0) return <span className="text-destructive text-xs font-bold">D-Day</span>
        return <span className={`text-xs font-semibold ${d <= 3 ? 'text-amber-600' : 'text-muted-foreground'}`}>D-{d}</span>
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
            {/* Header */}
            <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">{t('calendar.title', { year: yr, month: mn })}</span>
                {hasAlerts && (
                    <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-500/15 text-amber-700">
                        <AlertTriangle className="h-3 w-3" /> {t('calendar.deadlineAlert')}
                    </span>
                )}
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-[10px] text-muted-foreground uppercase tracking-wider">
                            <th className="text-left pb-2 font-semibold">{t('calendar.company')}</th>
                            <th className="text-center pb-2 font-semibold">{t('calendar.closingDate')}</th>
                            <th className="text-center pb-2 font-semibold">{t('calendar.payDate')}</th>
                            <th className="text-center pb-2 font-semibold">{t('calendar.currentStep')}</th>
                            <th className="text-center pb-2 font-semibold">{t('calendar.remainingDays')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {sorted.map((entry) => {
                            const isCompleted = entry.currentStep >= 7
                            const alertRed = entry.alertLevel === 'red' && !isCompleted
                            const alertAmber = entry.alertLevel === 'amber' && !isCompleted

                            return (
                                <tr
                                    key={entry.companyCode}
                                    className={`${alertRed ? 'bg-destructive/5' : alertAmber ? 'bg-amber-500/10' : ''} transition-colors`}
                                >
                                    <td className="py-2 pr-4">
                                        <span className={`text-sm font-semibold ${alertRed ? 'text-destructive' : alertAmber ? 'text-amber-700' : 'text-foreground'}`}>
                                            {entry.companyCode ?? entry.companyName}
                                        </span>
                                    </td>
                                    <td className="py-2 text-center text-muted-foreground">
                                        {formatDate(entry.closingDeadline)}
                                    </td>
                                    <td className="py-2 text-center text-muted-foreground">
                                        {formatDate(entry.payDay)}
                                    </td>
                                    <td className="py-2 text-center">
                                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${isCompleted ? 'bg-emerald-500/15 text-emerald-700' :
                                                entry.status === 'PENDING_APPROVAL' ? 'bg-indigo-500/15 text-primary/90' :
                                                    entry.status === 'REVIEW' ? 'bg-amber-500/15 text-amber-700' :
                                                        entry.status === 'NOT_STARTED' || entry.status === 'DRAFT' ? 'bg-muted text-muted-foreground/60' :
                                                            'bg-primary/10 text-primary'
                                            }`}>
                                            {isCompleted ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                            {STATUS_LABEL_KEYS[entry.status] ? t(STATUS_LABEL_KEYS[entry.status]) : entry.status}
                                        </span>
                                    </td>
                                    <td className="py-2 text-center">
                                        {formatDDay(entry.dDayClosing, isCompleted)}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* Alert banners */}
            {sorted.filter((e) => e.alertLevel !== 'normal' && e.currentStep < 7).map((entry) => (
                <div
                    key={entry.companyCode}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${entry.alertLevel === 'red'
                            ? 'bg-destructive/10 text-destructive'
                            : 'bg-amber-500/15 text-amber-700'
                        }`}
                >
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    <span>
                        {entry.dDayClosing != null && entry.dDayClosing <= 0
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
