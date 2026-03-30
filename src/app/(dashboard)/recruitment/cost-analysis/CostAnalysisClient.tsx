'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Recruitment Cost Analysis Client
// 채용단가 ROI 분석: 비용 등록 + 분석 대시보드
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import {
  DollarSign,
  Loader2,
  Plus,
  TrendingUp,
  Users,
  BarChart3,
  Trash2,
  Eye,
  Filter,
  X,
} from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import { BUTTON_SIZES, BUTTON_VARIANTS, MODAL_STYLES, TABLE_STYLES } from '@/lib/styles'

// ─── Types ──────────────────────────────────────────────────

interface RecruitmentCost {
  id: string
  postingId: string | null
  applicantSource: string
  costType: string
  amount: number
  currency: string
  description: string | null
  vendorName: string | null
  invoiceDate: string | null
  posting?: { title: string } | null
  createdAt: string
}

interface CostAnalysis {
  totalCost: number
  totalHires: number
  costPerHire: number
  bySource: {
    source: string
    totalCost: number
    hires: number
    costPerHire: number
  }[]
  byCostType: {
    costType: string
    totalAmount: number
    count: number
  }[]
  byPosting: {
    postingId: string
    title: string
    totalCost: number
    headcount: number
    hires: number
    costPerHire: number
  }[]
}

// ─── Constants ──────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  DIRECT: '직접 지원',
  REFERRAL: '사내 추천',
  AGENCY: '헤드헌터',
  JOB_BOARD: '잡보드',
  INTERNAL: '내부 이동',
}

const COST_TYPE_LABELS: Record<string, string> = {
  AD_FEE: '광고비',
  AGENCY_FEE: '에이전시 수수료',
  REFERRAL_BONUS: '추천 보너스',
  ASSESSMENT_TOOL: '평가 도구',
  TRAVEL: '출장/교통비',
  RELOCATION: '이주 비용',
  SIGNING_BONUS: '사이닝 보너스',
  OTHER: '기타',
}

const COST_TYPE_BADGE_STYLES: Record<string, string> = {
  AD_FEE: 'bg-blue-50 text-blue-800',
  AGENCY_FEE: 'bg-purple-50 text-purple-800',
  REFERRAL_BONUS: 'bg-primary/10 text-green-700',
  ASSESSMENT_TOOL: 'bg-orange-50 text-orange-800',
  TRAVEL: 'bg-cyan-50 text-cyan-700',
  RELOCATION: 'bg-orange-50 text-orange-800',
  SIGNING_BONUS: 'bg-indigo-50 text-indigo-800',
  OTHER: 'bg-muted text-[#666]',
}

// ─── Component ──────────────────────────────────────────────

export function CostAnalysisClient({ user: _user }: { user: SessionUser }) {
  const [tab, setTab] = useState<'analysis' | 'costs'>('analysis')
  const [loading, setLoading] = useState(true)
  const [analysis, setAnalysis] = useState<CostAnalysis | null>(null)
  const [costs, setCosts] = useState<RecruitmentCost[]>([])
  const [costFilter, setCostFilter] = useState<string>('ALL')
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const { confirm, dialogProps } = useConfirmDialog()

  // ─── Create Modal ───────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    applicantSource: 'DIRECT',
    costType: 'AD_FEE',
    amount: '',
    currency: 'KRW',
    description: '',
    vendorName: '',
    invoiceDate: '',
  })

  // ─── Detail Modal ──────────────────────────────────────
  const [detailCost, setDetailCost] = useState<RecruitmentCost | null>(null)

  // ─── Fetch ─────────────────────────────────────────────
  const fetchAnalysis = useCallback(async () => {
    try {
      const res = await apiClient.get<CostAnalysis>('/api/v1/recruitment/cost-analysis', { year })
      setAnalysis(res.data)
    } catch (err) {
      toast({ title: '채용 비용 로드 실패', description: err instanceof Error ? err.message : '다시 시도해 주세요.', variant: 'destructive' })
    }
  }, [year])

  const fetchCosts = useCallback(async () => {
    try {
      const params: Record<string, string | number | undefined> = { page: 1, limit: 50 }
      if (costFilter !== 'ALL') params.costType = costFilter
      const res = await apiClient.get<RecruitmentCost[]>('/api/v1/recruitment/costs', params)
      setCosts(res.data)
    } catch (err) {
      toast({ title: '채용 비용 로드 실패', description: err instanceof Error ? err.message : '다시 시도해 주세요.', variant: 'destructive' })
    }
  }, [costFilter])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchAnalysis(), fetchCosts()]).finally(() => setLoading(false))
  }, [fetchAnalysis, fetchCosts])

  // ─── Create ────────────────────────────────────────────
  const handleCreate = async () => {
    if (!form.amount) return
    setCreating(true)
    try {
      await apiClient.post('/api/v1/recruitment/costs', {
        applicantSource: form.applicantSource,
        costType: form.costType,
        amount: Number(form.amount),
        currency: form.currency,
        description: form.description || null,
        vendorName: form.vendorName || null,
        invoiceDate: form.invoiceDate || null,
      })
      setShowCreate(false)
      setForm({ applicantSource: 'DIRECT', costType: 'AD_FEE', amount: '', currency: 'KRW', description: '', vendorName: '', invoiceDate: '' })
      fetchCosts()
      fetchAnalysis()
    } catch (err) {
      toast({ title: '채용 비용 등록 실패', description: err instanceof Error ? err.message : '다시 시도해 주세요.', variant: 'destructive' })
    }
    setCreating(false)
  }

  // ─── Delete ────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    confirm({ variant: 'destructive', title: '삭제하시겠습니까?', onConfirm: async () => {
      try {
        await apiClient.delete(`/api/v1/recruitment/costs/${id}`)
        fetchCosts()
        fetchAnalysis()
      } catch (err) {
        toast({ title: '채용 비용 삭제 실패', description: err instanceof Error ? err.message : '다시 시도해 주세요.', variant: 'destructive' })
      }
    }})
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(amount)

  // ─── Render ────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em]">{'채용단가 ROI 분석'}</h1>
          <p className="text-sm text-[#999] mt-1">{'채용 비용 추적 및 투자 대비 효율 분석'}</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={String(year)}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors duration-150"
          >
            {[2024, 2025, 2026].map((y) => (
              <option key={y} value={String(y)}>{y}년</option>
            ))}
          </select>
          <button
            onClick={() => setShowCreate(true)}
            className={`inline-flex items-center gap-2 ${BUTTON_SIZES.md} ${BUTTON_VARIANTS.primary}`}
          >
            <Plus className="w-4 h-4" />
            {'비용 등록'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {(['analysis', 'costs'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors duration-150 ${
              tab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-[#999] hover:text-foreground'
            }`}
          >
            {t === 'analysis' ? 'ROI 분석' : '비용 내역'}
          </button>
        ))}
      </div>

      {/* Analysis Tab */}
      {tab === 'analysis' && analysis && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white border border-border rounded-xl p-5">
              <p className="text-xs text-[#999] mb-1">{'총 채용 비용'}</p>
              <p className="text-3xl font-bold text-foreground">{formatCurrency(analysis.totalCost)}</p>
            </div>
            <div className="bg-white border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-[#999]" />
                <p className="text-xs text-[#999]">{'총 채용 인원'}</p>
              </div>
              <p className="text-3xl font-bold text-foreground">{analysis.totalHires}명</p>
            </div>
            <div className="bg-white border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-[#999]" />
                <p className="text-xs text-[#999]">{'인당 채용 단가'}</p>
              </div>
              <p className="text-3xl font-bold text-primary">{formatCurrency(analysis.costPerHire)}</p>
            </div>
            <div className="bg-white border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-[#999]" />
                <p className="text-xs text-[#999]">{'비용 유형 수'}</p>
              </div>
              <p className="text-3xl font-bold text-foreground">{analysis.byCostType.length}</p>
            </div>
          </div>

          {/* Source Analysis */}
          <div className="bg-white border border-border rounded-xl">
            <div className="p-6 pb-0">
              <h2 className="text-base font-bold text-foreground tracking-[-0.02em] flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                {'채용 소스별 효율'}
              </h2>
            </div>
            <div className="p-6">
              {analysis.bySource.length === 0 ? (
                <EmptyState />
              ) : (
                <div className={TABLE_STYLES.wrapper}>
                  <table className={TABLE_STYLES.table}>
                    <thead>
                      <tr className={TABLE_STYLES.header}>
                        <th className={TABLE_STYLES.headerCell}>{'소스'}</th>
                        <th className={TABLE_STYLES.headerCellRight}>{'총 비용'}</th>
                        <th className={TABLE_STYLES.headerCellRight}>{'채용 수'}</th>
                        <th className={TABLE_STYLES.headerCellRight}>{'인당 단가'}</th>
                        <th className={TABLE_STYLES.headerCellRight}>{'비중'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {analysis.bySource.map((s) => {
                        const pct = analysis.totalCost > 0
                          ? ((s.totalCost / analysis.totalCost) * 100).toFixed(1)
                          : '0'
                        return (
                          <tr key={s.source} className="hover:bg-background transition-colors">
                            <td className="px-4 py-3 font-medium text-foreground">{SOURCE_LABELS[s.source] ?? s.source}</td>
                            <td className="px-4 py-3 text-right text-foreground">{formatCurrency(s.totalCost)}</td>
                            <td className="px-4 py-3 text-right text-foreground">{s.hires}명</td>
                            <td className="px-4 py-3 text-right font-semibold text-primary">
                              {formatCurrency(s.costPerHire)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-primary rounded-full"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-xs text-[#999]">{pct}%</span>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Cost Type Breakdown */}
          <div className="bg-white border border-border rounded-xl">
            <div className="p-6 pb-0">
              <h2 className="text-base font-bold text-foreground tracking-[-0.02em]">{'비용 유형별 분석'}</h2>
            </div>
            <div className="p-6">
              {analysis.byCostType.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {analysis.byCostType.map((ct) => (
                    <div key={ct.costType} className="border border-border rounded-lg p-4">
                      <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${COST_TYPE_BADGE_STYLES[ct.costType] ?? COST_TYPE_BADGE_STYLES.OTHER}`}>
                        {COST_TYPE_LABELS[ct.costType] ?? ct.costType}
                      </span>
                      <p className="text-xl font-bold text-foreground mt-2">
                        {formatCurrency(ct.totalAmount)}
                      </p>
                      <p className="text-xs text-[#999]">{ct.count}건</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Top Postings */}
          {analysis.byPosting.length > 0 && (
            <div className="bg-white border border-border rounded-xl">
              <div className="p-6 pb-0">
                <h2 className="text-base font-bold text-foreground tracking-[-0.02em]">{'공고별 채용 비용 (Top 20)'}</h2>
              </div>
              <div className="p-6">
                <div className={TABLE_STYLES.wrapper}>
                  <table className={TABLE_STYLES.table}>
                    <thead>
                      <tr className={TABLE_STYLES.header}>
                        <th className={TABLE_STYLES.headerCell}>{'공고명'}</th>
                        <th className={TABLE_STYLES.headerCellRight}>{'총 비용'}</th>
                        <th className={TABLE_STYLES.headerCellRight}>{'모집인원'}</th>
                        <th className={TABLE_STYLES.headerCellRight}>{'채용인원'}</th>
                        <th className={TABLE_STYLES.headerCellRight}>{'인당 단가'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {analysis.byPosting.map((p) => (
                        <tr key={p.postingId} className="hover:bg-background transition-colors">
                          <td className="px-4 py-3 font-medium text-foreground max-w-[200px] truncate">{p.title}</td>
                          <td className="px-4 py-3 text-right text-foreground">{formatCurrency(p.totalCost)}</td>
                          <td className="px-4 py-3 text-right text-foreground">{p.headcount}명</td>
                          <td className="px-4 py-3 text-right text-foreground">{p.hires}명</td>
                          <td className="px-4 py-3 text-right font-semibold text-primary">
                            {formatCurrency(p.costPerHire)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Costs Tab */}
      {tab === 'costs' && (
        <div className="space-y-4">
          {/* Filter */}
          <div className="flex items-center gap-3">
            <Filter className="w-4 h-4 text-[#999]" />
            <select
              value={costFilter}
              onChange={(e) => setCostFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors duration-150"
            >
              <option value="ALL">{'전체'}</option>
              {Object.entries(COST_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* Cost List */}
          <div className="bg-white border border-border rounded-xl overflow-hidden">
            {costs.length === 0 ? (
              <EmptyState />
            ) : (
              <div className={TABLE_STYLES.wrapper}>
                <table className={TABLE_STYLES.table}>
                  <thead>
                    <tr className={TABLE_STYLES.header}>
                      <th className={TABLE_STYLES.headerCell}>{'비용 유형'}</th>
                      <th className={TABLE_STYLES.headerCell}>{'소스'}</th>
                      <th className={TABLE_STYLES.headerCell}>공고</th>
                      <th className={TABLE_STYLES.headerCellRight}>{'금액'}</th>
                      <th className={TABLE_STYLES.headerCell}>{'거부'}</th>
                      <th className={TABLE_STYLES.headerCell}>{'청구일'}</th>
                      <th className={TABLE_STYLES.headerCell}>{'액션'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {costs.map((c) => (
                      <tr key={c.id} className="hover:bg-background transition-colors">
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${COST_TYPE_BADGE_STYLES[c.costType] ?? COST_TYPE_BADGE_STYLES.OTHER}`}>
                            {COST_TYPE_LABELS[c.costType] ?? c.costType}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[#666]">
                          {SOURCE_LABELS[c.applicantSource] ?? c.applicantSource}
                        </td>
                        <td className="px-4 py-3 text-[#666] max-w-[150px] truncate">
                          {c.posting?.title ?? '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-foreground">
                          {formatCurrency(c.amount)}
                        </td>
                        <td className="px-4 py-3 text-[#999]">{c.vendorName ?? '-'}</td>
                        <td className="px-4 py-3 text-[#999]">
                          {c.invoiceDate ? new Date(c.invoiceDate).toLocaleDateString('ko-KR') : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setDetailCost(c)}
                              className="p-1.5 rounded-lg hover:bg-background text-[#666] transition-colors duration-150"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(c.id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors duration-150"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className={MODAL_STYLES.container}>
          <div className="bg-white rounded-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between p-6 pb-0">
              <h2 className="text-lg font-bold text-foreground tracking-[-0.02em]">{'채용 비용 등록'}</h2>
              <button onClick={() => setShowCreate(false)} className="p-1 rounded-lg hover:bg-background text-[#999] transition-colors duration-150">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{'채용 소스'}</label>
                <select
                  value={form.applicantSource}
                  onChange={(e) => setForm({ ...form, applicantSource: e.target.value })}
                  className="w-full px-4 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors duration-150"
                >
                  {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{'비용 유형'}</label>
                <select
                  value={form.costType}
                  onChange={(e) => setForm({ ...form, costType: e.target.value })}
                  className="w-full px-4 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors duration-150"
                >
                  {Object.entries(COST_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">{'금액'}</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="w-full px-4 py-2 text-sm border border-border rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors duration-150"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">{'통화'}</label>
                  <select
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value })}
                    className="w-full px-4 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors duration-150"
                  >
                    {['KRW', 'USD', 'CNY', 'RUB', 'VND', 'MXN', 'PLN'].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{'거부'}</label>
                <input
                  placeholder="거래처명"
                  value={form.vendorName}
                  onChange={(e) => setForm({ ...form, vendorName: e.target.value })}
                  className="w-full px-4 py-2 text-sm border border-border rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors duration-150"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{'청구일'}</label>
                <input
                  type="date"
                  value={form.invoiceDate}
                  onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })}
                  className="w-full px-4 py-2 text-sm border border-border rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors duration-150"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{'설명'}</label>
                <input
                  placeholder={'비용 설명 (선택)'}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-4 py-2 text-sm border border-border rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors duration-150"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 pt-0">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm font-medium text-[#666] border border-border rounded-lg hover:bg-background transition-colors duration-150"
              >
                {'취소'}
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !form.amount}
                className={`inline-flex items-center gap-2 ${BUTTON_SIZES.md} ${BUTTON_VARIANTS.primary} disabled:opacity-50`}
              >
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                등록
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailCost && (
        <div className={MODAL_STYLES.container}>
          <div className="bg-white rounded-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-6 pb-0">
              <h2 className="text-lg font-bold text-foreground tracking-[-0.02em]">{'비용 상세'}</h2>
              <button onClick={() => setDetailCost(null)} className="p-1 rounded-lg hover:bg-background text-[#999] transition-colors duration-150">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-[#999]">{'비용 유형'}</span>
                <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${COST_TYPE_BADGE_STYLES[detailCost.costType] ?? COST_TYPE_BADGE_STYLES.OTHER}`}>
                  {COST_TYPE_LABELS[detailCost.costType] ?? detailCost.costType}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-[#999]">{'채용 소스'}</span>
                <span className="text-sm font-medium text-foreground">
                  {SOURCE_LABELS[detailCost.applicantSource] ?? detailCost.applicantSource}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-[#999]">{'금액'}</span>
                <span className="text-sm font-bold text-primary">{formatCurrency(detailCost.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-[#999]">{'통화'}</span>
                <span className="text-sm text-foreground">{detailCost.currency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-[#999]">공고</span>
                <span className="text-sm text-foreground">{detailCost.posting?.title ?? '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-[#999]">{'거부'}</span>
                <span className="text-sm text-foreground">{detailCost.vendorName ?? '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-[#999]">{'청구일'}</span>
                <span className="text-sm text-foreground">
                  {detailCost.invoiceDate ? new Date(detailCost.invoiceDate).toLocaleDateString('ko-KR') : '-'}
                </span>
              </div>
              {detailCost.description && (
                <div>
                  <span className="text-sm text-[#999] block mb-1">{'설명'}</span>
                  <p className="text-sm bg-background rounded-lg p-3 text-foreground">{detailCost.description}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    <ConfirmDialog {...dialogProps} />
    </div>
  )
}
