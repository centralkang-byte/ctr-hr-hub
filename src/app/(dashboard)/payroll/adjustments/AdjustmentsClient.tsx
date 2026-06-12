'use client'

import { useTranslations, useLocale } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/hooks/use-toast'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
    Plus,
    Trash2,
    FileText,
    ChevronDown,
    ArrowRight,
    CheckCircle2,
        Upload,
    Search,
    Filter,
    Layers,
} from 'lucide-react'
import type { SessionUser } from '@/types'
import { BUTTON_VARIANTS, BUTTON_SIZES, TABLE_STYLES, TYPOGRAPHY } from '@/lib/styles'
import { cn } from '@/lib/utils'
import { WdDrawer, WdField, WdRow } from '@/components/shared/WdDrawer'
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

const ADJUSTMENT_TYPE_LABEL_KEYS: Record<string, string> = {
    RETROACTIVE: 'adj.typeRetroactive',
    BONUS: 'adj.typeBonus',
    CORRECTION: 'adj.typeRegular',
    DEDUCTION: 'adj.typeDeduction',
    OTHER: 'adj.typeOther',
}

const ADJUSTMENT_TYPE_COLORS: Record<string, { color: string; bg: string }> = {
    RETROACTIVE: { color: '#047857', bg: '#D1FAE5' },
    BONUS: { color: '#1D4ED8', bg: '#DBEAFE' },
    CORRECTION: { color: '#B45309', bg: '#FEF3C7' },
    DEDUCTION: { color: '#DC2626', bg: '#FEE2E2' },
    OTHER: { color: '#6B7280', bg: '#F3F4F6' },
}

const CATEGORIES = [
    { value: 'BASE_PAY', labelKey: 'adj.categoryBasePay' },
    { value: 'OVERTIME_PAY', labelKey: 'adj.categoryOvertimePay' },
    { value: 'MEAL_ALLOWANCE', labelKey: 'adj.categoryMealAllowance' },
    { value: 'TRANSPORT_ALLOWANCE', labelKey: 'adj.categoryTransportAllowance' },
    { value: 'POSITION_ALLOWANCE', labelKey: 'adj.categoryPositionAllowance' },
    { value: 'BONUS', labelKey: 'adj.categoryBonus' },
    { value: 'BENEFITS', labelKey: 'adj.categoryBenefits' },
    { value: 'OTHER', labelKey: 'adj.categoryOther' },
]

const CATEGORY_DISPLAY_KEYS: Record<string, string> = {
    'BASE_PAY': 'adj.categoryBasePay',
    'OVERTIME_PAY': 'adj.categoryOvertimePay',
    'MEAL_ALLOWANCE': 'adj.categoryMealAllowance',
    'TRANSPORT_ALLOWANCE': 'adj.categoryTransportAllowance',
    'POSITION_ALLOWANCE': 'adj.categoryPositionAllowance',
    'BONUS': 'adj.categoryBonus',
    'BENEFITS': 'adj.categoryBenefits',
    'OTHER': 'adj.categoryOther',
    // Legacy Korean values for backwards compat during migration
    '기본급': 'adj.categoryBasePay',
    '초과근무수당': 'adj.categoryOvertimePay',
    '식대': 'adj.categoryMealAllowance',
    '교통비': 'adj.categoryTransportAllowance',
    '직책수당': 'adj.categoryPositionAllowance',
    '상여금': 'adj.categoryBonus',
    '복리후생': 'adj.categoryBenefits',
    '기타': 'adj.categoryOther',
}

export default function AdjustmentsClient({user }: Props) {
  const t = useTranslations('payroll')
  const tCommon = useTranslations('common')
  const locale = useLocale()
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
        category: 'BASE_PAY',
        description: '',
        amount: '',
        evidenceUrl: '',
    })

    const formatKRW = (amount: number) => {
        const abs = Math.abs(amount)
        const sign = amount >= 0 ? '+' : '−'
        return `${sign}${abs.toLocaleString(locale)}${t('adj.currencyUnit')}`
    }

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
                setForm({ employeeId: '', type: 'BONUS', category: 'BASE_PAY', description: '', amount: '', evidenceUrl: '' })
                await loadAdjustments(selectedRun.id)
                await loadRuns()
            } else {
                const err = await res.json()
                toast({ title: err.error?.message ?? t('adj.errorAddingAdjustment'), variant: 'destructive' })
            }
        } finally {
            setSubmitting(false)
        }
    }

    const handleDelete = async (adjustmentId: string) => {
        if (!selectedRun) return
        confirm({ variant: 'destructive', title: t('adj.confirmDelete'), onConfirm: async () => {
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
        confirm({ title: t('adj.confirmComplete'), onConfirm: async () => {
            setCompleting(true)
            try {
                const res = await fetch(`/api/v1/payroll/${selectedRun.id}/adjustments/complete`, {
                    method: 'POST',
                })
                if (res.ok) {
                    const json = await res.json()
                    toast({ title: t('adj.completeSuccess', { count: json.data?.anomalyCount ?? 0 }) })
                    setSelectedRun(null)
                    await loadRuns()
                } else {
                    const err = await res.json()
                toast({ title: err.error?.message ?? t('adj.errorGeneral'), variant: 'destructive' })
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
        <div className="mx-auto max-w-7xl space-y-4 p-4">
            {/* Header (ALL-1: proto .page-h — 56px 아이콘 타일 + pageTitle + 13px 부제) */}
            <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px] bg-accent text-primary">
                    <Layers className="h-[26px] w-[26px]" aria-hidden="true" />
                </div>
                <div>
                    <h1 className={TYPOGRAPHY.pageTitle}>{t('adjustmentsTitle')}</h1>
                    <p className="mt-1 text-[13px] text-muted-foreground">{t('adj.subtitle')}</p>
                </div>
            </div>

            <div className="flex gap-5">
                {/* Left: Run Selector */}
                <div className="w-72 flex-shrink-0">
                    <div className="bg-card rounded-xl border border-border overflow-hidden">
                        <div className="px-4 py-3 border-b border-border">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('adj.targetRunList')}</p>
                        </div>
                        <div className="divide-y divide-border">
                            {runs.length === 0 ? (
                                <EmptyState icon={Layers} sub="" size="sm" />
                            ) : (
                                runs.map((run) => (
                                    <button
                                        key={run.id}
                                        onClick={() => setSelectedRun(run)}
                                        className={`w-full text-left px-4 py-3 transition-colors hover:bg-muted ${selectedRun?.id === run.id ? 'bg-tertiary-container/10 border-l-2 border-primary' : ''
                                            }`}
                                    >
                                        <p className="text-sm font-semibold text-foreground">{run.yearMonth}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">{t('adj.adjustmentCount', { count: run.adjustmentCount })}</p>
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
                                <p className="text-muted-foreground">{t('adj.selectRunPrompt')}</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Summary cards */}
                            {summary && (
                                <div className="grid grid-cols-3 gap-4 mb-4">
                                    <div className="bg-card rounded-xl shadow-sm border border-border p-6">
                                        <p className={cn(TYPOGRAPHY.statLabel, "mb-1")}>{t('adj.totalAdd')}</p>
                                        <p className="text-xl font-bold tabular-nums text-[#006b39]">
                                            +{summary.totalAdd.toLocaleString(locale)}{t('adj.currencyUnit')}
                                        </p>
                                    </div>
                                    <div className="bg-card rounded-xl shadow-sm border border-border p-6">
                                        <p className={cn(TYPOGRAPHY.statLabel, "mb-1")}>{t('adj.totalDeduct')}</p>
                                        <p className="text-xl font-bold tabular-nums text-[#b71824]">
                                            −{summary.totalDeduct.toLocaleString(locale)}{t('adj.currencyUnit')}
                                        </p>
                                    </div>
                                    <div className="bg-card rounded-xl shadow-sm border border-border p-6">
                                        <p className={cn(TYPOGRAPHY.statLabel, "mb-1")}>{t('adj.netAdjustment')}</p>
                                        <p className={cn("text-xl font-bold tabular-nums", summary.netAdjustment >= 0 ? 'text-[#006b39]' : 'text-[#b71824]')}>
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
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
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
                                        <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                        <select
                                            value={filterType}
                                            onChange={(e) => setFilterType(e.target.value)}
                                            className="pl-8 pr-6 py-2 border border-border rounded-lg text-sm bg-card appearance-none focus:border-primary"
                                        >
                                            <option value="ALL">{t('adj.allTypes')}</option>
                                            {Object.entries(ADJUSTMENT_TYPE_LABEL_KEYS).map(([k, labelKey]) => (
                                                <option key={k} value={k}>{t(labelKey)}</option>
                                            ))}
                                        </select>
                                        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setShowForm(true)}
                                        className={`flex items-center gap-1.5 px-4 py-2 ${BUTTON_VARIANTS.primary} rounded-lg text-sm font-semibold transition-colors`}
                                    >
                                        <Plus size={15} />
                                        {t('adj.addAdjustment')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleComplete}
                                        disabled={completing}
                                        className={cn(BUTTON_VARIANTS.secondary, BUTTON_SIZES.md, "inline-flex items-center gap-1.5 disabled:opacity-50")}
                                    >
                                        <ArrowRight size={15} />
                                        {completing ? t('processing') : t('adj.switchToReview')}
                                    </button>
                                </div>
                            </div>

                            {/* Adjustments table */}
                            <div className="bg-card rounded-xl border border-border overflow-hidden">
                                {loading ? (
                                    <div className="flex items-center justify-center h-40 text-muted-foreground">{tCommon('loading')}</div>
                                ) : filteredAdj.length === 0 ? (
                                    <EmptyState icon={FileText} sub="" />
                                ) : (
                                    <div className={TABLE_STYLES.wrapper}>
                                        <table className={TABLE_STYLES.table}>
                                            <thead>
                                                <tr className={TABLE_STYLES.header}>
                                                    <th className={TABLE_STYLES.headerCell}>{t('adj.colEmployee')}</th>
                                                    <th className={TABLE_STYLES.headerCell}>{t('adj.colType')}</th>
                                                    <th className={TABLE_STYLES.headerCell}>{t('adj.colCategory')}</th>
                                                    <th className={TABLE_STYLES.headerCell}>{t('description')}</th>
                                                    <th className={cn(TABLE_STYLES.headerCell, "text-right")}>{t('amount')}</th>
                                                    <th className={cn(TABLE_STYLES.headerCell, "text-right")}>{t('adj.colEvidence')}</th>
                                                    <th className={TABLE_STYLES.headerCell} />
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredAdj.map((adj) => {
                                                    const typeColors = ADJUSTMENT_TYPE_COLORS[adj.type] ?? ADJUSTMENT_TYPE_COLORS.OTHER
                                                    return (
                                                    <tr key={adj.id} className={cn(TABLE_STYLES.row, "group")}>
                                                        <td className={TABLE_STYLES.cell}>
                                                            <p className="font-medium text-foreground">{adj.employee.name}</p>
                                                            <p className="text-xs text-muted-foreground">{adj.employee.email}</p>
                                                        </td>
                                                        <td className={TABLE_STYLES.cell}>
                                                            <span
                                                                className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold"
                                                                style={{ color: typeColors.color, background: typeColors.bg }}
                                                            >
                                                                {t(ADJUSTMENT_TYPE_LABEL_KEYS[adj.type] ?? 'adj.typeOther')}
                                                            </span>
                                                        </td>
                                                        <td className={TABLE_STYLES.cell}>
                                                            <span className="text-muted-foreground">{t(CATEGORY_DISPLAY_KEYS[adj.category] ?? 'adj.categoryOther')}</span>
                                                        </td>
                                                        <td className={TABLE_STYLES.cell}>
                                                            <span className="text-foreground line-clamp-1">{adj.description}</span>
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
                                                                    {t('adj.viewFile')}
                                                                </a>
                                                            ) : (
                                                                <span className="text-xs text-border">—</span>
                                                            )}
                                                        </td>
                                                        <td className={cn(TABLE_STYLES.cell, "text-right")}>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDelete(adj.id)}
                                                                aria-label={tCommon('delete')}
                                                                className="p-1.5 hover:bg-destructive/10 hover:text-destructive text-border rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Add Adjustment Drawer (ADJ-4: 중앙 Dialog → WdDrawer §5.4. state·handleCreate는 부모 유지) */}
            <WdDrawer
                open={showForm}
                onClose={() => setShowForm(false)}
                closeDisabled={submitting}
                eyebrow={t('adjustmentsTitle')}
                title={t('adj.addAdjustment')}
                secondary={{ label: t('cancel'), onClick: () => setShowForm(false), disabled: submitting }}
                primary={{
                    label: submitting ? tCommon('saving') : t('save'),
                    onClick: () => formRef.current?.requestSubmit(),
                    disabled: submitting,
                    icon: submitting ? undefined : <CheckCircle2 size={14} />,
                }}
            >
                {/* foot 버튼이 form 밖 → requestSubmit + hidden submit으로 required 검증·Enter 제출 보존 */}
                <form ref={formRef} onSubmit={handleCreate} className="flex flex-col gap-4">
                    <WdField label={t('adj.targetEmployee')} required htmlFor="adj-employee">
                        <div className="relative">
                            <select
                                id="adj-employee"
                                value={form.employeeId}
                                onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))}
                                required
                                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card focus:border-primary focus:ring-2 focus:ring-primary/10 appearance-none"
                            >
                                <option value="">{t('adj.selectEmployee')}</option>
                                {employees.map((e) => (
                                    <option key={e.id} value={e.id}>{e.name} ({e.email})</option>
                                ))}
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        </div>
                    </WdField>

                    <WdRow>
                        <WdField label={t('adj.typeLabel')} htmlFor="adj-type">
                            <div className="relative">
                                <select
                                    id="adj-type"
                                    value={form.type}
                                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as Adjustment['type'] }))}
                                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card focus:border-primary appearance-none"
                                >
                                    {Object.entries(ADJUSTMENT_TYPE_LABEL_KEYS).map(([k, labelKey]) => (
                                        <option key={k} value={k}>{t(labelKey)}</option>
                                    ))}
                                </select>
                                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                            </div>
                        </WdField>
                        <WdField label={t('adj.categoryLabel')} htmlFor="adj-category">
                            <div className="relative">
                                <select
                                    id="adj-category"
                                    value={form.category}
                                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card focus:border-primary appearance-none"
                                >
                                    {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{t(c.labelKey)}</option>)}
                                </select>
                                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                            </div>
                        </WdField>
                    </WdRow>

                    <WdField label={t('amount_krw')} hint={t('adj.amountHint')} required htmlFor="adj-amount">
                        <input
                            id="adj-amount"
                            type="number"
                            value={form.amount}
                            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                            required
                            placeholder={t('adj.exampleAmount')}
                            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10"
                        />
                    </WdField>

                    <WdField label={t('adj.reasonLabel')} required htmlFor="adj-desc">
                        <textarea
                            id="adj-desc"
                            value={form.description}
                            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                            required
                            rows={2}
                            placeholder={tCommon('placeholderAdjustmentReason')}
                            className="w-full px-3 py-2 border border-border rounded-lg text-sm resize-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                        />
                    </WdField>

                    <WdField label={t('adj.evidenceUrlLabel')} hint={t('adj.optional')} htmlFor="adj-evidence">
                        <input
                            id="adj-evidence"
                            type="url"
                            value={form.evidenceUrl}
                            onChange={(e) => setForm((f) => ({ ...f, evidenceUrl: e.target.value }))}
                            placeholder="https://..."
                            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10"
                        />
                    </WdField>

                    <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
                </form>
            </WdDrawer>
      <ConfirmDialog {...dialogProps} />
        </div>
    )
}
