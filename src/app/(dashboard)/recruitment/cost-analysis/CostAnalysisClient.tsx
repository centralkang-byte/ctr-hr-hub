'use client'

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
  AD_FEE: 'bg-[#E3F2FD] text-[#1565C0]',
  AGENCY_FEE: 'bg-[#F3E5F5] text-[#7B1FA2]',
  REFERRAL_BONUS: 'bg-[#E8F5E9] text-[#2E7D32]',
  ASSESSMENT_TOOL: 'bg-[#FFF3E0] text-[#E65100]',
  TRAVEL: 'bg-[#E0F7FA] text-[#00838F]',
  RELOCATION: 'bg-[#FFF3E0] text-[#E65100]',
  SIGNING_BONUS: 'bg-[#E8EAF6] text-[#283593]',
  OTHER: 'bg-[#F5F5F5] text-[#666]',
}

// ─── Component ──────────────────────────────────────────────

export function CostAnalysisClient({ user: _user }: { user: SessionUser }) {
  const [tab, setTab] = useState<'analysis' | 'costs'>('analysis')
  const [loading, setLoading] = useState(true)
  const [analysis, setAnalysis] = useState<CostAnalysis | null>(null)
  const [costs, setCosts] = useState<RecruitmentCost[]>([])
  const [costFilter, setCostFilter] = useState<string>('ALL')
  const [year, setYear] = useState<number>(new Date().getFullYear())

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
    } catch { /* ignore */ }
  }, [year])

  const fetchCosts = useCallback(async () => {
    try {
      const params: Record<string, string | number | undefined> = { page: 1, limit: 50 }
      if (costFilter !== 'ALL') params.costType = costFilter
      const res = await apiClient.get<RecruitmentCost[]>('/api/v1/recruitment/costs', params)
      setCosts(res.data)
    } catch { /* ignore */ }
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
    } catch { /* ignore */ }
    setCreating(false)
  }

  // ─── Delete ────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!confirm('삭제하시겠습니까?')) return
    try {
      await apiClient.delete(`/api/v1/recruitment/costs/${id}`)
      fetchCosts()
      fetchAnalysis()
    } catch { /* ignore */ }
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(amount)

  // ─── Render ────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-[#00C853]" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A] tracking-[-0.02em]">채용단가 ROI 분석</h1>
          <p className="text-sm text-[#999] mt-1">채용 비용 추적 및 투자 대비 효율 분석</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={String(year)}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-3 py-2 text-sm border border-[#E8E8E8] rounded-lg bg-white focus:outline-none focus:border-[#00C853] focus:ring-2 focus:ring-[#00C853]/10 transition-colors duration-150"
          >
            {[2024, 2025, 2026].map((y) => (
              <option key={y} value={String(y)}>{y}년</option>
            ))}
          </select>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#00C853] hover:bg-[#00A844] text-white rounded-lg transition-colors duration-150"
          >
            <Plus className="w-4 h-4" />
            비용 등록
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E8E8E8]">
        {(['analysis', 'costs'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors duration-150 ${
              tab === t
                ? 'border-[#00C853] text-[#00C853]'
                : 'border-transparent text-[#999] hover:text-[#1A1A1A]'
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
            <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
              <p className="text-xs text-[#999] mb-1">총 채용 비용</p>
              <p className="text-3xl font-bold text-[#1A1A1A]">{formatCurrency(analysis.totalCost)}</p>
            </div>
            <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-[#999]" />
                <p className="text-xs text-[#999]">총 채용 인원</p>
              </div>
              <p className="text-3xl font-bold text-[#1A1A1A]">{analysis.totalHires}명</p>
            </div>
            <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-[#999]" />
                <p className="text-xs text-[#999]">인당 채용 단가</p>
              </div>
              <p className="text-3xl font-bold text-[#00C853]">{formatCurrency(analysis.costPerHire)}</p>
            </div>
            <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-[#999]" />
                <p className="text-xs text-[#999]">비용 유형 수</p>
              </div>
              <p className="text-3xl font-bold text-[#1A1A1A]">{analysis.byCostType.length}</p>
            </div>
          </div>

          {/* Source Analysis */}
          <div className="bg-white border border-[#E8E8E8] rounded-xl">
            <div className="p-6 pb-0">
              <h2 className="text-base font-bold text-[#1A1A1A] tracking-[-0.02em] flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#00C853]" />
                채용 소스별 효율
              </h2>
            </div>
            <div className="p-6">
              {analysis.bySource.length === 0 ? (
                <p className="text-sm text-[#999] text-center py-8">데이터가 없습니다.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#E8E8E8]">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">소스</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-[#999]">총 비용</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-[#999]">채용 수</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-[#999]">인당 단가</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-[#999]">비중</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.bySource.map((s) => {
                        const pct = analysis.totalCost > 0
                          ? ((s.totalCost / analysis.totalCost) * 100).toFixed(1)
                          : '0'
                        return (
                          <tr key={s.source} className="border-b border-[#F5F5F5] hover:bg-[#FAFAFA] transition-colors duration-150">
                            <td className="px-4 py-3 font-medium text-[#1A1A1A]">{SOURCE_LABELS[s.source] ?? s.source}</td>
                            <td className="px-4 py-3 text-right text-[#1A1A1A]">{formatCurrency(s.totalCost)}</td>
                            <td className="px-4 py-3 text-right text-[#1A1A1A]">{s.hires}명</td>
                            <td className="px-4 py-3 text-right font-semibold text-[#00C853]">
                              {formatCurrency(s.costPerHire)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 h-2 bg-[#F5F5F5] rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-[#00C853] rounded-full"
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
          <div className="bg-white border border-[#E8E8E8] rounded-xl">
            <div className="p-6 pb-0">
              <h2 className="text-base font-bold text-[#1A1A1A] tracking-[-0.02em]">비용 유형별 분석</h2>
            </div>
            <div className="p-6">
              {analysis.byCostType.length === 0 ? (
                <p className="text-sm text-[#999] text-center py-8">데이터가 없습니다.</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {analysis.byCostType.map((ct) => (
                    <div key={ct.costType} className="border border-[#E8E8E8] rounded-lg p-4">
                      <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${COST_TYPE_BADGE_STYLES[ct.costType] ?? COST_TYPE_BADGE_STYLES.OTHER}`}>
                        {COST_TYPE_LABELS[ct.costType] ?? ct.costType}
                      </span>
                      <p className="text-xl font-bold text-[#1A1A1A] mt-2">
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
            <div className="bg-white border border-[#E8E8E8] rounded-xl">
              <div className="p-6 pb-0">
                <h2 className="text-base font-bold text-[#1A1A1A] tracking-[-0.02em]">공고별 채용 비용 (Top 20)</h2>
              </div>
              <div className="p-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#E8E8E8]">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">공고명</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-[#999]">총 비용</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-[#999]">모집인원</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-[#999]">채용인원</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-[#999]">인당 단가</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.byPosting.map((p) => (
                        <tr key={p.postingId} className="border-b border-[#F5F5F5] hover:bg-[#FAFAFA] transition-colors duration-150">
                          <td className="px-4 py-3 font-medium text-[#1A1A1A] max-w-[200px] truncate">{p.title}</td>
                          <td className="px-4 py-3 text-right text-[#1A1A1A]">{formatCurrency(p.totalCost)}</td>
                          <td className="px-4 py-3 text-right text-[#1A1A1A]">{p.headcount}명</td>
                          <td className="px-4 py-3 text-right text-[#1A1A1A]">{p.hires}명</td>
                          <td className="px-4 py-3 text-right font-semibold text-[#00C853]">
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
              className="px-3 py-2 text-sm border border-[#E8E8E8] rounded-lg bg-white focus:outline-none focus:border-[#00C853] focus:ring-2 focus:ring-[#00C853]/10 transition-colors duration-150"
            >
              <option value="ALL">전체</option>
              {Object.entries(COST_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* Cost List */}
          <div className="bg-white border border-[#E8E8E8] rounded-xl overflow-hidden">
            {costs.length === 0 ? (
              <p className="text-sm text-[#999] text-center py-12">등록된 비용이 없습니다.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E8E8E8]">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">비용 유형</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">소스</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">공고</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-[#999]">금액</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">거래처</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">청구일</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-[#999]">액션</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costs.map((c) => (
                      <tr key={c.id} className="border-b border-[#F5F5F5] hover:bg-[#FAFAFA] transition-colors duration-150">
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
                        <td className="px-4 py-3 text-right font-semibold text-[#1A1A1A]">
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
                              className="p-1.5 rounded-lg hover:bg-[#FAFAFA] text-[#666] transition-colors duration-150"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(c.id)}
                              className="p-1.5 rounded-lg hover:bg-[#FFEBEE] text-[#F44336] transition-colors duration-150"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between p-6 pb-0">
              <h2 className="text-lg font-bold text-[#1A1A1A] tracking-[-0.02em]">채용 비용 등록</h2>
              <button onClick={() => setShowCreate(false)} className="p-1 rounded-lg hover:bg-[#FAFAFA] text-[#999] transition-colors duration-150">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#1A1A1A] mb-1">채용 소스</label>
                <select
                  value={form.applicantSource}
                  onChange={(e) => setForm({ ...form, applicantSource: e.target.value })}
                  className="w-full px-4 py-2 text-sm border border-[#E8E8E8] rounded-lg bg-white focus:outline-none focus:border-[#00C853] focus:ring-2 focus:ring-[#00C853]/10 transition-colors duration-150"
                >
                  {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1A1A1A] mb-1">비용 유형</label>
                <select
                  value={form.costType}
                  onChange={(e) => setForm({ ...form, costType: e.target.value })}
                  className="w-full px-4 py-2 text-sm border border-[#E8E8E8] rounded-lg bg-white focus:outline-none focus:border-[#00C853] focus:ring-2 focus:ring-[#00C853]/10 transition-colors duration-150"
                >
                  {Object.entries(COST_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[#1A1A1A] mb-1">금액</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="w-full px-4 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-[#00C853] focus:ring-2 focus:ring-[#00C853]/10 transition-colors duration-150"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#1A1A1A] mb-1">통화</label>
                  <select
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value })}
                    className="w-full px-4 py-2 text-sm border border-[#E8E8E8] rounded-lg bg-white focus:outline-none focus:border-[#00C853] focus:ring-2 focus:ring-[#00C853]/10 transition-colors duration-150"
                  >
                    {['KRW', 'USD', 'CNY', 'RUB', 'VND', 'MXN', 'PLN'].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1A1A1A] mb-1">거래처</label>
                <input
                  placeholder="거래처명"
                  value={form.vendorName}
                  onChange={(e) => setForm({ ...form, vendorName: e.target.value })}
                  className="w-full px-4 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-[#00C853] focus:ring-2 focus:ring-[#00C853]/10 transition-colors duration-150"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1A1A1A] mb-1">청구일</label>
                <input
                  type="date"
                  value={form.invoiceDate}
                  onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })}
                  className="w-full px-4 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-[#00C853] focus:ring-2 focus:ring-[#00C853]/10 transition-colors duration-150"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1A1A1A] mb-1">설명</label>
                <input
                  placeholder="비용 설명 (선택)"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-4 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-[#00C853] focus:ring-2 focus:ring-[#00C853]/10 transition-colors duration-150"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 pt-0">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm font-medium text-[#666] border border-[#E8E8E8] rounded-lg hover:bg-[#FAFAFA] transition-colors duration-150"
              >
                취소
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !form.amount}
                className="flex items-center gap-2 px-6 py-2 text-sm font-medium bg-[#00C853] hover:bg-[#00A844] text-white rounded-lg transition-colors duration-150 disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-6 pb-0">
              <h2 className="text-lg font-bold text-[#1A1A1A] tracking-[-0.02em]">비용 상세</h2>
              <button onClick={() => setDetailCost(null)} className="p-1 rounded-lg hover:bg-[#FAFAFA] text-[#999] transition-colors duration-150">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-[#999]">비용 유형</span>
                <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${COST_TYPE_BADGE_STYLES[detailCost.costType] ?? COST_TYPE_BADGE_STYLES.OTHER}`}>
                  {COST_TYPE_LABELS[detailCost.costType] ?? detailCost.costType}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-[#999]">채용 소스</span>
                <span className="text-sm font-medium text-[#1A1A1A]">
                  {SOURCE_LABELS[detailCost.applicantSource] ?? detailCost.applicantSource}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-[#999]">금액</span>
                <span className="text-sm font-bold text-[#00C853]">{formatCurrency(detailCost.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-[#999]">통화</span>
                <span className="text-sm text-[#1A1A1A]">{detailCost.currency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-[#999]">공고</span>
                <span className="text-sm text-[#1A1A1A]">{detailCost.posting?.title ?? '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-[#999]">거래처</span>
                <span className="text-sm text-[#1A1A1A]">{detailCost.vendorName ?? '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-[#999]">청구일</span>
                <span className="text-sm text-[#1A1A1A]">
                  {detailCost.invoiceDate ? new Date(detailCost.invoiceDate).toLocaleDateString('ko-KR') : '-'}
                </span>
              </div>
              {detailCost.description && (
                <div>
                  <span className="text-sm text-[#999] block mb-1">설명</span>
                  <p className="text-sm bg-[#FAFAFA] rounded-lg p-3 text-[#1A1A1A]">{detailCost.description}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
