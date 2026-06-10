'use client'

// ═══════════════════════════════════════════════════════════
// PayrollPipeline.tsx — GP#3 급여 파이프라인 시각화
// 법인 행 × 6단계 셀 그리드 + 지급일 칼럼 (Wave 1: 프로토
// page-placeholder-real.jsx PayrollMgmtPage 셀 그리드 정합).
// 기능 보존: 셀 클릭 내비·anomaly 카운트·결재 단계 표시.
// ═══════════════════════════════════════════════════════════

import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { Check, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────

export interface PipelineEntry {
    companyId: string
    companyCode: string | null
    companyName: string
    payrollRunId: string | null
    currentStep: number
    status: string
    anomalyCount: number
    allAnomaliesResolved: boolean
    pendingApproval: boolean
    approvalStep: number | null
    approvalTotal: number | null
    alertLevel: 'red' | 'amber' | 'normal'
    // 일정 필드 — dashboard API 응답 계약 (null = 미설정, '—' 렌더)
    closingDeadline: string | null
    payDay: string | null
    dDayClosing: number | null
    dDayPay: number | null
}

// ─── Pipeline Step Config ────────────────────────────────────

// Maps visual column (1-6) → step ranges from STATUS_TO_STEP
export const STEPS = [
    { col: 1, labelKey: 'pipeline.step1', sublabelKey: 'pipeline.step1Sub', minStep: 2, targetStatus: ['ATTENDANCE_CLOSED'] },
    { col: 2, labelKey: 'pipeline.step2', sublabelKey: 'pipeline.step2Sub', minStep: 3, targetStatus: ['CALCULATING', 'ADJUSTMENT'] },
    { col: 3, labelKey: 'pipeline.step2_5', sublabelKey: 'pipeline.step2_5Sub', minStep: 4, targetStatus: ['ADJUSTMENT'] },
    { col: 4, labelKey: 'pipeline.step3', sublabelKey: 'pipeline.step3Sub', minStep: 5, targetStatus: ['REVIEW'] },
    { col: 5, labelKey: 'pipeline.step4', sublabelKey: 'pipeline.step4Sub', minStep: 6, targetStatus: ['PENDING_APPROVAL'] },
    { col: 6, labelKey: 'pipeline.step5', sublabelKey: 'pipeline.step5Sub', minStep: 7, targetStatus: ['APPROVED', 'PAID'] },
]

// ─── Step state ─────────────────────────────────────────────

type StepState = 'done' | 'active' | 'pending' | 'not_started'

function getStepState(entry: PipelineEntry, col: number): StepState {
    const step = entry.currentStep
    if (step === 0) return 'not_started'
    if (step >= col + 1) return 'done'        // past this column
    if (col <= step) return 'active'          // currently in this range
    return 'pending'
}

/** run 상태 → 현재 진행 단계 sublabel 키 (캘린더 "현재 단계" 칼럼 공용).
 *  currentStep 인덱스 기반 매핑은 한 단계 밀림 (CALCULATING=3 → STEPS[2]=수동 조정) — status 기준이 안전. */
export const STATUS_STEP_SUB_KEY: Record<string, string> = {
    DRAFT: 'pipeline.step1Sub',
    ATTENDANCE_CLOSED: 'pipeline.step2Sub',
    CALCULATING: 'pipeline.step2Sub',
    ADJUSTMENT: 'pipeline.step2_5Sub',
    REVIEW: 'pipeline.step3Sub',
    PENDING_APPROVAL: 'pipeline.step4Sub',
    APPROVED: 'pipeline.step5Sub',
    PAID: 'pipeline.step5Sub',
}

// ─── Cell styles (proto: done=green tint / current=alert색 보더 / future=dot) ───

const ALERT_ACTIVE_CLASS: Record<PipelineEntry['alertLevel'], string> = {
    red: 'border-[1.5px] border-destructive bg-destructive/10 text-destructive',
    amber: 'border-[1.5px] border-wd-orange bg-wd-orange-soft text-wd-orange-ink',
    normal: 'border-[1.5px] border-primary bg-primary/10 text-primary',
}

const STATE_LABEL_KEYS: Record<StepState, string> = {
    done: 'pipeline.done',
    active: 'pipeline.active',
    pending: 'pipeline.pending',
    not_started: 'pipeline.notStarted',
}

// ─── Navigate on cell click ──────────────────────────────────

function getClickUrl(entry: PipelineEntry, col: number): string | null {
    if (!entry.payrollRunId) return null
    const runId = entry.payrollRunId
    const state = getStepState(entry, col)

    // Only clickable if active or done
    if (state === 'pending' || state === 'not_started') return null

    switch (col) {
        case 1: return `/payroll/close-attendance`
        case 2: return `/payroll/${runId}/review`
        case 3: return `/payroll/adjustments`
        case 4: return `/payroll/${runId}/review`
        case 5: return `/payroll/${runId}/approve`
        case 6: return `/payroll/${runId}/publish`
        default: return null
    }
}

// ─── Main Component ──────────────────────────────────────────

interface Props {
    pipelines: PipelineEntry[]
}

export default function PayrollPipeline({ pipelines }: Props) {
    const router = useRouter()
    const t = useTranslations('payroll')
    const locale = useLocale()

    const formatDate = (iso: string | null): string => {
        if (!iso) return '—'
        return new Intl.DateTimeFormat(locale, { month: 'numeric', day: 'numeric' }).format(new Date(iso))
    }

    return (
        <div className="overflow-x-auto">
            <div className="min-w-[860px]">
                {/* Header row — STEP 박스 (proto bg-sunk) */}
                <div className="mb-2.5 grid grid-cols-[150px_repeat(6,minmax(72px,1fr))_88px] items-end gap-1.5">
                    <div className="pb-1 text-xs font-semibold text-muted-foreground">{t('pipeline.company')}</div>
                    {STEPS.map((step) => (
                        <div key={step.col} className="rounded-md bg-muted px-1 py-1.5 text-center">
                            <div className="font-mono text-[10px] tabular-nums tracking-wide text-muted-foreground/70">{t(step.labelKey)}</div>
                            <div className="mt-0.5 text-[11px] font-semibold leading-tight text-muted-foreground">{t(step.sublabelKey)}</div>
                        </div>
                    ))}
                    <div className="pb-1 pr-1 text-right text-[11px] text-muted-foreground/70">{t('calendar.payDate')}</div>
                </div>

                {/* Pipeline rows */}
                <div className="space-y-1.5">
                    {pipelines.map((entry) => (
                        <div key={entry.companyId} className="grid grid-cols-[150px_repeat(6,minmax(72px,1fr))_88px] items-center gap-1.5">
                            {/* Company */}
                            <div className="min-w-0">
                                <div className="truncate text-[13px] font-semibold text-foreground">{entry.companyName}</div>
                                {entry.companyCode && (
                                    <div className="truncate font-mono text-[10.5px] tabular-nums text-muted-foreground/70">{entry.companyCode}</div>
                                )}
                            </div>

                            {/* Step cells */}
                            {STEPS.map((step) => {
                                const state = getStepState(entry, step.col)
                                const url = getClickUrl(entry, step.col)
                                const isAnomaly = step.col === 4 && state === 'active' && entry.anomalyCount > 0 && !entry.allAnomaliesResolved
                                const isApproval = step.col === 5 && state === 'active' && entry.pendingApproval

                                return (
                                    <button
                                        key={step.col}
                                        type="button"
                                        onClick={() => url && router.push(url)}
                                        disabled={!url}
                                        title={url ? `${entry.companyCode ?? entry.companyName} ${t(step.sublabelKey)} →` : undefined}
                                        aria-label={`${entry.companyName} ${t(step.sublabelKey)}: ${t(STATE_LABEL_KEYS[state])}`}
                                        className={cn(
                                            'flex h-8 w-full items-center justify-center gap-1 rounded-md',
                                            state === 'done' && 'border border-border bg-tertiary/10',
                                            state === 'active' && ALERT_ACTIVE_CLASS[entry.alertLevel],
                                            (state === 'pending' || state === 'not_started') && 'border border-border bg-muted/50',
                                            url
                                                ? 'cursor-pointer transition-all hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                                                : 'cursor-default',
                                        )}
                                    >
                                        {state === 'done' ? (
                                            <Check className="h-3.5 w-3.5 text-[#006b39]" strokeWidth={2.4} aria-hidden="true" />
                                        ) : state === 'active' ? (
                                            <Clock className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                                        ) : (
                                            <span className="h-1 w-1 rounded-full bg-muted-foreground/40" aria-hidden="true" />
                                        )}
                                        {isAnomaly && (
                                            <span className="rounded-full bg-wd-orange px-1 text-[9px] font-bold leading-[14px] text-white">
                                                {entry.anomalyCount}
                                            </span>
                                        )}
                                        {isApproval && entry.approvalStep != null && (
                                            <span className="font-mono text-[9px] font-semibold tabular-nums">
                                                {entry.approvalStep}/{entry.approvalTotal}
                                            </span>
                                        )}
                                    </button>
                                )
                            })}

                            {/* 지급일 + D-day */}
                            <div className="pr-1 text-right font-mono text-xs tabular-nums">
                                <div className="font-semibold text-foreground">{formatDate(entry.payDay)}</div>
                                {entry.currentStep >= 7 ? (
                                    <div className="text-[10px] text-[#006b39]">{t('calendar.complete')}</div>
                                ) : entry.dDayPay != null ? (
                                    <div className={cn('text-[10px]', entry.dDayPay <= 3 ? 'text-ctr-warning' : 'text-muted-foreground/70')}>
                                        {entry.dDayPay >= 0 ? `D-${entry.dDayPay}` : `D+${Math.abs(entry.dDayPay)}`}
                                    </div>
                                ) : (
                                    <div className="text-[10px] text-muted-foreground/70">—</div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Legend — proto 4종 (완료/진행 중/주의/이상) */}
                <div className="mt-4 flex items-center gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-sm border border-tertiary bg-tertiary/10" aria-hidden="true" />
                        {t('pipeline.done')}
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-sm border border-primary bg-primary/10" aria-hidden="true" />
                        {t('pipeline.active')}
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-sm border border-wd-orange bg-wd-orange-soft" aria-hidden="true" />
                        {t('pipeline.legendWarning')}
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-sm border border-destructive bg-destructive/10" aria-hidden="true" />
                        {t('pipeline.legendAlert')}
                    </span>
                </div>
            </div>
        </div>
    )
}
