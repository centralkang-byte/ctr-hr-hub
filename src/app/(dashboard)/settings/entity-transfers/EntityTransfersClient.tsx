'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Entity Transfers Dashboard (STEP 9-3)
// F5 글로벌 법인 간 전출/전입 관리
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import {
  Plus, Loader2, ArrowRight, Building2, CheckCircle2,
  XCircle, Clock, AlertTriangle, User, ChevronRight,
  Play, Search,
} from 'lucide-react'
import type { SessionUser } from '@/types'
import { apiClient } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'

// ─── Types ──────────────────────────────────────────────

interface EntityTransfer {
  id: string
  status: string
  transferType: string
  transferDate: string
  returnDate: string | null
  dataOptions: { leavePolicy: string; tenurePolicy: string; performancePolicy: string } | null
  newEmployeeNo: string | null
  requestedAt: string
  completedAt: string | null
  employee: { id: string; name: string; employeeNo: string }
  fromCompany: { id: string; name: string; code: string }
  toCompany: { id: string; name: string; code: string }
  requester?: { name: string }
  fromApproverEmp?: { name: string } | null
  fromApprovedAt?: string | null
  toApproverEmp?: { name: string } | null
  toApprovedAt?: string | null
  execApproverEmp?: { name: string } | null
  executiveApprovedAt?: string | null
  newDepartment?: { name: string } | null
  newJobGrade?: { name: string } | null
  dataLogs?: Array<{ dataType: string; status: string; migratedAt: string | null }>
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  TRANSFER_REQUESTED: { label: '요청됨', color: 'bg-[#FEF3C7] text-[#B45309] border-[#FCD34D]', icon: Clock },
  FROM_APPROVED: { label: '출발법인 승인', color: 'bg-[#E8F5E9] text-[#00A844] border-[#E8F5E9]', icon: CheckCircle2 },
  TO_APPROVED: { label: '도착법인 승인', color: 'bg-[#E8F5E9] text-[#00A844] border-[#E8F5E9]', icon: CheckCircle2 },
  EXEC_APPROVED: { label: '임원 승인', color: 'bg-[#E0E7FF] text-[#4338CA] border-[#C7D2FE]', icon: CheckCircle2 },
  TRANSFER_PROCESSING: { label: '처리중', color: 'bg-[#FEF3C7] text-[#B45309] border-[#FCD34D]', icon: Loader2 },
  TRANSFER_COMPLETED: { label: '완료', color: 'bg-[#D1FAE5] text-[#047857] border-[#A7F3D0]', icon: CheckCircle2 },
  TRANSFER_CANCELLED: { label: '취소', color: 'bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]', icon: XCircle },
}

const TRANSFER_TYPES: Record<string, string> = {
  PERMANENT_TRANSFER: '정식 전출',
  TEMPORARY_TRANSFER: '임시 파견',
  SECONDMENT: '출향',
}

// ─── Component ──────────────────────────────────────────

export function EntityTransfersClient({ user }: { user: SessionUser }) {
  const [transfers, setTransfers] = useState<EntityTransfer[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  // Detail modal
  const [selectedTransfer, setSelectedTransfer] = useState<EntityTransfer | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [formEmployeeId, setFormEmployeeId] = useState('')
  const [formToCompanyId, setFormToCompanyId] = useState('')
  const [formTransferType, setFormTransferType] = useState('PERMANENT_TRANSFER')
  const [formTransferDate, setFormTransferDate] = useState('')
  const [formReturnDate, setFormReturnDate] = useState('')
  const [formLeavePolicy, setFormLeavePolicy] = useState('CARRY_OVER')
  const [formTenurePolicy, setFormTenurePolicy] = useState('GROUP_CONTINUOUS')

  // ─── Fetch ──────────────────────────────────────────────

  const fetchTransfers = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page: 1, limit: 50 }
      if (statusFilter !== 'ALL') params.status = statusFilter
      const res = await apiClient.getList<EntityTransfer>('/api/v1/entity-transfers', params)
      setTransfers(res.data)
    } catch { /* silent */ } finally { setLoading(false) }
  }, [statusFilter])

  useEffect(() => { void fetchTransfers() }, [fetchTransfers])

  // ─── Detail ─────────────────────────────────────────────

  const openDetail = async (id: string) => {
    setLoadingDetail(true)
    setShowDetailModal(true)
    try {
      const res = await apiClient.get<EntityTransfer>(`/api/v1/entity-transfers/${id}`)
      setSelectedTransfer(res.data)
    } catch { /* silent */ } finally { setLoadingDetail(false) }
  }

  // ─── Approve/Reject ─────────────────────────────────────

  const handleApprove = async (id: string, action: 'approve' | 'reject') => {
    if (action === 'reject' && !confirm('전출 요청을 반려하시겠습니까?')) return
    try {
      await apiClient.put(`/api/v1/entity-transfers/${id}/approve`, { action })
      void fetchTransfers()
      if (selectedTransfer?.id === id) void openDetail(id)
    } catch { /* silent */ }
  }

  // ─── Execute ────────────────────────────────────────────

  const handleExecute = async (id: string) => {
    if (!confirm('전출을 실행하시겠습니까? 직원 정보가 이관됩니다.')) return
    try {
      await apiClient.put(`/api/v1/entity-transfers/${id}/execute`)
      void fetchTransfers()
      if (selectedTransfer?.id === id) void openDetail(id)
    } catch { /* silent */ }
  }

  // ─── Create ─────────────────────────────────────────────

  const handleCreate = async () => {
    if (!formEmployeeId || !formToCompanyId || !formTransferDate) return
    setCreating(true)
    try {
      await apiClient.post('/api/v1/entity-transfers', {
        employeeId: formEmployeeId,
        toCompanyId: formToCompanyId,
        transferType: formTransferType,
        transferDate: formTransferDate,
        returnDate: formReturnDate || undefined,
        dataOptions: {
          leavePolicy: formLeavePolicy,
          tenurePolicy: formTenurePolicy,
          performancePolicy: 'CARRY',
        },
      })
      setShowCreateModal(false)
      void fetchTransfers()
    } catch { /* silent */ } finally { setCreating(false) }
  }

  // ─── Filter ─────────────────────────────────────────────

  const filtered = transfers.filter(t => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return t.employee.name.toLowerCase().includes(q) ||
           t.employee.employeeNo.toLowerCase().includes(q) ||
           t.fromCompany.name.toLowerCase().includes(q) ||
           t.toCompany.name.toLowerCase().includes(q)
  })

  // ─── KPI ────────────────────────────────────────────────

  const kpis = {
    total: transfers.length,
    pending: transfers.filter(t => !['TRANSFER_COMPLETED', 'TRANSFER_CANCELLED'].includes(t.status)).length,
    completed: transfers.filter(t => t.status === 'TRANSFER_COMPLETED').length,
    cancelled: transfers.filter(t => t.status === 'TRANSFER_CANCELLED').length,
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="법인 간 전출/전입 관리"
        description="글로벌 법인 간 전출, 전입, 파견을 관리합니다."
        actions={
          <Button onClick={() => setShowCreateModal(true)} className="bg-[#00C853] hover:bg-[#00A844] text-white">
            <Plus className="mr-2 h-4 w-4" /> 전출 요청
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: '전체 요청', value: kpis.total, color: 'text-[#1A1A1A]' },
          { label: '진행중', value: kpis.pending, color: 'text-[#D97706]' },
          { label: '완료', value: kpis.completed, color: 'text-[#059669]' },
          { label: '취소/반려', value: kpis.cancelled, color: 'text-[#EF4444]' },
        ].map(kpi => (
          <Card key={kpi.label} className="border border-[#E8E8E8]">
            <CardContent className="p-5">
              <p className="text-xs text-[#666] mb-1">{kpi.label}</p>
              <p className={`text-3xl font-bold ${kpi.color}`}>{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#999]" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="직원명, 사번, 법인명 검색"
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="상태 필터" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">전체 상태</SelectItem>
            {Object.entries(STATUS_MAP).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Transfer List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[#999]" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-[#666]">
            전출/전입 요청이 없습니다.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(t => {
            const st = STATUS_MAP[t.status] ?? STATUS_MAP.TRANSFER_REQUESTED
            const StIcon = st.icon
            return (
              <Card
                key={t.id}
                className="border border-[#E8E8E8] hover:border-[#D4D4D4] transition-colors cursor-pointer"
                onClick={() => openDetail(t.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Employee */}
                      <div className="flex items-center gap-2">
                        <div className="h-10 w-10 rounded-full bg-[#F5F5F5] flex items-center justify-center">
                          <User className="h-5 w-5 text-[#666]" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#1A1A1A]">{t.employee.name}</p>
                          <p className="text-xs text-[#666]">{t.employee.employeeNo}</p>
                        </div>
                      </div>

                      {/* Transfer direction */}
                      <div className="flex items-center gap-2 text-sm">
                        <div className="flex items-center gap-1 px-2 py-1 bg-[#FAFAFA] rounded">
                          <Building2 className="h-3.5 w-3.5 text-[#999]" />
                          <span className="font-medium text-[#333]">{t.fromCompany.code}</span>
                        </div>
                        <ArrowRight className="h-4 w-4 text-[#00C853]" />
                        <div className="flex items-center gap-1 px-2 py-1 bg-[#E8F5E9] rounded">
                          <Building2 className="h-3.5 w-3.5 text-[#00C853]" />
                          <span className="font-medium text-[#00A844]">{t.toCompany.code}</span>
                        </div>
                      </div>

                      {/* Type */}
                      <Badge variant="outline" className="text-xs">
                        {TRANSFER_TYPES[t.transferType] ?? t.transferType}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[#666]">
                        {new Date(t.transferDate).toLocaleDateString('ko-KR')}
                      </span>
                      <Badge className={`${st.color} border text-xs gap-1`}>
                        <StIcon className="h-3 w-3" />
                        {st.label}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-[#D4D4D4]" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ─── Detail Modal ───────────────────────────────────── */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {loadingDetail ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : selectedTransfer ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  법인 전출 상세
                  <Badge className={`${STATUS_MAP[selectedTransfer.status]?.color ?? ''} border text-xs`}>
                    {STATUS_MAP[selectedTransfer.status]?.label ?? selectedTransfer.status}
                  </Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6">
                {/* Basic info */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-[#666]">직원</p>
                    <p className="font-medium">{selectedTransfer.employee.name} ({selectedTransfer.employee.employeeNo})</p>
                  </div>
                  <div>
                    <p className="text-[#666]">전출 유형</p>
                    <p className="font-medium">{TRANSFER_TYPES[selectedTransfer.transferType]}</p>
                  </div>
                  <div>
                    <p className="text-[#666]">출발 법인</p>
                    <p className="font-medium">{selectedTransfer.fromCompany.name}</p>
                  </div>
                  <div>
                    <p className="text-[#666]">도착 법인</p>
                    <p className="font-medium">{selectedTransfer.toCompany.name}</p>
                  </div>
                  <div>
                    <p className="text-[#666]">전출일</p>
                    <p className="font-medium">{new Date(selectedTransfer.transferDate).toLocaleDateString('ko-KR')}</p>
                  </div>
                  {selectedTransfer.newDepartment && (
                    <div>
                      <p className="text-[#666]">신규 부서</p>
                      <p className="font-medium">{selectedTransfer.newDepartment.name}</p>
                    </div>
                  )}
                </div>

                {/* Approval Timeline */}
                <div>
                  <h4 className="text-sm font-semibold text-[#333] mb-3">승인 워크플로</h4>
                  <div className="relative pl-6 space-y-4">
                    {[
                      { step: '출발법인 HR 승인', approver: selectedTransfer.fromApproverEmp?.name, date: selectedTransfer.fromApprovedAt, done: !!selectedTransfer.fromApprovedAt },
                      { step: '도착법인 HR 승인', approver: selectedTransfer.toApproverEmp?.name, date: selectedTransfer.toApprovedAt, done: !!selectedTransfer.toApprovedAt },
                      { step: '임원 최종 승인', approver: selectedTransfer.execApproverEmp?.name, date: selectedTransfer.executiveApprovedAt, done: !!selectedTransfer.executiveApprovedAt },
                    ].map((s, i) => (
                      <div key={i} className="relative">
                        <div className={`absolute -left-6 top-0.5 h-4 w-4 rounded-full border-2 ${
                          s.done ? 'bg-[#059669] border-[#059669]' :
                          selectedTransfer.status === 'TRANSFER_CANCELLED' ? 'bg-[#FCA5A5] border-[#FCA5A5]' :
                          'bg-[#E8E8E8] border-[#E8E8E8]'
                        }`}>
                          {s.done && <CheckCircle2 className="h-3 w-3 text-white ml-[1px] mt-[1px]" />}
                        </div>
                        {i < 2 && (
                          <div className={`absolute -left-[14px] top-5 h-6 w-0.5 ${s.done ? 'bg-[#6EE7B7]' : 'bg-[#E8E8E8]'}`} />
                        )}
                        <div>
                          <p className="text-sm font-medium text-[#333]">{s.step}</p>
                          {s.done ? (
                            <p className="text-xs text-[#666]">
                              {s.approver} · {new Date(s.date!).toLocaleDateString('ko-KR')}
                            </p>
                          ) : (
                            <p className="text-xs text-[#999]">대기중</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Data migration logs */}
                {selectedTransfer.dataLogs && selectedTransfer.dataLogs.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-[#333] mb-2">데이터 이관 현황</h4>
                    <div className="grid grid-cols-5 gap-2">
                      {selectedTransfer.dataLogs.map(log => (
                        <div key={log.dataType} className={`rounded-lg border p-2 text-center text-xs ${
                          log.status === 'DATA_MIGRATED' ? 'bg-[#D1FAE5] border-[#A7F3D0] text-[#047857]' :
                          log.status === 'DATA_FAILED' ? 'bg-[#FEE2E2] border-[#FECACA] text-[#B91C1C]' :
                          'bg-[#FAFAFA] border-[#E8E8E8] text-[#555]'
                        }`}>
                          <p className="font-medium">{log.dataType.replace('_', ' ')}</p>
                          <p>{log.status === 'DATA_MIGRATED' ? '완료' : log.status === 'DATA_FAILED' ? '실패' : '대기'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Data options */}
                {selectedTransfer.dataOptions && (
                  <div>
                    <h4 className="text-sm font-semibold text-[#333] mb-2">이관 옵션</h4>
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div className="rounded-lg border border-[#E8E8E8] p-2">
                        <p className="text-[#666]">연차 정책</p>
                        <p className="font-medium">{selectedTransfer.dataOptions.leavePolicy === 'CARRY_OVER' ? '이월' : '정산'}</p>
                      </div>
                      <div className="rounded-lg border border-[#E8E8E8] p-2">
                        <p className="text-[#666]">근속연수</p>
                        <p className="font-medium">{selectedTransfer.dataOptions.tenurePolicy === 'GROUP_CONTINUOUS' ? '그룹 통산' : '법인 리셋'}</p>
                      </div>
                      <div className="rounded-lg border border-[#E8E8E8] p-2">
                        <p className="text-[#666]">성과 이력</p>
                        <p className="font-medium">{selectedTransfer.dataOptions.performancePolicy === 'CARRY' ? '이관' : '아카이브'}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <DialogFooter className="gap-2">
                {['TRANSFER_REQUESTED', 'FROM_APPROVED', 'TO_APPROVED'].includes(selectedTransfer.status) && (
                  <>
                    <Button variant="outline" onClick={() => handleApprove(selectedTransfer.id, 'reject')}
                      className="border-[#FCA5A5] text-[#DC2626] hover:bg-[#FEE2E2]">
                      <XCircle className="h-4 w-4 mr-1" /> 반려
                    </Button>
                    <Button onClick={() => handleApprove(selectedTransfer.id, 'approve')}
                      className="bg-[#059669] hover:bg-[#047857] text-white">
                      <CheckCircle2 className="h-4 w-4 mr-1" /> 승인
                    </Button>
                  </>
                )}
                {selectedTransfer.status === 'EXEC_APPROVED' && (
                  <Button onClick={() => handleExecute(selectedTransfer.id)}
                    className="bg-[#00C853] hover:bg-[#00A844] text-white">
                    <Play className="h-4 w-4 mr-1" /> 전출 실행
                  </Button>
                )}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ─── Create Modal ───────────────────────────────────── */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>전출 요청</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-[#333]">직원 ID</Label>
              <Input value={formEmployeeId} onChange={e => setFormEmployeeId(e.target.value)}
                placeholder="직원 UUID" className="mt-1" />
            </div>
            <div>
              <Label className="text-sm font-medium text-[#333]">도착 법인 ID</Label>
              <Input value={formToCompanyId} onChange={e => setFormToCompanyId(e.target.value)}
                placeholder="법인 UUID" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-[#333]">전출 유형</Label>
                <Select value={formTransferType} onValueChange={setFormTransferType}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TRANSFER_TYPES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium text-[#333]">전출일</Label>
                <Input type="date" value={formTransferDate} onChange={e => setFormTransferDate(e.target.value)} className="mt-1" />
              </div>
            </div>
            {formTransferType !== 'PERMANENT_TRANSFER' && (
              <div>
                <Label className="text-sm font-medium text-[#333]">복귀 예정일</Label>
                <Input type="date" value={formReturnDate} onChange={e => setFormReturnDate(e.target.value)} className="mt-1" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-[#333]">연차 정책</Label>
                <Select value={formLeavePolicy} onValueChange={setFormLeavePolicy}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CARRY_OVER">이월</SelectItem>
                    <SelectItem value="SETTLE">정산</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium text-[#333]">근속연수</Label>
                <Select value={formTenurePolicy} onValueChange={setFormTenurePolicy}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GROUP_CONTINUOUS">그룹 통산</SelectItem>
                    <SelectItem value="ENTITY_RESET">법인 리셋</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>취소</Button>
            <Button onClick={handleCreate} disabled={creating || !formEmployeeId || !formToCompanyId || !formTransferDate}
              className="bg-[#00C853] hover:bg-[#00A844] text-white">
              {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              요청 생성
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
