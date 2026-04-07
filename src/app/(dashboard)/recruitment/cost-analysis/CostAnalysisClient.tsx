'use client'

import { useTranslations, useLocale } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
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

const SOURCE_LABEL_KEYS: Record<string, string> = {
  DIRECT: 'sourceDirect',
  REFERRAL: 'sourceReferral',
  AGENCY: 'sourceAgency',
  JOB_BOARD: 'sourceJobBoard',
  INTERNAL: 'sourceInternal',
}

const COST_TYPE_LABEL_KEYS: Record<string, string> = {
  AD_FEE: 'costTypeAdFee',
  AGENCY_FEE: 'costTypeAgencyFee',
  REFERRAL_BONUS: 'costTypeReferralBonus',
  ASSESSMENT_TOOL: 'costTypeAssessmentTool',
  TRAVEL: 'costTypeTravel',
  RELOCATION: 'costTypeRelocation',
  SIGNING_BONUS: 'costTypeSigningBonus',
  OTHER: 'costTypeOther',
}

const COST_TYPE_BADGE_STYLES: Record<string, string> = {
  AD_FEE: 'bg-primary/5 text-blue-800',
  AGENCY_FEE: 'bg-purple-500/10 text-purple-800',
  REFERRAL_BONUS: 'bg-primary/10 text-tertiary',
  ASSESSMENT_TOOL: 'bg-orange-500/10 text-orange-800',
  TRAVEL: 'bg-cyan-500/10 text-cyan-700',
  RELOCATION: 'bg-orange-500/10 text-orange-800',
  SIGNING_BONUS: 'bg-indigo-500/10 text-indigo-800',
  OTHER: 'bg-muted text-muted-foreground',
}

// ─── Component ──────────────────────────────────────────────

export function CostAnalysisClient({ user: _user }: { user: SessionUser }) {
  const t = useTranslations('recruitment')
  const locale = useLocale()
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
      toast({ title: t('costLoadFailed'), description: err instanceof Error ? err.message : t('pleaseRetry'), variant: 'destructive' })
    }
  }, [year, t])

  const fetchCosts = useCallback(async () => {
    try {
      const params: Record<string, string | number | undefined> = { page: 1, limit: 50 }
      if (costFilter !== 'ALL') params.costType = costFilter
      const res = await apiClient.get<RecruitmentCost[]>('/api/v1/recruitment/costs', params)
      setCosts(res.data)
    } catch (err) {
      toast({ title: t('costLoadFailed'), description: err instanceof Error ? err.message : t('pleaseRetry'), variant: 'destructive' })
    }
  }, [costFilter, t])

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
      toast({ title: t('costCreateFailed'), description: err instanceof Error ? err.message : t('pleaseRetry'), variant: 'destructive' })
    }
    setCreating(false)
  }

  // ─── Delete ────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    confirm({ variant: 'destructive', title: t('confirmDelete'), onConfirm: async () => {
      try {
        await apiClient.delete(`/api/v1/recruitment/costs/${id}`)
        fetchCosts()
        fetchAnalysis()
      } catch (err) {
        toast({ title: t('costDeleteFailed'), description: err instanceof Error ? err.message : t('pleaseRetry'), variant: 'destructive' })
      }
    }})
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(amount)

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
          <h1 className="text-2xl font-bold text-foreground tracking-[-0.02em]">{t('costAnalysisTitle')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('costAnalysisSubtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={String(year)}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-3 py-2 text-sm border border-border rounded-lg bg-card focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors duration-150"
          >
            {[2024, 2025, 2026].map((y) => (
              <option key={y} value={String(y)}>{t('yearUnit', { year: y })}</option>
            ))}
          </select>
          <button
            onClick={() => setShowCreate(true)}
            className={`inline-flex items-center gap-2 ${BUTTON_SIZES.md} ${BUTTON_VARIANTS.primary}`}
          >
            <Plus className="w-4 h-4" />
            {t('registerCost')}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {(['analysis', 'costs'] as const).map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors duration-150 ${
              tab === tabKey
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tabKey === 'analysis' ? t('tabAnalysis') : t('tabCosts')}
          </button>
        ))}
      </div>

      {/* Analysis Tab */}
      {tab === 'analysis' && analysis && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-xl p-5">
              <p className="text-xs text-muted-foreground mb-1">{t('totalRecruitmentCost')}</p>
              <p className="text-3xl font-bold text-foreground">{formatCurrency(analysis.totalCost)}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{t('totalHires')}</p>
              </div>
              <p className="text-3xl font-bold text-foreground">{t('personCount', { count: analysis.totalHires })}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{t('costPerHire')}</p>
              </div>
              <p className="text-3xl font-bold text-primary">{formatCurrency(analysis.costPerHire)}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{t('costTypeCount')}</p>
              </div>
              <p className="text-3xl font-bold text-foreground">{analysis.byCostType.length}</p>
            </div>
          </div>

          {/* Source Analysis */}
          <div className="bg-card border border-border rounded-xl">
            <div className="p-6 pb-0">
              <h2 className="text-base font-bold text-foreground tracking-[-0.02em] flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                {t('sourceEfficiency')}
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
                        <th className={TABLE_STYLES.headerCell}>{t('headerSource')}</th>
                        <th className={TABLE_STYLES.headerCellRight}>{t('headerTotalCost')}</th>
                        <th className={TABLE_STYLES.headerCellRight}>{t('headerHireCount')}</th>
                        <th className={TABLE_STYLES.headerCellRight}>{t('headerCostPerHire')}</th>
                        <th className={TABLE_STYLES.headerCellRight}>{t('headerShare')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {analysis.bySource.map((s) => {
                        const pct = analysis.totalCost > 0
                          ? ((s.totalCost / analysis.totalCost) * 100).toFixed(1)
                          : '0'
                        return (
                          <tr key={s.source} className="hover:bg-background transition-colors">
                            <td className="px-4 py-3 font-medium text-foreground">{SOURCE_LABEL_KEYS[s.source] ? t(SOURCE_LABEL_KEYS[s.source]) : s.source}</td>
                            <td className="px-4 py-3 text-right text-foreground">{formatCurrency(s.totalCost)}</td>
                            <td className="px-4 py-3 text-right text-foreground">{t('personCount', { count: s.hires })}</td>
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
                                <span className="text-xs text-muted-foreground">{pct}%</span>
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
          <div className="bg-card border border-border rounded-xl">
            <div className="p-6 pb-0">
              <h2 className="text-base font-bold text-foreground tracking-[-0.02em]">{t('costTypeAnalysis')}</h2>
            </div>
            <div className="p-6">
              {analysis.byCostType.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {analysis.byCostType.map((ct) => (
                    <div key={ct.costType} className="border border-border rounded-lg p-4">
                      <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${COST_TYPE_BADGE_STYLES[ct.costType] ?? COST_TYPE_BADGE_STYLES.OTHER}`}>
                        {COST_TYPE_LABEL_KEYS[ct.costType] ? t(COST_TYPE_LABEL_KEYS[ct.costType]) : ct.costType}
                      </span>
                      <p className="text-xl font-bold text-foreground mt-2">
                        {formatCurrency(ct.totalAmount)}
                      </p>
                      <p className="text-xs text-muted-foreground">{t('itemCount', { count: ct.count })}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Top Postings */}
          {analysis.byPosting.length > 0 && (
            <div className="bg-card border border-border rounded-xl">
              <div className="p-6 pb-0">
                <h2 className="text-base font-bold text-foreground tracking-[-0.02em]">{t('costByPostingTop20')}</h2>
              </div>
              <div className="p-6">
                <div className={TABLE_STYLES.wrapper}>
                  <table className={TABLE_STYLES.table}>
                    <thead>
                      <tr className={TABLE_STYLES.header}>
                        <th className={TABLE_STYLES.headerCell}>{t('headerPostingTitle')}</th>
                        <th className={TABLE_STYLES.headerCellRight}>{t('headerTotalCost')}</th>
                        <th className={TABLE_STYLES.headerCellRight}>{t('headerHeadcount')}</th>
                        <th className={TABLE_STYLES.headerCellRight}>{t('headerHires')}</th>
                        <th className={TABLE_STYLES.headerCellRight}>{t('headerCostPerHire')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {analysis.byPosting.map((p) => (
                        <tr key={p.postingId} className="hover:bg-background transition-colors">
                          <td className="px-4 py-3 font-medium text-foreground max-w-[200px] truncate">{p.title}</td>
                          <td className="px-4 py-3 text-right text-foreground">{formatCurrency(p.totalCost)}</td>
                          <td className="px-4 py-3 text-right text-foreground">{t('personCount', { count: p.headcount })}</td>
                          <td className="px-4 py-3 text-right text-foreground">{t('personCount', { count: p.hires })}</td>
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
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={costFilter}
              onChange={(e) => setCostFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-border rounded-lg bg-card focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors duration-150"
            >
              <option value="ALL">{t('filterAll')}</option>
              {Object.entries(COST_TYPE_LABEL_KEYS).map(([k, labelKey]) => (
                <option key={k} value={k}>{t(labelKey)}</option>
              ))}
            </select>
          </div>

          {/* Cost List */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {costs.length === 0 ? (
              <EmptyState />
            ) : (
              <div className={TABLE_STYLES.wrapper}>
                <table className={TABLE_STYLES.table}>
                  <thead>
                    <tr className={TABLE_STYLES.header}>
                      <th className={TABLE_STYLES.headerCell}>{t('headerCostType')}</th>
                      <th className={TABLE_STYLES.headerCell}>{t('headerSource')}</th>
                      <th className={TABLE_STYLES.headerCell}>{t('headerPosting')}</th>
                      <th className={TABLE_STYLES.headerCellRight}>{t('headerAmount')}</th>
                      <th className={TABLE_STYLES.headerCell}>{t('headerVendor')}</th>
                      <th className={TABLE_STYLES.headerCell}>{t('headerInvoiceDate')}</th>
                      <th className={TABLE_STYLES.headerCell}>{t('headerAction')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {costs.map((c) => (
                      <tr key={c.id} className="hover:bg-background transition-colors">
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${COST_TYPE_BADGE_STYLES[c.costType] ?? COST_TYPE_BADGE_STYLES.OTHER}`}>
                            {COST_TYPE_LABEL_KEYS[c.costType] ? t(COST_TYPE_LABEL_KEYS[c.costType]) : c.costType}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {SOURCE_LABEL_KEYS[c.applicantSource] ? t(SOURCE_LABEL_KEYS[c.applicantSource]) : c.applicantSource}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground max-w-[150px] truncate">
                          {c.posting?.title ?? '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-foreground">
                          {formatCurrency(c.amount)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{c.vendorName ?? '-'}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {c.invoiceDate ? new Date(c.invoiceDate).toLocaleDateString(locale) : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setDetailCost(c)}
                              className="p-1.5 rounded-lg hover:bg-background text-muted-foreground transition-colors duration-150"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(c.id)}
                              className="p-1.5 rounded-lg hover:bg-destructive/5 text-red-500 transition-colors duration-150"
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
          <div className="bg-card rounded-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between p-6 pb-0">
              <h2 className="text-lg font-bold text-foreground tracking-[-0.02em]">{t('registerCostTitle')}</h2>
              <button onClick={() => setShowCreate(false)} className="p-1 rounded-lg hover:bg-background text-muted-foreground transition-colors duration-150">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t('labelSource')}</label>
                <select
                  value={form.applicantSource}
                  onChange={(e) => setForm({ ...form, applicantSource: e.target.value })}
                  className="w-full px-4 py-2 text-sm border border-border rounded-lg bg-card focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors duration-150"
                >
                  {Object.entries(SOURCE_LABEL_KEYS).map(([k, labelKey]) => (
                    <option key={k} value={k}>{t(labelKey)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t('labelCostType')}</label>
                <select
                  value={form.costType}
                  onChange={(e) => setForm({ ...form, costType: e.target.value })}
                  className="w-full px-4 py-2 text-sm border border-border rounded-lg bg-card focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors duration-150"
                >
                  {Object.entries(COST_TYPE_LABEL_KEYS).map(([k, labelKey]) => (
                    <option key={k} value={k}>{t(labelKey)}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">{t('labelAmount')}</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="w-full px-4 py-2 text-sm border border-border rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors duration-150"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">{t('labelCurrency')}</label>
                  <select
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value })}
                    className="w-full px-4 py-2 text-sm border border-border rounded-lg bg-card focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors duration-150"
                  >
                    {['KRW', 'USD', 'CNY', 'RUB', 'VND', 'MXN', 'PLN'].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t('labelVendor')}</label>
                <input
                  placeholder={t('placeholderVendor')}
                  value={form.vendorName}
                  onChange={(e) => setForm({ ...form, vendorName: e.target.value })}
                  className="w-full px-4 py-2 text-sm border border-border rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors duration-150"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t('labelInvoiceDate')}</label>
                <input
                  type="date"
                  value={form.invoiceDate}
                  onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })}
                  className="w-full px-4 py-2 text-sm border border-border rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors duration-150"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">{t('labelDescription')}</label>
                <input
                  placeholder={t('placeholderDescription')}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-4 py-2 text-sm border border-border rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors duration-150"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 pt-0">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm font-medium text-muted-foreground border border-border rounded-lg hover:bg-background transition-colors duration-150"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !form.amount}
                className={`inline-flex items-center gap-2 ${BUTTON_SIZES.md} ${BUTTON_VARIANTS.primary} disabled:opacity-50`}
              >
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('register')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailCost && (
        <div className={MODAL_STYLES.container}>
          <div className="bg-card rounded-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-6 pb-0">
              <h2 className="text-lg font-bold text-foreground tracking-[-0.02em]">{t('costDetail')}</h2>
              <button onClick={() => setDetailCost(null)} className="p-1 rounded-lg hover:bg-background text-muted-foreground transition-colors duration-150">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t('labelCostType')}</span>
                <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${COST_TYPE_BADGE_STYLES[detailCost.costType] ?? COST_TYPE_BADGE_STYLES.OTHER}`}>
                  {COST_TYPE_LABEL_KEYS[detailCost.costType] ? t(COST_TYPE_LABEL_KEYS[detailCost.costType]) : detailCost.costType}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">{t('labelSource')}</span>
                <span className="text-sm font-medium text-foreground">
                  {SOURCE_LABEL_KEYS[detailCost.applicantSource] ? t(SOURCE_LABEL_KEYS[detailCost.applicantSource]) : detailCost.applicantSource}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">{t('labelAmount')}</span>
                <span className="text-sm font-bold text-primary">{formatCurrency(detailCost.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">{t('labelCurrency')}</span>
                <span className="text-sm text-foreground">{detailCost.currency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">{t('headerPosting')}</span>
                <span className="text-sm text-foreground">{detailCost.posting?.title ?? '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">{t('labelVendor')}</span>
                <span className="text-sm text-foreground">{detailCost.vendorName ?? '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">{t('labelInvoiceDate')}</span>
                <span className="text-sm text-foreground">
                  {detailCost.invoiceDate ? new Date(detailCost.invoiceDate).toLocaleDateString(locale) : '-'}
                </span>
              </div>
              {detailCost.description && (
                <div>
                  <span className="text-sm text-muted-foreground block mb-1">{t('labelDescription')}</span>
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
