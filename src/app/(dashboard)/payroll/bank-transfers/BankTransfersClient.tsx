'use client'

import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Bank Transfers Client
// 급여 이체 파일 생성 및 결과 관리
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import {
  Building2,
  Download,
  FileSpreadsheet,
  Loader2,
  Plus,
  Upload,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Eye,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import { BUTTON_VARIANTS, TABLE_STYLES } from '@/lib/styles'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────

interface BankTransferBatch {
  id: string
  bankCode: string
  bankName: string
  format: string
  status: string
  totalAmount: string
  totalCount: number
  successCount: number
  failCount: number
  fileUrl: string | null
  generatedAt: string | null
  submittedAt: string | null
  completedAt: string | null
  note: string | null
  createdAt: string
  _count?: { items: number }
}

interface BankTransferItem {
  id: string
  employeeName: string
  employeeNo: string
  bankCode: string
  accountNumber: string
  accountHolder: string
  amount: string
  status: string
  errorMessage: string | null
  transferredAt: string | null
}

// ─── Constants ──────────────────────────────────────────────

const BANKS = [
  { code: 'SHINHAN', labelKey: 'bankTransferPage.bankShinhan' as const },
  { code: 'KOOKMIN', labelKey: 'bankTransferPage.bankKookmin' as const },
  { code: 'WOORI', labelKey: 'bankTransferPage.bankWoori' as const },
  { code: 'HANA', labelKey: 'bankTransferPage.bankHana' as const },
  { code: 'NH', labelKey: 'bankTransferPage.bankNH' as const },
  { code: 'IBK', labelKey: 'bankTransferPage.bankIBK' as const },
  { code: 'SC', labelKey: 'bankTransferPage.bankSC' as const },
]

const STATUS_MAP: Record<string, { labelKey: string; color: string; icon: typeof Clock }> = {
  DRAFT: { labelKey: 'bankTransferPage.statusDraft', color: 'bg-background text-muted-foreground border-border', icon: Clock },
  GENERATING: { labelKey: 'bankTransferPage.statusGenerating', color: 'bg-primary/10 text-primary/90 border-primary/20', icon: Loader2 },
  GENERATED: { labelKey: 'bankTransferPage.statusGenerated', color: 'bg-indigo-500/15 text-primary/90 border-indigo-200', icon: FileSpreadsheet },
  SUBMITTED: { labelKey: 'bankTransferPage.statusSubmitted', color: 'bg-amber-500/15 text-amber-700 border-amber-300', icon: Upload },
  PARTIALLY_COMPLETED: { labelKey: 'bankTransferPage.statusPartial', color: 'bg-orange-500/10 text-orange-700 border-orange-200', icon: AlertTriangle },
  COMPLETED: { labelKey: 'bankTransferPage.statusCompleted', color: 'bg-emerald-500/15 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  FAILED: { labelKey: 'bankTransferPage.statusFailed', color: 'bg-destructive/10 text-destructive border-destructive/20', icon: XCircle },
}

const ITEM_STATUS_MAP: Record<string, { labelKey: string; color: string }> = {
  PENDING: { labelKey: 'bankTransferPage.itemPending', color: 'bg-background text-muted-foreground border-border' },
  SUCCESS: { labelKey: 'bankTransferPage.itemSuccess', color: 'bg-emerald-500/15 text-emerald-700 border-emerald-200' },
  FAILED: { labelKey: 'bankTransferPage.itemFailed', color: 'bg-destructive/10 text-destructive border-destructive/20' },
  CANCELLED: { labelKey: 'bankTransferPage.itemCancelled', color: 'bg-background text-muted-foreground border-border' },
}

// formatAmount는 컴포넌트 내부에서 locale을 사용하도록 이동

// ─── Component ──────────────────────────────────────────────

export function BankTransfersClient({ user }: { user: SessionUser }) {
  void user
  const t = useTranslations('payroll')
  const tCommon = useTranslations('common')
  const locale = useLocale()

  // 금액 포매팅 (locale 반영)
  const formatAmount = (amount: string | number): string => {
    return Number(amount).toLocaleString(locale, { style: 'currency', currency: 'KRW' })
  }

  const [batches, setBatches] = useState<BankTransferBatch[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Create modal
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newBatch, setNewBatch] = useState({
    bankCode: 'SHINHAN',
    bankName: t('bankTransferPage.bankShinhan'),
    format: 'CSV' as 'CSV' | 'XML' | 'EBCDIC',
    note: '',
  })

  // Detail modal
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedBatch, setSelectedBatch] = useState<BankTransferBatch | null>(null)
  const [batchItems, setBatchItems] = useState<BankTransferItem[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  // Actions loading
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // ─── Fetch ───
  const fetchBatches = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const res = await apiClient.get<{ data: BankTransferBatch[] }>(
        `/api/v1/bank-transfers?${params}`
      )
      setBatches(res.data?.data ?? [])
    } catch {
      setBatches([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    void fetchBatches()
  }, [fetchBatches])

  // ─── Create Batch ───
  const handleCreate = async () => {
    setCreating(true)
    try {
      await apiClient.post('/api/v1/bank-transfers', {
        bankCode: newBatch.bankCode,
        bankName: newBatch.bankName,
        format: newBatch.format,
        note: newBatch.note || null,
      })
      setCreateOpen(false)
      setNewBatch({ bankCode: 'SHINHAN', bankName: t('bankTransferPage.bankShinhan'), format: 'CSV', note: '' })
      await fetchBatches()
    } catch {
      // handled
    } finally {
      setCreating(false)
    }
  }

  // ─── View Detail ───
  const handleViewDetail = async (batch: BankTransferBatch) => {
    setSelectedBatch(batch)
    setDetailOpen(true)
    setDetailLoading(true)
    try {
      const res = await apiClient.get<{ data: BankTransferBatch & { items: BankTransferItem[] } }>(
        `/api/v1/bank-transfers/${batch.id}`
      )
      setBatchItems(res.data?.data?.items ?? [])
    } catch {
      setBatchItems([])
    } finally {
      setDetailLoading(false)
    }
  }

  // ─── Generate File ───
  const handleGenerate = async (batchId: string) => {
    setActionLoading(batchId)
    try {
      await apiClient.post(`/api/v1/bank-transfers/${batchId}/generate`, {})
      await fetchBatches()
    } catch {
      // handled
    } finally {
      setActionLoading(null)
    }
  }

  // ─── Mock Result Upload ───
  const handleMockResult = async (batchId: string) => {
    setActionLoading(batchId)
    try {
      // Simulate result: mark all items as SUCCESS
      const detail = await apiClient.get<{ data: BankTransferBatch & { items: BankTransferItem[] } }>(
        `/api/v1/bank-transfers/${batchId}`
      )
      const items = detail.data?.data?.items ?? []
      const results = items.map(item => ({
        employeeId: item.id,
        status: 'SUCCESS' as const,
        transferredAt: new Date().toISOString(),
      }))
      await apiClient.put(`/api/v1/bank-transfers/${batchId}/result`, { results })
      await fetchBatches()
    } catch {
      // handled
    } finally {
      setActionLoading(null)
    }
  }

  // ─── KPI ───
  const totalBatches = batches.length
  const completedBatches = batches.filter(b => b.status === 'COMPLETED').length
  const totalAmount = batches.reduce((sum, b) => sum + Number(b.totalAmount), 0)
  const pendingBatches = batches.filter(b => ['DRAFT', 'GENERATED', 'SUBMITTED'].includes(b.status)).length

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            {t('bankTransferPage.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('bankTransferPage.subtitle')}</p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className={BUTTON_VARIANTS.primary}
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('bankTransferPage.createBatch')}
        </Button>
      </div>

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">{t('bankTransferPage.totalBatches')}</p>
            <p className="text-3xl font-bold text-foreground">{totalBatches}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">{t('bankTransferPage.pendingBatches')}</p>
            <p className="text-3xl font-bold text-amber-600">{pendingBatches}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">{t('bankTransferPage.completed')}</p>
            <p className="text-3xl font-bold text-emerald-600">{completedBatches}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">{t('bankTransferPage.totalAmount')}</p>
            <p className="text-2xl font-bold text-primary">{formatAmount(totalAmount)}</p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Filter ─── */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('bankTransferPage.statusFilter')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('bankTransferPage.allStatus')}</SelectItem>
            {Object.entries(STATUS_MAP).map(([key, val]) => (
              <SelectItem key={key} value={key}>{t(val.labelKey)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ─── Batch List ─── */}
      {batches.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 text-border" />
            <EmptyState />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {batches.map(batch => {
            const st = STATUS_MAP[batch.status] ?? STATUS_MAP.DRAFT
            const isProcessing = actionLoading === batch.id
            return (
              <Card key={batch.id} className="hover:border-primary/20 transition-colors">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-semibold text-foreground">{batch.bankName}</p>
                          <p className="text-xs text-muted-foreground">{batch.bankCode} · {batch.format}</p>
                        </div>
                      </div>

                      <Badge className={`${st.color} border`}>{t(st.labelKey)}</Badge>
                    </div>

                    <div className="flex items-center gap-6">
                      {/* Stats */}
                      <div className="text-right">
                        <p className="text-sm font-bold text-foreground">{formatAmount(batch.totalAmount)}</p>
                        <p className="text-xs text-muted-foreground">
                          {t('bankTransferPage.itemCount', { count: batch.totalCount })}
                          {batch.successCount > 0 && (
                            <span className="text-emerald-600 ml-1">({t('bankTransferPage.successCount', { count: batch.successCount })})</span>
                          )}
                          {batch.failCount > 0 && (
                            <span className="text-red-500 ml-1">({t('bankTransferPage.failCount', { count: batch.failCount })})</span>
                          )}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetail(batch)}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          {t('bankTransferPage.detail')}
                        </Button>

                        {batch.status === 'DRAFT' && (
                          <Button
                            size="sm"
                            onClick={() => handleGenerate(batch.id)}
                            disabled={isProcessing}
                            className={BUTTON_VARIANTS.primary}
                          >
                            {isProcessing ? (
                              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                            ) : (
                              <FileSpreadsheet className="h-3.5 w-3.5 mr-1" />
                            )}
                            {t('bankTransferPage.generateFile')}
                          </Button>
                        )}

                        {batch.status === 'GENERATED' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                            >
                              <Download className="h-3.5 w-3.5 mr-1" />
                              {t('bankTransferPage.download')}
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleMockResult(batch.id)}
                              disabled={isProcessing}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              {isProcessing ? (
                                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                              ) : (
                                <Upload className="h-3.5 w-3.5 mr-1" />
                              )}
                              {t('bankTransferPage.processResult')}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Progress bar for partial completion */}
                  {batch.totalCount > 0 && batch.status !== 'DRAFT' && (
                    <div className="mt-3">
                      <div className="h-1.5 rounded-full bg-border overflow-hidden flex">
                        {batch.successCount > 0 && (
                          <div
                            className="bg-emerald-600 transition-all"
                            style={{ width: `${(batch.successCount / batch.totalCount) * 100}%` }}
                          />
                        )}
                        {batch.failCount > 0 && (
                          <div
                            className="bg-destructive/50 transition-all"
                            style={{ width: `${(batch.failCount / batch.totalCount) * 100}%` }}
                          />
                        )}
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground mt-2">
                    {new Intl.DateTimeFormat(locale).format(new Date(batch.createdAt))}
                    {batch.note && ` · ${batch.note}`}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ─── Create Modal ─── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('bankTransferPage.createTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">{t('bankTransferPage.selectBank')}</label>
              <Select
                value={newBatch.bankCode}
                onValueChange={v => {
                  const bank = BANKS.find(b => b.code === v)
                  setNewBatch(prev => ({
                    ...prev,
                    bankCode: v,
                    bankName: bank ? t(bank.labelKey) : v,
                  }))
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BANKS.map(bank => (
                    <SelectItem key={bank.code} value={bank.code}>{t(bank.labelKey)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">{t('bankTransferPage.fileFormat')}</label>
              <Select
                value={newBatch.format}
                onValueChange={v => setNewBatch(prev => ({ ...prev, format: v as 'CSV' | 'XML' | 'EBCDIC' }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CSV">CSV</SelectItem>
                  <SelectItem value="XML">XML</SelectItem>
                  <SelectItem value="EBCDIC">EBCDIC</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">{t('bankTransferPage.note')}</label>
              <Input
                value={newBatch.note}
                onChange={e => setNewBatch(prev => ({ ...prev, note: e.target.value }))}
                placeholder={t('bankTransferPage.notePlaceholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{tCommon('cancel')}</Button>
            <Button
              onClick={handleCreate}
              disabled={creating}
              className={BUTTON_VARIANTS.primary}
            >
              {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {t('bankTransferPage.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Detail Modal ─── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {t('bankTransferPage.detailTitle', { bank: selectedBatch?.bankName ?? '' })}
            </DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary */}
              {selectedBatch && (
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-background rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground">{t('bankTransferPage.totalPayroll')}</p>
                    <p className="text-lg font-bold">{selectedBatch.totalCount}</p>
                  </div>
                  <div className="bg-emerald-500/15 rounded-lg p-3 text-center">
                    <p className="text-xs text-emerald-600">{t('bankTransferPage.success')}</p>
                    <p className="text-lg font-bold text-emerald-700">{selectedBatch.successCount}</p>
                  </div>
                  <div className="bg-destructive/10 rounded-lg p-3 text-center">
                    <p className="text-xs text-red-500">{t('bankTransferPage.failed')}</p>
                    <p className="text-lg font-bold text-destructive">{selectedBatch.failCount}</p>
                  </div>
                  <div className="bg-primary/10 rounded-lg p-3 text-center">
                    <p className="text-xs text-primary">{t('bankTransferPage.totalPay')}</p>
                    <p className="text-lg font-bold text-primary/90">{formatAmount(selectedBatch.totalAmount)}</p>
                  </div>
                </div>
              )}

              {/* Items table */}
              <div className={TABLE_STYLES.wrapper}>
                <table className={TABLE_STYLES.table}>
                  <thead>
                    <tr className={TABLE_STYLES.header}>
                      <th className={TABLE_STYLES.headerCell}>{t('bankTransferPage.empNo')}</th>
                      <th className={TABLE_STYLES.headerCell}>{t('bankTransferPage.name')}</th>
                      <th className={TABLE_STYLES.headerCell}>{t('bankTransferPage.account')}</th>
                      <th className={TABLE_STYLES.headerCell}>{t('bankTransferPage.holder')}</th>
                      <th className={cn(TABLE_STYLES.headerCell, "text-right")}>{t('bankTransferPage.amount')}</th>
                      <th className={cn(TABLE_STYLES.headerCell, "text-center")}>{t('bankTransferPage.status')}</th>
                      <th className={TABLE_STYLES.headerCell}>{t('bankTransferPage.remark')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batchItems.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                          {t('bankTransferPage.noItems')}
                        </td>
                      </tr>
                    ) : (
                      batchItems.map(item => {
                        const ist = ITEM_STATUS_MAP[item.status] ?? ITEM_STATUS_MAP.PENDING
                        return (
                          <tr key={item.id} className={TABLE_STYLES.row}>
                            <td className={cn(TABLE_STYLES.cell, "font-mono tabular-nums text-xs")}>{item.employeeNo}</td>
                            <td className={cn(TABLE_STYLES.cell, "font-medium")}>{item.employeeName}</td>
                            <td className={cn(TABLE_STYLES.cell, "font-mono tabular-nums text-xs")}>{item.accountNumber}</td>
                            <td className={TABLE_STYLES.cell}>{item.accountHolder}</td>
                            <td className={cn(TABLE_STYLES.cell, "text-right font-medium")}>{formatAmount(item.amount)}</td>
                            <td className={cn(TABLE_STYLES.cell, "text-center")}>
                              <Badge className={`${ist.color} border`}>{t(ist.labelKey)}</Badge>
                            </td>
                            <td className={cn(TABLE_STYLES.cell, "text-red-500")}>{item.errorMessage ?? ''}</td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
