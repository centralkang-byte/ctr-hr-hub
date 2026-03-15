'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { BUTTON_VARIANTS,  TABLE_STYLES } from '@/lib/styles'

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
  { code: 'SHINHAN', name: '신한은행' },
  { code: 'KOOKMIN', name: 'KB국민은행' },
  { code: 'WOORI', name: '우려됨' },
  { code: 'HANA', name: '하나은행' },
  { code: 'NH', name: 'NH농협은행' },
  { code: 'IBK', name: 'IBK기업은행' },
  { code: 'SC', name: 'SC제일은행' },
]

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  DRAFT: { label: '임시저장', color: 'bg-[#FAFAFA] text-[#555] border-[#E8E8E8]', icon: Clock },
  GENERATING: { label: '생성', color: 'bg-[#EDF1FE] text-[#4B6DE0] border-[#EDF1FE]', icon: Loader2 },
  GENERATED: { label: '생성완료', color: 'bg-[#E0E7FF] text-[#4B6DE0] border-[#C7D2FE]', icon: FileSpreadsheet },
  SUBMITTED: { label: '제출됨', color: 'bg-[#FEF3C7] text-[#B45309] border-[#FCD34D]', icon: Upload },
  PARTIALLY_COMPLETED: { label: '부분완료', color: 'bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]', icon: AlertTriangle },
  COMPLETED: { label: '완료', color: 'bg-[#D1FAE5] text-[#047857] border-[#A7F3D0]', icon: CheckCircle2 },
  FAILED: { label: '실패', color: 'bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]', icon: XCircle },
}

const ITEM_STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING: { label: '🟡 대기', color: 'bg-[#FAFAFA] text-[#555] border-[#E8E8E8]' },
  SUCCESS: { label: '성공', color: 'bg-[#D1FAE5] text-[#047857] border-[#A7F3D0]' },
  FAILED: { label: '실패', color: 'bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]' },
  CANCELLED: { label: '취소', color: 'bg-[#FAFAFA] text-[#666] border-[#E8E8E8]' },
}

function formatAmount(amount: string | number): string {
  return Number(amount).toLocaleString('ko-KR', { style: 'currency', currency: 'KRW' })
}

// ─── Component ──────────────────────────────────────────────

export function BankTransfersClient({ user }: { user: SessionUser }) {
  void user

  const [batches, setBatches] = useState<BankTransferBatch[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Create modal
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newBatch, setNewBatch] = useState({
    bankCode: 'SHINHAN',
    bankName: '신한은행',
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
      setNewBatch({ bankCode: 'SHINHAN', bankName: '신한은행', format: 'CSV', note: '' })
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
        <Loader2 className="h-8 w-8 animate-spin text-[#5E81F4]" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A] flex items-center gap-2">
            <Building2 className="h-6 w-6 text-[#5E81F4]" />
            {'급여 이체 관리'}
          </h1>
          <p className="text-sm text-[#666] mt-1">{'은행별 급여 이체 파일 생성 및 결과 관리'}</p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className={BUTTON_VARIANTS.primary}
        >
          <Plus className="h-4 w-4 mr-2" />
          {'이체 배치 생성'}
        </Button>
      </div>

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-[#666] mb-1">{'전체 배치'}</p>
            <p className="text-3xl font-bold text-[#1A1A1A]">{totalBatches}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-[#666] mb-1">{'처리 대기'}</p>
            <p className="text-3xl font-bold text-[#D97706]">{pendingBatches}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-[#666] mb-1">{'완료'}</p>
            <p className="text-3xl font-bold text-[#059669]">{completedBatches}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-[#666] mb-1">{'총 이체액'}</p>
            <p className="text-2xl font-bold text-[#5E81F4]">{formatAmount(totalAmount)}</p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Filter ─── */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={'상태 필터'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{'전체 상태'}</SelectItem>
            {Object.entries(STATUS_MAP).map(([key, val]) => (
              <SelectItem key={key} value={key}>{val.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ─── Batch List ─── */}
      {batches.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-[#666]">
            <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 text-[#D4D4D4]" />
            <EmptyState title="데이터가 없습니다" description="조건을 변경하거나 새로운 데이터를 추가해보세요." />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {batches.map(batch => {
            const st = STATUS_MAP[batch.status] ?? STATUS_MAP.DRAFT
            const isProcessing = actionLoading === batch.id
            return (
              <Card key={batch.id} className="hover:border-[#EDF1FE] transition-colors">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-[#999]" />
                        <div>
                          <p className="text-sm font-semibold text-[#1A1A1A]">{batch.bankName}</p>
                          <p className="text-xs text-[#666]">{batch.bankCode} · {batch.format}</p>
                        </div>
                      </div>

                      <Badge className={`${st.color} border`}>{st.label}</Badge>
                    </div>

                    <div className="flex items-center gap-6">
                      {/* Stats */}
                      <div className="text-right">
                        <p className="text-sm font-bold text-[#1A1A1A]">{formatAmount(batch.totalAmount)}</p>
                        <p className="text-xs text-[#666]">
                          {batch.totalCount}건
                          {batch.successCount > 0 && (
                            <span className="text-[#059669] ml-1">({batch.successCount} 성공)</span>
                          )}
                          {batch.failCount > 0 && (
                            <span className="text-[#EF4444] ml-1">({batch.failCount} 실패)</span>
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
                          {'상세'}
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
                            파일 생성
                          </Button>
                        )}

                        {batch.status === 'GENERATED' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                            >
                              <Download className="h-3.5 w-3.5 mr-1" />
                              {'다운로드'}
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleMockResult(batch.id)}
                              disabled={isProcessing}
                              className="bg-[#059669] hover:bg-[#047857] text-white"
                            >
                              {isProcessing ? (
                                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                              ) : (
                                <Upload className="h-3.5 w-3.5 mr-1" />
                              )}
                              결과 처리
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Progress bar for partial completion */}
                  {batch.totalCount > 0 && batch.status !== 'DRAFT' && (
                    <div className="mt-3">
                      <div className="h-1.5 rounded-full bg-[#E8E8E8] overflow-hidden flex">
                        {batch.successCount > 0 && (
                          <div
                            className="bg-[#059669] transition-all"
                            style={{ width: `${(batch.successCount / batch.totalCount) * 100}%` }}
                          />
                        )}
                        {batch.failCount > 0 && (
                          <div
                            className="bg-[#EF4444] transition-all"
                            style={{ width: `${(batch.failCount / batch.totalCount) * 100}%` }}
                          />
                        )}
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-[#999] mt-2">
                    {new Date(batch.createdAt).toLocaleDateString('ko-KR')}
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
            <DialogTitle>{'이체 배치 생성'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[#333] mb-1 block">{'은행 선택'}</label>
              <Select
                value={newBatch.bankCode}
                onValueChange={v => {
                  const bank = BANKS.find(b => b.code === v)
                  setNewBatch(prev => ({
                    ...prev,
                    bankCode: v,
                    bankName: bank?.name ?? v,
                  }))
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BANKS.map(bank => (
                    <SelectItem key={bank.code} value={bank.code}>{bank.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-[#333] mb-1 block">{'파일 형식'}</label>
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
              <label className="text-sm font-medium text-[#333] mb-1 block">{'비고'}</label>
              <Input
                value={newBatch.note}
                onChange={e => setNewBatch(prev => ({ ...prev, note: e.target.value }))}
                placeholder={'비고 입력 (선택)'}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{'취소'}</Button>
            <Button
              onClick={handleCreate}
              disabled={creating}
              className={BUTTON_VARIANTS.primary}
            >
              {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              생성
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Detail Modal ─── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-[#5E81F4]" />
              {selectedBatch?.bankName} 이체 상세
            </DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#5E81F4]" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary */}
              {selectedBatch && (
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-[#FAFAFA] rounded-lg p-3 text-center">
                    <p className="text-xs text-[#666]">{'① 총급여'}</p>
                    <p className="text-lg font-bold">{selectedBatch.totalCount}</p>
                  </div>
                  <div className="bg-[#D1FAE5] rounded-lg p-3 text-center">
                    <p className="text-xs text-[#059669]">{'성공'}</p>
                    <p className="text-lg font-bold text-[#047857]">{selectedBatch.successCount}</p>
                  </div>
                  <div className="bg-[#FEE2E2] rounded-lg p-3 text-center">
                    <p className="text-xs text-[#EF4444]">{'실패'}</p>
                    <p className="text-lg font-bold text-[#DC2626]">{selectedBatch.failCount}</p>
                  </div>
                  <div className="bg-[#EDF1FE] rounded-lg p-3 text-center">
                    <p className="text-xs text-[#5E81F4]">{'총지급액'}</p>
                    <p className="text-lg font-bold text-[#4B6DE0]">{formatAmount(selectedBatch.totalAmount)}</p>
                  </div>
                </div>
              )}

              {/* Items table */}
              <div className="overflow-x-auto rounded-lg border">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className={TABLE_STYLES.header}>
                      <th className={TABLE_STYLES.headerCell}>{'사번'}</th>
                      <th className={TABLE_STYLES.headerCell}>{'이름'}</th>
                      <th className={TABLE_STYLES.headerCell}>{'계약직'}</th>
                      <th className={TABLE_STYLES.headerCell}>{'예금주'}</th>
                      <th className={TABLE_STYLES.headerCellRight}>{'금액'}</th>
                      <th className={TABLE_STYLES.headerCell}>{'상태'}</th>
                      <th className={TABLE_STYLES.headerCell}>{'비고'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batchItems.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-[#666]">
                          {'이체 항목이 없습니다.'}
                        </td>
                      </tr>
                    ) : (
                      batchItems.map(item => {
                        const ist = ITEM_STATUS_MAP[item.status] ?? ITEM_STATUS_MAP.PENDING
                        return (
                          <tr key={item.id} className="border-t border-[#F5F5F5] hover:bg-[#FAFAFA]">
                            <td className="px-4 py-3 font-mono text-xs">{item.employeeNo}</td>
                            <td className="px-4 py-3 font-medium">{item.employeeName}</td>
                            <td className="px-4 py-3 font-mono text-xs">{item.accountNumber}</td>
                            <td className="px-4 py-3">{item.accountHolder}</td>
                            <td className="px-4 py-3 text-right font-medium">{formatAmount(item.amount)}</td>
                            <td className="px-4 py-3 text-center">
                              <Badge className={`${ist.color} border`}>{ist.label}</Badge>
                            </td>
                            <td className="px-4 py-3 text-xs text-[#EF4444]">{item.errorMessage ?? ''}</td>
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
