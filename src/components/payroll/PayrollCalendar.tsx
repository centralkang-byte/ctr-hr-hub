'use client'

// ═══════════════════════════════════════════════════════════
// PayrollCalendar.tsx — 급여 캘린더 (법인별 마감일/지급일 + D-day 알림)
// ═══════════════════════════════════════════════════════════

import { AlertTriangle, CheckCircle2, Clock, Calendar } from 'lucide-react'
import type  from './PayrollPipeline'

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

// ─── D-Day formatter ─────────────────────────────────────────

function formatDDay(d: number | null, isCompleted: boolean): React.ReactNode {
    if (isCompleted) return <span className="text-emerald-600 text-xs">완료</span>
    if (d == null) return <span className="text-[#999] text-xs">—</span>
    if (d < 0) return <span className="text-destructive text-xs font-bold">{Math.abs(d)}일 초과</span>
    if (d === 0) return <span className="text-destructive text-xs font-bold">D-Day</span>
    return <span className={`text-xs font-semibold ${d <= 3 ? 'text-amber-600' : 'text-[#555]'}`}>D-{d}</span>
}

function formatDate(iso: string | null): string {
    if (!iso) return '—'
    const d = new Date(iso)
    return `${d.getMonth() + 1}/${d.getDate()}`
}

// ─── Status label ────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
    NOT_STARTED: '미시작',
    DRAFT: '준비중',
    ATTENDANCE_CLOSED: '근태 마감',
    CALCULATING: '자동 계산중',
    ADJUSTMENT: '수동 조정중',
    REVIEW: '이상 검토중',
    PENDING_APPROVAL: '결재 대기중',
    APPROVED: '승인 완료',
    PAID: '지급 완료',
    CANCELLED: '취소',
}

// ─── Main Component ──────────────────────────────────────────

interface Props {
    entries: CalendarEntry[]
    yearMonth: string
}

export default function PayrollCalendar({ entries, yearMonth }: Props) {
    const [yr, mn] = yearMonth.split('-')
    const hasAlerts = entries.some((e) => e.alertLevel !== 'normal' && e.currentStep < 7)

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
                <span className="text-sm font-semibold text-foreground">{yr}년 {mn}월 급여 캘린더</span>
                {hasAlerts && (
                    <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700">
                        <AlertTriangle className="h-3 w-3" /> 마감 임박
                    </span>
                )}
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-[10px] text-[#999] uppercase tracking-wider">
                            <th className="text-left pb-2 font-semibold">법인</th>
                            <th className="text-center pb-2 font-semibold">마감일</th>
                            <th className="text-center pb-2 font-semibold">지급일</th>
                            <th className="text-center pb-2 font-semibold">현재 단계</th>
                            <th className="text-center pb-2 font-semibold">잔여일</th>
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
                                    className={`${alertRed ? 'bg-destructive/5' : alertAmber ? 'bg-amber-50' : ''} transition-colors`}
                                >
                                    <td className="py-2 pr-4">
                                        <span className={`text-sm font-semibold ${alertRed ? 'text-destructive' : alertAmber ? 'text-amber-700' : 'text-foreground'}`}>
                                            {entry.companyCode ?? entry.companyName}
                                        </span>
                                    </td>
                                    <td className="py-2 text-center text-[#555]">
                                        {formatDate(entry.closingDeadline)}
                                    </td>
                                    <td className="py-2 text-center text-[#555]">
                                        {formatDate(entry.payDay)}
                                    </td>
                                    <td className="py-2 text-center">
                                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${isCompleted ? 'bg-emerald-100 text-emerald-700' :
                                                entry.status === 'PENDING_APPROVAL' ? 'bg-indigo-100 text-primary/90' :
                                                    entry.status === 'REVIEW' ? 'bg-amber-100 text-amber-700' :
                                                        entry.status === 'NOT_STARTED' || entry.status === 'DRAFT' ? 'bg-muted text-muted-foreground/60' :
                                                            'bg-primary/10 text-primary'
                                            }`}>
                                            {isCompleted ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                            {STATUS_LABELS[entry.status] ?? entry.status}
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
                            : 'bg-amber-100 text-amber-700'
                        }`}
                >
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    <span>
                        <strong>{entry.companyCode}</strong>:{' '}
                        {entry.dDayClosing != null && entry.dDayClosing <= 0
                            ? `마감일이 ${Math.abs(entry.dDayClosing)}일 지났습니다. 즉시 처리해 주세요.`
                            : entry.dDayClosing != null && entry.dDayClosing === 0
                                ? `오늘이 마감일입니다. 빠른 처리가 필요합니다.`
                                : `마감일까지 ${entry.dDayClosing}일 남았습니다. (현재: ${STATUS_LABELS[entry.status] ?? entry.status})`
                        }
                    </span>
                </div>
            ))}
        </div>
    )
}
