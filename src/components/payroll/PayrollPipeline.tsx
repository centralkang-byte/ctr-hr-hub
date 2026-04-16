'use client'

// ═══════════════════════════════════════════════════════════
// PayrollPipeline.tsx — GP#3 급여 파이프라인 시각화
// 6단계 파이프라인에 법인별 상태 배지 표시
// ═══════════════════════════════════════════════════════════

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { CheckCircle2, RotateCcw, Clock, Minus } from 'lucide-react'

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
}

// ─── Pipeline Step Config ────────────────────────────────────

// Maps visual column (1-6) → step ranges from STATUS_TO_STEP
const STEPS = [
    { col: 1, labelKey: 'pipeline.step1', sublabelKey: 'pipeline.step1Sub', minStep: 2, targetStatus: ['ATTENDANCE_CLOSED'] },
    { col: 2, labelKey: 'pipeline.step2', sublabelKey: 'pipeline.step2Sub', minStep: 3, targetStatus: ['CALCULATING', 'ADJUSTMENT'] },
    { col: 3, labelKey: 'pipeline.step2_5', sublabelKey: 'pipeline.step2_5Sub', minStep: 4, targetStatus: ['ADJUSTMENT'] },
    { col: 4, labelKey: 'pipeline.step3', sublabelKey: 'pipeline.step3Sub', minStep: 5, targetStatus: ['REVIEW'] },
    { col: 5, labelKey: 'pipeline.step4', sublabelKey: 'pipeline.step4Sub', minStep: 6, targetStatus: ['PENDING_APPROVAL'] },
    { col: 6, labelKey: 'pipeline.step5', sublabelKey: 'pipeline.step5Sub', minStep: 7, targetStatus: ['APPROVED', 'PAID'] },
]

// ─── Badge style per pipeline step ──────────────────────────

type StepState = 'done' | 'active' | 'pending' | 'not_started'

function getStepState(entry: PipelineEntry, col: number): StepState {
    const step = entry.currentStep
    if (step === 0) return 'not_started'
    if (step >= col + 1) return 'done'        // past this column
    if (col <= step) return 'active'          // currently in this range
    return 'pending'
}

const STATE_CONFIG: Record<StepState, { bg: string; text: string; border: string }> = {
    done: { bg: 'bg-emerald-500/15', text: 'text-emerald-700', border: 'border-emerald-200' },
    active: { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/20' },
    pending: { bg: 'bg-muted', text: 'text-muted-foreground/60', border: 'border-border' },
    not_started: { bg: 'bg-muted/50', text: 'text-muted-foreground/40', border: 'border-border' },
}

function StepStateIcon({ state }: { state: StepState }) {
    if (state === 'done') return <CheckCircle2 className="h-3 w-3" />
    if (state === 'active') return <RotateCcw className="h-3 w-3" />
    if (state === 'pending') return <Clock className="h-3 w-3" />
    return <Minus className="h-3 w-3" />
}

const STATE_LABEL_KEYS: Record<StepState, string> = {
    done: 'pipeline.done',
    active: 'pipeline.active',
    pending: 'pipeline.pending',
    not_started: 'pipeline.notStarted',
}

// ─── Navigate on badge click ─────────────────────────────────

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

    return (
        <div className="overflow-x-auto">
            <div className="min-w-[700px]">
                {/* Header row */}
                <div className="grid grid-cols-7 gap-2 mb-3">
                    <div className="text-xs font-semibold text-muted-foreground py-1">{t('pipeline.company')}</div>
                    {STEPS.map((step) => (
                        <div key={step.col} className="text-center">
                            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t(step.labelKey)}</div>
                            <div className="text-[11px] text-muted-foreground">{t(step.sublabelKey)}</div>
                        </div>
                    ))}
                </div>

                {/* Divider */}
                <div className="h-px bg-border mb-3" />

                {/* Pipeline rows */}
                <div className="space-y-2">
                    {pipelines.map((entry) => (
                        <div key={entry.companyId} className="grid grid-cols-7 gap-2 items-center">
                            {/* Company label */}
                            <div>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${entry.alertLevel === 'red' ? 'bg-destructive/10 text-destructive' :
                                    entry.alertLevel === 'amber' ? 'bg-amber-500/15 text-amber-700' :
                                        'text-foreground'
                                    }`}>
                                    {entry.companyCode ?? entry.companyName}
                                </span>
                            </div>

                            {/* Step badges */}
                            {STEPS.map((step) => {
                                const state = getStepState(entry, step.col)
                                const cfg = STATE_CONFIG[state]
                                const url = getClickUrl(entry, step.col)
                                const isAnomaly = step.col === 4 && state === 'active' && entry.anomalyCount > 0 && !entry.allAnomaliesResolved
                                const isApproval = step.col === 5 && state === 'active' && entry.pendingApproval

                                return (
                                    <div key={step.col} className="flex justify-center">
                                        <button
                                            onClick={() => url && router.push(url)}
                                            disabled={!url}
                                            title={url ? `${entry.companyCode} ${t(step.sublabelKey)} →` : undefined}
                                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all
                        ${cfg.bg} ${cfg.text} ${cfg.border}
                        ${url ? 'hover:opacity-80 cursor-pointer hover:shadow-sm' : 'cursor-default'}
                        ${isAnomaly ? 'ring-1 ring-amber-500' : ''}
                        ${isApproval ? 'ring-1 ring-primary animate-pulse' : ''}
                      `}
                                        >
                                            <StepStateIcon state={state} />
                                            <span className="hidden sm:inline">{t(STATE_LABEL_KEYS[state])}</span>
                                            {isAnomaly && (
                                                <span className="ml-0.5 bg-amber-500/100 text-white text-[9px] rounded-full px-1">{entry.anomalyCount}</span>
                                            )}
                                            {isApproval && entry.approvalStep != null && (
                                                <span className="ml-0.5 text-[9px] opacity-70">{entry.approvalStep}/{entry.approvalTotal}</span>
                                            )}
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    ))}
                </div>

                {/* Legend */}
                <div className="mt-4 pt-3 border-t border-border flex items-center gap-5 text-xs text-muted-foreground">
                    {(['done', 'active', 'pending', 'not_started'] as StepState[]).map((state) => {
                        const cfg = STATE_CONFIG[state]
                        return (
                            <span key={state} className="flex items-center gap-1">
                                <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                                    <StepStateIcon state={state} />
                                </span>
                                {t(STATE_LABEL_KEYS[state])}
                            </span>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
