'use client'

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
import { TABLE_STYLES } from '@/lib/styles'

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
    createdBy: string
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
    CORRECTION: { label: '정정', color: '#B45309', bg: '#FEF3C7' },
    DEDUCTION: { label: '공제', color: '#DC2626', bg: '#FEE2E2' },
    OTHER: { label: '기타', color: '#6B7280', bg: '#F3F4F6' },
}

const CATEGORIES = ['기본급', '초과근무수당', '식대', '교통비', '직책수당', '상여금', '복리후생', '기타']

function TypeBadge({ type }: { type: string }) {
    const t = ADJUSTMENT_TYPE_LABELS[type] ?? ADJUSTMENT_TYPE_LABELS.OTHER
    return (
        <span
            className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold"
            style={{ color: t.color, background: t.bg }}
        >
            {t.label}
        </span>
    )
}

function formatKRW(amount: number) {
    const abs = Math.abs(amount)
    const sign = amount >= 0 ? '+' : '−'
    return `${sign}${abs.toLocaleString('ko-KR')}원`
}

export default function AdjustmentsClient({ user }: Props) {
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
        category: '기본급',
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
                setForm({ employeeId: '', type: 'BONUS', category: '기본급', description: '', amount: '', evidenceUrl: '' })
                await loadAdjustments(selectedRun.id)
                await loadRuns()
            } else {
                const err = await res.json()
                alert(err.error?.message ?? '조정 추가 중 오류가 발생했습니다.')
            }
        } finally {
            setSubmitting(false)
        }
    }

    const handleDelete = async (adjustmentId: string) => {
        if (!selectedRun) return
        if (!confirm('이 조정 항목을 삭제하시겠습니까?')) return
        const res = await fetch(`/api/v1/payroll/${selectedRun.id}/adjustments/${adjustmentId}`, {
            method: 'DELETE',
        })
        if (res.ok) {
            await loadAdjustments(selectedRun.id)
            await loadRuns()
        }
    }

    const handleComplete = async () => {
        if (!selectedRun) return
        if (!confirm('조정을 완료하고 이상 검토 단계로 전환하시겠습니까? 이상 탐지 엔진이 실행됩니다.')) return
        setCompleting(true)
        try {
            const res = await fetch(`/api/v1/payroll/${selectedRun.id}/adjustments/complete`, {
                method: 'POST',
            })
            if (res.ok) {
                const json = await res.json()
                alert(`이상 검토로 전환 완료.\n이상 항목: ${json.data?.anomalyCount ?? 0}건`)
                setSelectedRun(null)
                await loadRuns()
            } else {
                const err = await res.json()
                alert(err.error?.message ?? '오류가 발생했습니다.')
            }
        } finally {
            setCompleting(false)
        }
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
        <div className="p-6 bg-[#FAFAFA] min-h-screen">
            {/* Header */}
            <div className="mb-6">
                <nav className="text-xs text-[#999] mb-1">급여 / 수동 조정</nav>
                <h1 className="text-2xl font-bold text-[#1A1A1A] tracking-tight">수동 조정</h1>
                <p className="text-sm text-[#666] mt-0.5">소급 지급, 보너스, 공제 등 수동 조정을 추가합니다.</p>
            </div>

            <div className="flex gap-5">
                {/* Left: Run Selector */}
                <div className="w-72 flex-shrink-0">
                    <div className="bg-white rounded-xl border border-[#E8E8E8] overflow-hidden">
                        <div className="px-4 py-3 border-b border-[#F5F5F5]">
                            <p className="text-xs font-semibold text-[#666] uppercase tracking-wider">조정 대기 급여</p>
                        </div>
                        <div className="divide-y divide-[#F5F5F5]">
                            {runs.length === 0 ? (
                                <div className="px-4 py-8 text-center">
                                    <Layers size={24} className="text-[#D4D4D4] mx-auto mb-2" />
                                    <p className="text-sm text-[#999]">수동 조정 단계의 급여 정산이 없습니다</p>
                                </div>
                            ) : (
                                runs.map((run) => (
                                    <button
                                        key={run.id}
                                        onClick={() => setSelectedRun(run)}
                                        className={`w-full text-left px-4 py-3 transition-colors hover:bg-[#F5F5F5] ${selectedRun?.id === run.id ? 'bg-[#F0FDF4] border-l-2 border-[#00C853]' : ''
                                            }`}
                                    >
                                        <p className="text-sm font-semibold text-[#1A1A1A]">{run.yearMonth}</p>
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
                        <div className="bg-white rounded-xl border border-[#E8E8E8] flex items-center justify-center h-64">
                            <div className="text-center">
                                <FileText size={32} className="text-[#D4D4D4] mx-auto mb-3" />
                                <p className="text-[#999]">급여 실행을 선택하세요</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Summary cards */}
                            {summary && (
                                <div className="grid grid-cols-3 gap-4 mb-4">
                                    <div className="bg-white rounded-xl border border-[#E8E8E8] p-4">
                                        <p className="text-xs text-[#666] mb-1">추가 합계</p>
                                        <p className="text-xl font-bold text-[#059669]">
                                            +{summary.totalAdd.toLocaleString()}원
                                        </p>
                                    </div>
                                    <div className="bg-white rounded-xl border border-[#E8E8E8] p-4">
                                        <p className="text-xs text-[#666] mb-1">공제 합계</p>
                                        <p className="text-xl font-bold text-[#EF4444]">
                                            −{summary.totalDeduct.toLocaleString()}원
                                        </p>
                                    </div>
                                    <div className="bg-white rounded-xl border border-[#E8E8E8] p-4">
                                        <p className="text-xs text-[#666] mb-1">순 조정액</p>
                                        <p className={`text-xl font-bold ${summary.netAdjustment >= 0 ? 'text-[#059669]' : 'text-[#EF4444]'}`}>
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
                                            placeholder="직원명, 설명 검색"
                                            className="pl-8 pr-3 py-2 border border-[#E0E0E0] rounded-lg text-sm bg-white focus:border-[#00C853] focus:ring-2 focus:ring-[#00C853]/10 w-48"
                                        />
                                    </div>
                                    {/* Type filter */}
                                    <div className="relative">
                                        <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999]" />
                                        <select
                                            value={filterType}
                                            onChange={(e) => setFilterType(e.target.value)}
                                            className="pl-8 pr-6 py-2 border border-[#E0E0E0] rounded-lg text-sm bg-white appearance-none focus:border-[#00C853]"
                                        >
                                            <option value="ALL">전체 유형</option>
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
                                        조정 추가
                                    </button>
                                    <button
                                        onClick={handleComplete}
                                        disabled={completing}
                                        className="flex items-center gap-1.5 px-4 py-2 border border-[#D4D4D4] hover:bg-[#F5F5F5] text-[#333] rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                    >
                                        <ArrowRight size={15} />
                                        {completing ? '처리 중...' : '이상 검토로 전환'}
                                    </button>
                                </div>
                            </div>

                            {/* Adjustments table */}
                            <div className="bg-white rounded-xl border border-[#E8E8E8] overflow-hidden">
                                {loading ? (
                                    <div className="flex items-center justify-center h-40 text-[#999]">로딩 중...</div>
                                ) : filteredAdj.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-40">
                                        <FileText size={28} className="text-[#D4D4D4] mb-2" />
                                        <p className="text-sm text-[#999]">조정 항목이 없습니다</p>
                                    </div>
                                ) : (
                                    <table className="w-full text-sm">
                                        <thead className="bg-[#FAFAFA] border-b border-[#E8E8E8]">
                                            <tr>
                                                <th className="text-left px-4 py-3 text-xs font-semibold text-[#666] uppercase tracking-wider">직원</th>
                                                <th className="text-left px-4 py-3 text-xs font-semibold text-[#666] uppercase tracking-wider">유형</th>
                                                <th className="text-left px-4 py-3 text-xs font-semibold text-[#666] uppercase tracking-wider">카테고리</th>
                                                <th className="text-left px-4 py-3 text-xs font-semibold text-[#666] uppercase tracking-wider">설명</th>
                                                <th className="text-right px-4 py-3 text-xs font-semibold text-[#666] uppercase tracking-wider">금액</th>
                                                <th className="text-right px-4 py-3 text-xs font-semibold text-[#666] uppercase tracking-wider">증빙</th>
                                                <th className="px-4 py-3" />
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#F5F5F5]">
                                            {filteredAdj.map((adj) => (
                                                <tr key={adj.id} className="hover:bg-[#FAFAFA] group transition-colors">
                                                    <td className="px-4 py-3">
                                                        <p className="font-medium text-[#1A1A1A]">{adj.employee.name}</p>
                                                        <p className="text-xs text-[#999]">{adj.employee.email}</p>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <TypeBadge type={adj.type} />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="text-[#555]">{adj.category}</span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="text-[#333] line-clamp-1">{adj.description}</span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <span className={`font-semibold tabular-nums ${adj.amount >= 0 ? 'text-[#059669]' : 'text-[#EF4444]'}`}>
                                                            {formatKRW(adj.amount)}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        {adj.evidenceUrl ? (
                                                            <a
                                                                href={adj.evidenceUrl}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="inline-flex items-center gap-1 text-xs text-[#1D4ED8] hover:underline"
                                                            >
                                                                <Upload size={11} />
                                                                파일
                                                            </a>
                                                        ) : (
                                                            <span className="text-xs text-[#D4D4D4]">—</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <button
                                                            onClick={() => handleDelete(adj.id)}
                                                            className="p-1.5 hover:bg-[#FEE2E2] hover:text-[#DC2626] text-[#D4D4D4] rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Add Adjustment Modal */}
            {showForm && (
                <div className={MODAL_STYLES.container}>
                    <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4 overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E8E8]">
                            <h2 className="text-lg font-bold text-[#1A1A1A]">조정 추가</h2>
                            <button onClick={() => setShowForm(false)} className="p-1 hover:bg-[#F5F5F5] rounded-lg">
                                <XCircle size={20} className="text-[#999]" />
                            </button>
                        </div>
                        <form ref={formRef} onSubmit={handleCreate} className="px-6 py-5 space-y-4">
                            {/* Employee */}
                            <div>
                                <label className="block text-xs font-semibold text-[#444] mb-1.5">대상 직원 *</label>
                                <div className="relative">
                                    <select
                                        value={form.employeeId}
                                        onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))}
                                        required
                                        className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm bg-white focus:border-[#00C853] focus:ring-2 focus:ring-[#00C853]/10 appearance-none"
                                    >
                                        <option value="">직원 선택...</option>
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
                                            className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm bg-white focus:border-[#00C853] appearance-none"
                                        >
                                            {Object.entries(ADJUSTMENT_TYPE_LABELS).map(([k, v]) => (
                                                <option key={k} value={k}>{v.label}</option>
                                            ))}
                                        </select>
                                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#999] pointer-events-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-[#444] mb-1.5">급여 항목</label>
                                    <div className="relative">
                                        <select
                                            value={form.category}
                                            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                                            className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm bg-white focus:border-[#00C853] appearance-none"
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
                                    금액 (원) *
                                    <span className="font-normal text-[#999] ml-1">양수=추가, 음수=공제</span>
                                </label>
                                <input
                                    type="number"
                                    value={form.amount}
                                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                                    required
                                    placeholder="예: 500000 또는 -200000"
                                    className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:border-[#00C853] focus:ring-2 focus:ring-[#00C853]/10"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-xs font-semibold text-[#444] mb-1.5">사유/설명 *</label>
                                <textarea
                                    value={form.description}
                                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                                    required
                                    rows={2}
                                    placeholder="조정 사유를 입력하세요"
                                    className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm resize-none focus:border-[#00C853] focus:ring-2 focus:ring-[#00C853]/10"
                                />
                            </div>

                            {/* Evidence URL */}
                            <div>
                                <label className="block text-xs font-semibold text-[#444] mb-1.5">
                                    증빙 URL
                                    <span className="font-normal text-[#999] ml-1">선택사항</span>
                                </label>
                                <input
                                    type="url"
                                    value={form.evidenceUrl}
                                    onChange={(e) => setForm((f) => ({ ...f, evidenceUrl: e.target.value }))}
                                    placeholder="https://..."
                                    className="w-full px-3 py-2 border border-[#E0E0E0] rounded-lg text-sm focus:border-[#00C853] focus:ring-2 focus:ring-[#00C853]/10"
                                />
                            </div>

                            {/* Form actions */}
                            <div className="flex items-center justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowForm(false)}
                                    className="px-4 py-2 border border-[#D4D4D4] hover:bg-[#F5F5F5] text-[#333] rounded-lg text-sm"
                                >
                                    취소
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className={`flex items-center gap-1.5 px-4 py-2 ${BUTTON_VARIANTS.primary} rounded-lg text-sm font-semibold disabled:opacity-50`}
                                >
                                    {submitting ? '저장 중...' : (
                                        <>
                                            <CheckCircle2 size={14} />
                                            저장
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
