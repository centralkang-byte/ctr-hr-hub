'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
    Plus,
    Trash2,
    FileText,
    ChevronDown,
    ArrowRight,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Upload,
    Search,
    Filter,
    Layers,
} from 'lucide-react'
import type { SessionUser } from '@/types'
import { BUTTON_VARIANTS, MODAL_STYLES, TABLE_STYLES } from '@/lib/styles'
import { cn } from '@/lib/utils'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'

interface Employee {
    id: string
    name: string
    email: string
}

interface Adjustment {
    id: string
    payrollRunId: string
    employeeId: string
    employee: Employee
    type: 'RETROACTIVE' | 'BONUS' | 'CORRECTION' | 'DEDUCTION' | 'OTHER'
    category: string
    description: string
    amount: number
    evidenceUrl: string | null
    createdById: string
    createdAt: string
}

interface AdjustmentSummary {
    totalAdd: number
    totalDeduct: number
    netAdjustment: number
    count: number
}

interface PayrollRun {
    id: string
    companyId: string
    yearMonth: string
    status: string
    adjustmentCount: number
    adjustmentTotal: number
    anomalyCount: number
}

interface Props {
    user: SessionUser
}

const ADJUSTMENT_TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
    RETROACTIVE: { label: '소급 지급', color: '#047857', bg: '#D1FAE5' },
    BONUS: { label: '보너스', color: '#1D4ED8', bg: '#DBEAFE' },
    CORRECTION: { label: '정상', color: '#B45309', bg: '#FEF3C7' },
    DEDUCTION: { label: '공제합계', color: '#DC2626', bg: '#FEE2E2' },
    OTHER: { label: '기타', color: '#6B7280', bg: '#F3F4F6' },
}

const CATEGORIES = ['기본급', '초과근무수당', '식대', '교통비', '직책수당', '상여금', '복리후생', '기타']

function TypeBadge({ type }: { type: string }) {
    const info = ADJUSTMENT_TYPE_LABELS[type] ?? ADJUSTMENT_TYPE_LABELS.OTHER
    return (
        <span
            className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold"
            style={{ color: info.color, background: info.bg }}
        >
            {info.label}
        </span>
    )
}

function formatKRW(amount: number) {
    const abs = Math.abs(amount)
    const sign = amount >= 0 ? '+' : '−'
    return `${sign}${abs.toLocaleString('ko-KR')}원`
}

export default function AdjustmentsClient({user }: Props) {
  const t = useTranslations('payroll')
  const tCommon = useTranslations('common')
  const { confirm, dialogProps } = useConfirmDialog()

    const [runs, setRuns] = useState<PayrollRun[]>([])
    const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null)
    const [adjustments, setAdjustments] = useState<Adjustment[]>([])
    const [summary, setSummary] = useState<AdjustmentSummary | null>(null)
    const [employees, setEmployees] = useState<Employee[]>([])
    const [loading, setLoading] = useState(false)
    const [showForm, setShowForm] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [completing, setCompleting] = useState(false)
    const [search, setSearch] = useState('')
    const [filterType, setFilterType] = useState<string>('ALL')

    const formRef = useRef<HTMLFormElement>(null)
    const [form, setForm] = useState({
        employeeId: '',
        type: 'BONUS' as Adjustment['type'],
        category: t('baseSalary'),
        description: '',
        amount: '',
        evidenceUrl: '',
    })

    // PayrollRun 목록 로드 (ADJUSTMENT 상태)
    const loadRuns = useCallback(async () => {
        const res = await fetch(
            `/api/v1/payroll/runs?companyId=${user.companyId}&status=ADJUSTMENT&limit=20`,
        )
        if (res.ok) {
            const json = await res.json()
            setRuns(json.data?.items ?? json.data ?? [])
        }
    }, [user.companyId])

    // 조정 목록 로드
    const loadAdjustments = useCallback(async (runId: string) => {
        setLoading(true)
        try {
            const res = await fetch(`/api/v1/payroll/${runId}/adjustments`)
            if (res.ok) {
                const json = await res.json()
                setAdjustments(json.data?.adjustments ?? [])
                setSummary(json.data?.summary ?? null)
            }
        } finally {
            setLoading(false)
        }
    }, [])

    // 직원 목록 로드
    const loadEmployees = useCallback(async () => {
        const res = await fetch(`/api/v1/employees?companyId=${user.companyId}&limit=200`)
        if (res.ok) {
            const json = await res.json()
            setEmployees((json.data?.items ?? json.data ?? []).map((e: { id: string; name: string; email: string }) => ({ id: e.id, name: e.name, email: e.email })))
        }
    }, [user.companyId])

    useEffect(() => {
        loadRuns()
        loadEmployees()
    }, [loadRuns, loadEmployees])

    useEffect(() => {
        if (selectedRun) loadAdjustments(selectedRun.id)
    }, [selectedRun, loadAdjustments])

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedRun) return
        setSubmitting(true)
        try {
            const res = await fetch(`/api/v1/payroll/${selectedRun.id}/adjustments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    amount: Number(form.amount),
                    evidenceUrl: form.evidenceUrl || undefined,
                }),
            })
            if (res.ok) {
                setShowForm(false)
                setForm({ employeeId: '', type: 'BONUS', category: t('baseSalary'), description: '', amount: '', evidenceUrl: '' })
                await loadAdjustments(selectedRun.id)
                await loadRuns()
            } else {
                const err = await res.json()
                toast({ title: err.error?.message ?? '조정 추가 중 오류가 발생했습니다.', variant: 'destructive' })
            }
        } finally {
            setSubmitting(false)
        }
    }

    const handleDelete = async (adjustmentId: string) => {
        if (!selectedRun) return
        confirm({ variant: 'destructive', title: t('kr_kec9db4_keca1b0ec_ked95adeb_ke'), onConfirm: async () => {
            const res = await fetch(`/api/v1/payroll/${selectedRun.id}/adjustments/${adjustmentId}`, {
                method: 'DELETE',
            })
            if (res.ok) {
                await loadAdjustments(selectedRun.id)
                await loadRuns()
            }
        }})
    }

    const handleComplete = async () => {
        if (!selectedRun) return
        confirm({ title: t('kr_keca1b0ec_kec9984eb_kec9db4ec_'), onConfirm: async () => {
            setCompleting(true)
            try {
                const res = await fetch(`/api/v1/payroll/${selectedRun.id}/adjustments/complete`, {
                    method: 'POST',
                })
                if (res.ok) {
                    const json = await res.json()
                    toast({ title: `이상 검토로 전환 완료.\n이상 항목: ${json.data?.anomalyCount ?? 0}건` })
                    setSelectedRun(null)
                    await loadRuns()
                } else {
                    const err = await res.json()
                toast({ title: err.error?.message ?? '오류가 발생했습니다.', variant: 'destructive' })
            }
        } finally {
            setCompleting(false)
        }
    }})
    }

    const filteredAdj = adjustments
        .filter((a) => {
            const matchSearch =
                !search ||
                a.employee.name.includes(search) ||
                a.description.toLowerCase().includes(search.toLowerCase())
            const matchType = filterType === 'ALL' || a.type === filterType
            return matchSearch && matchType
        })

    return (
        <div className="p-6 bg-background min-h-screen">
            {/* Header */}
            <div className="mb-6">
                <nav className="text-xs text-[#999] mb-1">{t('kr_keab889ec_kec8898eb_keca1b0ec')}</nav>
                <h1 className="text-2xl font-bold text-foreground tracking-tight">{t('adjustmentsTitle')}</h1>
                <p className="text-sm text-[#666] mt-0.5">{t('kr_kec868cea_keca780ea_kebb3b4eb_')}</p>
            </div>

            <div className="flex gap-5">
                {/* Left: Run Selector */}
                <div className="w-72 flex-shrink-0">
                    <div className="bg-card rounded-xl border border-border overflow-hidden">
                        <div className="px-4 py-3 border-b border-border">
                            <p className="text-xs font-semibold text-[#666] uppercase tracking-wider">{t('kr_keca1b0ec_keb8c80ea_keab889ec')}</p>
                        </div>
                        <div className="divide-y divide-border">
                            {runs.length === 0 ? (
                                <div className="px-4 py-8 text-center">
                                    <Layers size={24} className="text-border mx-auto mb-2" />
                                    <EmptyState />
                                </div>
                            ) : (
                                runs.map((run) => (
                                    <button
                                        key={run.id}
                                        onClick={() => setSelectedRun(run)}
                                        className={`w-full text-left px-4 py-3 transition-colors hover:bg-muted ${selectedRun?.id === run.id ? 'bg-tertiary-container/10 border-l-2 border-primary' : ''
                                            }`}
                                    >
                                        <p className="text-sm font-semibold text-foreground">{run.yearMonth}</p>
                                        <p className="text-xs text-[#999] mt-0.5">조정 {run.adjustmentCount}건</p>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Main content */}
                <div className="flex-1 min-w-0">
                    {!selectedRun ? (
                        <div className="bg-card rounded-xl border border-border flex items-center justify-center h-64">
                            <div className="text-center">
                                <FileText size={32} className="text-border mx-auto mb-3" />
                                <p className="text-[#999]">{t('kr_keab889ec_kec8ba4ed_kec84a0ed')}</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Summary cards */}
                            {summary && (
                                <div className="grid grid-cols-3 gap-4 mb-4">
                                    <div className="bg-card rounded-xl shadow-sm border border-border p-6">
                                        <p className="text-xs text-[#666] mb-1">{t('add_ked95a9ea')}</p>
                                        <p className="text-xl font-bold text-emerald-600">
                                            +{summary.totalAdd.toLocaleString()}원
                                        </p>
                                    </div>
                                    <div className="bg-card rounded-xl shadow-sm border border-border p-6">
                                        <p className="text-xs text-[#666] mb-1">{t('kr_keab3b5ec_ked95a9ea')}</p>
                                        <p className="text-xl font-bold text-red-500">
                                            −{summary.totalDeduct.toLocaleString()}원
                                        </p>
                                    </div>
                                    <div className="bg-card rounded-xl shadow-sm border border-border p-6">
                                        <p className="text-xs text-[#666] mb-1">{t('kr_kec889c_keca1b0ec')}</p>
                                        <p className={`text-xl font-bold ${summary.netAdjustment >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                            {formatKRW(summary.netAdjustment)}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Toolbar */}
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    {/* Search */}
                                    <div className="relative">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999]" />
                                        <input
                                            type="text"
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            placeholder={tCommon('searchPlaceholder')}
                                            className="pl-8 pr-3 py-2 border border-border rounded-lg text-sm bg-card focus:border-primary focus:ring-2 focus:ring-primary/10 w-48"
                                        />
                                    </div>
                                    {/* Type filter */}
                                    <div className="relative">
                                        <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999]" />
                                        <select
                                            value={filterType}
                                            onChange={(e) => setFilterType(e.target.value)}
                                            className="pl-8 pr-6 py-2 border border-border rounded-lg text-sm bg-card appearance-none focus:border-primary"
                                        >
                                            <option value="ALL">{t('all_kec9ca0ed')}</option>
                                            {Object.entries(ADJUSTMENT_TYPE_LABELS).map(([k, v]) => (
                                                <option key={k} value={k}>{v.label}</option>
                                            ))}
                                        </select>
                                        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#999] pointer-events-none" />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setShowForm(true)}
                                        className={`flex items-center gap-1.5 px-4 py-2 ${BUTTON_VARIANTS.primary} rounded-lg text-sm font-semibold transition-colors`}
                                    >
                                        <Plus size={15} />
                                        {t('kr_keca1b0ec_add')}
                                    </button>
                                    <button
                                        onClick={handleComplete}
                                        disabled={completing}
                                        className="flex items-center gap-1.5 px-4 py-2 border border-border hover:bg-muted text-[#333] rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                    >
                                        <ArrowRight size={15} />
                                        {completing ? t('processing') : '이상 검토로 전환'}
                                    </button>
                                </div>
                            </div>

                            {/* Adjustments table */}
                            <div className="bg-card rounded-xl border border-border overflow-hidden">
                                {loading ? (
                                    <div className="flex items-center justify-center h-40 text-[#999]">{tCommon('loading')}</div>
                                ) : filteredAdj.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-40">
                                        <FileText size={28} className="text-border mb-2" />
                                        <EmptyState />
                                    </div>
                                ) : (
                                    <div className={TABLE_STYLES.wrapper}>
                                        <table className={TABLE_STYLES.table}>
                                            <thead>
                                                <tr className={TABLE_STYLES.header}>
                                                    <th className={TABLE_STYLES.headerCell}>{t('kr_keca781ec')}</th>
                                                    <th className={TABLE_STYLES.headerCell}>{t('kr_kec9ca0ed')}</th>
                                                    <th className={TABLE_STYLES.headerCell}>{t('kr_kecb9b4ed')}</th>
                                                    <th className={TABLE_STYLES.headerCell}>{t('description')}</th>
                                                    <th className={cn(TABLE_STYLES.headerCell, "text-right")}>{t('amount')}</th>
                                                    <th className={cn(TABLE_STYLES.headerCell, "text-right")}>{t('kr_keca69deb')}</th>
                                                    <th className={TABLE_STYLES.headerCell} />
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredAdj.map((adj) => (
                                                    <tr key={adj.id} className={cn(TABLE_STYLES.row, "group")}>
                                                        <td className={TABLE_STYLES.cell}>
                                                            <p className="font-medium text-foreground">{adj.employee.name}</p>
                                                            <p className="text-xs text-[#999]">{adj.employee.email}</p>
                                                        </td>
                                                        <td className={TABLE_STYLES.cell}>
                                                            <TypeBadge type={adj.type} />
                                                        </td>
                                                        <td className={TABLE_STYLES.cell}>
                                                            <span className="text-[#555]">{adj.category}</span>
                                                        </td>
                                                        <td className={TABLE_STYLES.cell}>
                                                            <span className="text-[#333] line-clamp-1">{adj.description}</span>
                                                        </td>
                                                        <td className={cn(TABLE_STYLES.cell, "text-right")}>
                                                            <span className={`font-semibold tabular-nums ${adj.amount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                                {formatKRW(adj.amount)}
                                                            </span>
                                                        </td>
                                                        <td className={cn(TABLE_STYLES.cell, "text-right")}>
                                                            {adj.evidenceUrl ? (
                                                                <a
                                                                    href={adj.evidenceUrl}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                                                >
                                                                    <Upload size={11} />
                                                                    {t('kr_ked8c8cec')}
                                                                </a>
                                                            ) : (
                                                                <span className="text-xs text-border">—</span>
                                                            )}
                                                        </td>
                                                        <td className={cn(TABLE_STYLES.cell, "text-right")}>
                                                            <button
                                                                onClick={() => handleDelete(adj.id)}
                                                                className="p-1.5 hover:bg-destructive/10 hover:text-destructive text-border rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Add Adjustment Modal */}
            {showForm && (
                <div className={MODAL_STYLES.container}>
                    <div className="bg-card rounded-xl shadow-lg max-w-lg w-full mx-4 overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                            <h2 className="text-lg font-bold text-foreground">{t('kr_keca1b0ec_add')}</h2>
                            <button onClick={() => setShowForm(false)} className="p-1 hover:bg-muted rounded-lg">
                                <XCircle size={20} className="text-[#999]" />
                            </button>
                        </div>
                        <form ref={formRef} onSubmit={handleCreate} className="px-6 py-5 space-y-4">
                            {/* Employee */}
                            <div>
                                <label className="block text-xs font-semibold text-[#444] mb-1.5">{t('kr_keb8c80ec_keca781ec')}</label>
                                <div className="relative">
                                    <select
                                        value={form.employeeId}
                                        onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))}
                                        required
                                        className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card focus:border-primary focus:ring-2 focus:ring-primary/10 appearance-none"
                                    >
                                        <option value="">{t('kr_keca781ec_kec84a0ed')}</option>
                                        {employees.map((e) => (
                                            <option key={e.id} value={e.id}>{e.name} ({e.email})</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#999] pointer-events-none" />
                                </div>
                            </div>

                            {/* Type + Category row */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-[#444] mb-1.5">유형 *</label>
                                    <div className="relative">
                                        <select
                                            value={form.type}
                                            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as Adjustment['type'] }))}
                                            className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card focus:border-primary appearance-none"
                                        >
                                            {Object.entries(ADJUSTMENT_TYPE_LABELS).map(([k, v]) => (
                                                <option key={k} value={k}>{v.label}</option>
                                            ))}
                                        </select>
                                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#999] pointer-events-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-[#444] mb-1.5">{t('kr_keab889ec_ked95adeb')}</label>
                                    <div className="relative">
                                        <select
                                            value={form.category}
                                            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                                            className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card focus:border-primary appearance-none"
                                        >
                                            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#999] pointer-events-none" />
                                    </div>
                                </div>
                            </div>

                            {/* Amount */}
                            <div>
                                <label className="block text-xs font-semibold text-[#444] mb-1.5">
                                    {t('amount_krw')}
                                    <span className="font-normal text-[#999] ml-1">{t('kr_kec9691ec_add_kec9d8cec_keab3b')}</span>
                                </label>
                                <input
                                    type="number"
                                    value={form.amount}
                                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                                    required
                                    placeholder="예: 500000 또는 -200000"
                                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-xs font-semibold text-[#444] mb-1.5">{t('kr_kec82acec_description')}</label>
                                <textarea
                                    value={form.description}
                                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                                    required
                                    rows={2}
                                    placeholder={tCommon('placeholderAdjustmentReason')}
                                    className="w-full px-3 py-2 border border-border rounded-lg text-sm resize-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                                />
                            </div>

                            {/* Evidence URL */}
                            <div>
                                <label className="block text-xs font-semibold text-[#444] mb-1.5">
                                    {t('kr_keca69deb_url')}
                                    <span className="font-normal text-[#999] ml-1">{t('kr_kec84a0ed')}</span>
                                </label>
                                <input
                                    type="url"
                                    value={form.evidenceUrl}
                                    onChange={(e) => setForm((f) => ({ ...f, evidenceUrl: e.target.value }))}
                                    placeholder="https://..."
                                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10"
                                />
                            </div>

                            {/* Form actions */}
                            <div className="flex items-center justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowForm(false)}
                                    className="px-4 py-2 border border-border hover:bg-muted text-[#333] rounded-lg text-sm"
                                >
                                    {t('cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className={`flex items-center gap-1.5 px-4 py-2 ${BUTTON_VARIANTS.primary} rounded-lg text-sm font-semibold disabled:opacity-50`}
                                >
                                    {submitting ? '저장 중...' : (
                                        <>
                                            <CheckCircle2 size={14} />
                                            {t('save')}
                                          </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
      <ConfirmDialog {...dialogProps} />
        </div>
    )
}
