'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 휴직 관리 (신청 + 승인/거부 + 이력)
// HR Admin: 전사 휴직 목록 + 승인/거부
// 일반 직원: 본인 휴직 이력 + 신청
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import {
  Shield, Plus, CheckCircle2, Clock, Pause, AlertCircle,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { TABLE_STYLES } from '@/lib/styles'
import { formatDateLocale } from '@/lib/format/date'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'

interface Props { user: SessionUser }

interface LoaRecord {
  id: string
  startDate: string
  expectedEndDate: string | null
  actualEndDate: string | null
  status: string
  reason: string | null
  splitSequence: number
  requestedAt: string
  approvedAt: string | null
  rejectionReason: string | null
  employee: { id: string; name: string; nameEn: string | null; employeeNo: string }
  type: { id: string; code: string; name: string; nameEn: string | null; category: string }
  approver: { id: string; name: string } | null
}

interface LoaType {
  id: string
  code: string
  name: string
  nameEn: string | null
  category: string
  maxDurationDays: number | null
  requiresProof: boolean
  proofDescription: string | null
}

const STATUS_LABELS: Record<string, string> = {
  REQUESTED: '신청',
  APPROVED: '승인',
  ACTIVE: '휴직중',
  RETURN_REQUESTED: '복직신청',
  COMPLETED: '복직완료',
  REJECTED: '거부',
  CANCELLED: '취소',
}

const STATUS_COLORS: Record<string, string> = {
  REQUESTED: 'bg-yellow-500/15 text-yellow-700',
  APPROVED: 'bg-primary/10 text-primary',
  ACTIVE: 'bg-orange-500/15 text-orange-700',
  RETURN_REQUESTED: 'bg-purple-500/15 text-purple-700',
  COMPLETED: 'bg-tertiary-container/20 text-tertiary',
  REJECTED: 'bg-destructive/10 text-destructive',
  CANCELLED: 'bg-muted text-muted-foreground',
}

export function LoaClient({ user }: Props) {
  const isHrAdmin = user.role === ROLE.SUPER_ADMIN || user.role === ROLE.HR_ADMIN

  const [records, setRecords] = useState<LoaRecord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('all')
  const [loaTypes, setLoaTypes] = useState<LoaType[]>([])

  // 신청 다이얼로그
  const [requestOpen, setRequestOpen] = useState(false)
  const [requestForm, setRequestForm] = useState({
    employeeId: '', typeId: '', startDate: '', expectedEndDate: '', reason: '',
  })
  const [requestLoading, setRequestLoading] = useState(false)

  // 승인/거부 다이얼로그
  const [actionOpen, setActionOpen] = useState(false)
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve')
  const [actionTarget, setActionTarget] = useState<LoaRecord | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  // 복직 신청 다이얼로그
  const [returnOpen, setReturnOpen] = useState(false)
  const [returnTarget, setReturnTarget] = useState<LoaRecord | null>(null)
  const [returnNotes, setReturnNotes] = useState('')
  const [returnLoading, setReturnLoading] = useState(false)

  // 복직 완료 다이얼로그
  const [completeOpen, setCompleteOpen] = useState(false)
  const [completeTarget, setCompleteTarget] = useState<LoaRecord | null>(null)
  const [completeForm, setCompleteForm] = useState({
    actualEndDate: new Date().toISOString().slice(0, 10),
    returnPositionId: '',
    returnNotes: '',
  })
  const [completeLoading, setCompleteLoading] = useState(false)

  // Fetch LOA records
  const fetchRecords = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('limit', '20')
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (!isHrAdmin && user.employeeId) params.set('employeeId', user.employeeId)

    try {
      const res = await fetch(`/api/v1/leave-of-absence?${params}`)
      const json = await res.json()
      if (json.data) setRecords(json.data)
      if (json.pagination) setTotal(json.pagination.total)
    } catch {
      toast({ title: '휴직 목록 로드 실패', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, isHrAdmin, user.employeeId])

  // Fetch LOA types
  const fetchTypes = useCallback(async () => {
    const res = await fetch('/api/v1/leave-of-absence/types')
    const json = await res.json()
    if (json.data) setLoaTypes(json.data)
  }, [])

  useEffect(() => { fetchRecords() }, [fetchRecords])
  useEffect(() => { fetchTypes() }, [fetchTypes])

  // 신청
  const handleRequest = async () => {
    if (!requestForm.typeId || !requestForm.startDate) {
      toast({ title: '휴직 유형과 시작일은 필수입니다', variant: 'destructive' })
      return
    }
    setRequestLoading(true)
    try {
      const body = {
        employeeId: isHrAdmin ? requestForm.employeeId : user.employeeId,
        typeId: requestForm.typeId,
        startDate: requestForm.startDate,
        expectedEndDate: requestForm.expectedEndDate || undefined,
        reason: requestForm.reason || undefined,
      }
      const res = await fetch('/api/v1/leave-of-absence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        toast({ title: '휴직이 신청되었습니다' })
        setRequestOpen(false)
        setRequestForm({ employeeId: '', typeId: '', startDate: '', expectedEndDate: '', reason: '' })
        fetchRecords()
      } else {
        const err = await res.json()
        toast({ title: '신청 실패', description: err.error?.message, variant: 'destructive' })
      }
    } finally {
      setRequestLoading(false)
    }
  }

  // 승인/거부
  const handleAction = async () => {
    if (!actionTarget) return
    if (actionType === 'reject' && !rejectionReason.trim()) {
      toast({ title: '거부 사유를 입력해주세요', variant: 'destructive' })
      return
    }
    setActionLoading(true)
    try {
      const res = await fetch(`/api/v1/leave-of-absence/${actionTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionType,
          ...(actionType === 'reject' ? { rejectionReason } : {}),
        }),
      })
      if (res.ok) {
        toast({ title: actionType === 'approve' ? '승인되었습니다' : '거부되었습니다' })
        setActionOpen(false)
        setActionTarget(null)
        setRejectionReason('')
        fetchRecords()
      } else {
        const err = await res.json()
        toast({ title: '처리 실패', description: err.error?.message, variant: 'destructive' })
      }
    } finally {
      setActionLoading(false)
    }
  }

  // 활성화 (APPROVED → ACTIVE)
  const handleActivate = async (record: LoaRecord) => {
    if (!confirm(`${record.employee.name}의 휴직을 시작하시겠습니까? 직원 상태가 ON_LEAVE로 변경됩니다.`)) return
    const res = await fetch(`/api/v1/leave-of-absence/${record.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'activate' }),
    })
    if (res.ok) {
      toast({ title: '휴직이 시작되었습니다' })
      fetchRecords()
    } else {
      const err = await res.json()
      toast({ title: '처리 실패', description: err.error?.message, variant: 'destructive' })
    }
  }

  // 복직 신청 (ACTIVE → RETURN_REQUESTED) — 다이얼로그 제출
  const handleReturnSubmit = async () => {
    if (!returnTarget) return
    setReturnLoading(true)
    try {
      const res = await fetch(`/api/v1/leave-of-absence/${returnTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'return', notes: returnNotes || undefined }),
      })
      if (res.ok) {
        toast({ title: '복직 신청되었습니다' })
        setReturnOpen(false)
        setReturnTarget(null)
        setReturnNotes('')
        fetchRecords()
      } else {
        const err = await res.json()
        toast({ title: '처리 실패', description: err.error?.message, variant: 'destructive' })
      }
    } finally {
      setReturnLoading(false)
    }
  }

  // 복직 완료 (RETURN_REQUESTED → COMPLETED) — 다이얼로그 제출
  const handleCompleteSubmit = async () => {
    if (!completeTarget) return
    if (!completeForm.actualEndDate) {
      toast({ title: '실제 복직일을 입력해주세요', variant: 'destructive' })
      return
    }
    setCompleteLoading(true)
    try {
      const res = await fetch(`/api/v1/leave-of-absence/${completeTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete',
          actualEndDate: completeForm.actualEndDate,
          returnPositionId: completeForm.returnPositionId || undefined,
          returnNotes: completeForm.returnNotes || undefined,
        }),
      })
      if (res.ok) {
        toast({ title: '복직이 완료되었습니다' })
        setCompleteOpen(false)
        setCompleteTarget(null)
        setCompleteForm({ actualEndDate: new Date().toISOString().slice(0, 10), returnPositionId: '', returnNotes: '' })
        fetchRecords()
      } else {
        const err = await res.json()
        toast({ title: '처리 실패', description: err.error?.message, variant: 'destructive' })
      }
    } finally {
      setCompleteLoading(false)
    }
  }

  // 취소
  const handleCancel = async (record: LoaRecord) => {
    if (!confirm('이 휴직을 취소하시겠습니까?')) return
    const res = await fetch(`/api/v1/leave-of-absence/${record.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    })
    if (res.ok) {
      toast({ title: '취소되었습니다' })
      fetchRecords()
    } else {
      const err = await res.json()
      toast({ title: '취소 실패', description: err.error?.message, variant: 'destructive' })
    }
  }

  const totalPages = Math.ceil(total / 20)
  const pendingCount = records.filter(r => r.status === 'REQUESTED').length

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">휴직 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isHrAdmin ? '전사 휴직 신청 관리 및 승인' : '내 휴직 이력 및 신청'}
          </p>
        </div>
        <Button onClick={() => {
          if (!isHrAdmin && user.employeeId) {
            setRequestForm(f => ({ ...f, employeeId: user.employeeId! }))
          }
          setRequestOpen(true)
        }}>
          <Plus className="h-4 w-4 mr-1" /> 휴직 신청
        </Button>
      </div>

      {/* KPI */}
      {isHrAdmin && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <KpiCard icon={Clock} label="승인 대기" value={pendingCount} color="yellow" />
          <KpiCard icon={Pause} label="휴직중" value={records.filter(r => r.status === 'ACTIVE').length} color="orange" />
          <KpiCard icon={AlertCircle} label="복직 대기" value={records.filter(r => r.status === 'RETURN_REQUESTED').length} color="purple" />
          <KpiCard icon={CheckCircle2} label="완료" value={records.filter(r => r.status === 'COMPLETED').length} color="green" />
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1) }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="상태 필터" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 상태</SelectItem>
            <SelectItem value="REQUESTED">신청</SelectItem>
            <SelectItem value="APPROVED">승인</SelectItem>
            <SelectItem value="ACTIVE">휴직중</SelectItem>
            <SelectItem value="RETURN_REQUESTED">복직신청</SelectItem>
            <SelectItem value="COMPLETED">완료</SelectItem>
            <SelectItem value="REJECTED">거부</SelectItem>
            <SelectItem value="CANCELLED">취소</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">총 {total}건</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">로딩 중...</div>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-muted-foreground">
          <Shield className="h-10 w-10 mb-3 text-border" />
          <p className="text-sm font-medium text-muted-foreground">휴직 기록이 없습니다</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background">
                {isHrAdmin && <th className={TABLE_STYLES.headerCell}>직원</th>}
                <th className={TABLE_STYLES.headerCell}>유형</th>
                <th className={TABLE_STYLES.headerCell}>기간</th>
                <th className={TABLE_STYLES.headerCell}>사유</th>
                <th className={TABLE_STYLES.headerCell}>상태</th>
                <th className={cn(TABLE_STYLES.headerCell, 'text-right')}>작업</th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-background">
                  {isHrAdmin && (
                    <td className={TABLE_STYLES.cell}>
                      <p className="font-medium text-foreground">{r.employee.name}</p>
                      <p className="text-xs text-muted-foreground">{r.employee.employeeNo}</p>
                    </td>
                  )}
                  <td className={TABLE_STYLES.cell}>
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">{r.type.name}</span>
                      <span className={cn(
                        'inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                        r.type.category === 'STATUTORY' ? 'bg-primary/5 text-primary' : 'bg-muted/50 text-muted-foreground',
                      )}>
                        {r.type.category === 'STATUTORY' ? '법정' : '약정'}
                      </span>
                    </div>
                  </td>
                  <td className={TABLE_STYLES.cell}>
                    <p className="text-foreground">
                      {formatDateLocale(r.startDate)} ~ {formatDateLocale(r.actualEndDate ?? r.expectedEndDate)}
                    </p>
                  </td>
                  <td className={TABLE_STYLES.cell}>
                    <p className="max-w-[200px] truncate text-muted-foreground">{r.reason ?? '—'}</p>
                  </td>
                  <td className={TABLE_STYLES.cell}>
                    <Badge className={cn(STATUS_COLORS[r.status])}>
                      {STATUS_LABELS[r.status] ?? r.status}
                    </Badge>
                  </td>
                  <td className={cn(TABLE_STYLES.cell, 'text-right')}>
                    <div className="flex justify-end gap-1">
                      {/* HR: 승인/거부 (REQUESTED 상태) */}
                      {isHrAdmin && r.status === 'REQUESTED' && (
                        <>
                          <Button size="sm" variant="outline" className="h-7 text-xs text-tertiary border-tertiary/20 hover:bg-tertiary-container/10"
                            onClick={() => { setActionTarget(r); setActionType('approve'); setActionOpen(true) }}>
                            승인
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs text-destructive border-destructive/20 hover:bg-destructive/5"
                            onClick={() => { setActionTarget(r); setActionType('reject'); setActionOpen(true) }}>
                            거부
                          </Button>
                        </>
                      )}
                      {/* HR: 활성화 (APPROVED 상태) */}
                      {isHrAdmin && r.status === 'APPROVED' && (
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => handleActivate(r)}>
                          휴직 시작
                        </Button>
                      )}
                      {/* HR: 복직 완료 (RETURN_REQUESTED 상태) */}
                      {isHrAdmin && r.status === 'RETURN_REQUESTED' && (
                        <Button size="sm" variant="outline" className="h-7 text-xs text-tertiary border-tertiary/20 hover:bg-tertiary-container/10"
                          onClick={() => {
                            setCompleteTarget(r)
                            setCompleteForm({
                              actualEndDate: new Date().toISOString().slice(0, 10),
                              returnPositionId: '',
                              returnNotes: '',
                            })
                            setCompleteOpen(true)
                          }}>
                          복직 완료
                        </Button>
                      )}
                      {/* 직원: 복직 신청 (ACTIVE 상태 + 본인) */}
                      {r.status === 'ACTIVE' && r.employee.id === user.employeeId && (
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => {
                            setReturnTarget(r)
                            setReturnNotes('')
                            setReturnOpen(true)
                          }}>
                          복직 신청
                        </Button>
                      )}
                      {/* 취소 (REQUESTED/APPROVED 상태) */}
                      {['REQUESTED', 'APPROVED'].includes(r.status) && (isHrAdmin || r.employee.id === user.employeeId) && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
                          onClick={() => handleCancel(r)}>
                          취소
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>이전</Button>
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>다음</Button>
        </div>
      )}

      {/* 신청 다이얼로그 */}
      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>휴직 신청</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {isHrAdmin && (
              <div>
                <label className="text-sm font-medium text-foreground">직원 ID</label>
                <Input placeholder="직원 ID 입력" value={requestForm.employeeId}
                  onChange={e => setRequestForm(f => ({ ...f, employeeId: e.target.value }))} />
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-foreground">휴직 유형</label>
              <Select value={requestForm.typeId} onValueChange={v => setRequestForm(f => ({ ...f, typeId: v }))}>
                <SelectTrigger><SelectValue placeholder="유형 선택" /></SelectTrigger>
                <SelectContent>
                  {loaTypes.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({t.category === 'STATUTORY' ? '법정' : '약정'})
                      {t.maxDurationDays ? ` · 최대 ${t.maxDurationDays}일` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(() => {
                const selected = loaTypes.find(t => t.id === requestForm.typeId)
                if (selected?.requiresProof) {
                  return (
                    <p className="mt-1 text-xs text-orange-600 flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      증빙 필요: {selected.proofDescription ?? '관련 서류'}
                    </p>
                  )
                }
                return null
              })()}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground">시작일</label>
                <Input type="date" value={requestForm.startDate}
                  onChange={e => setRequestForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">예상 복귀일</label>
                <Input type="date" value={requestForm.expectedEndDate}
                  onChange={e => setRequestForm(f => ({ ...f, expectedEndDate: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">사유</label>
              <Textarea placeholder="휴직 사유를 입력하세요" value={requestForm.reason}
                onChange={e => setRequestForm(f => ({ ...f, reason: e.target.value }))} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestOpen(false)}>취소</Button>
            <Button onClick={handleRequest} disabled={requestLoading}>
              {requestLoading ? '처리 중...' : '신청'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 승인/거부 다이얼로그 */}
      <Dialog open={actionOpen} onOpenChange={setActionOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' ? '휴직 승인' : '휴직 거부'}
            </DialogTitle>
          </DialogHeader>
          {actionTarget && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-background p-3 space-y-1">
                <p className="text-sm font-medium">{actionTarget.employee.name} ({actionTarget.employee.employeeNo})</p>
                <p className="text-sm text-muted-foreground">{actionTarget.type.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDateLocale(actionTarget.startDate)} ~ {formatDateLocale(actionTarget.expectedEndDate)}
                </p>
                {actionTarget.reason && <p className="text-xs text-muted-foreground">사유: {actionTarget.reason}</p>}
              </div>
              {actionType === 'reject' && (
                <div>
                  <label className="text-sm font-medium text-foreground">거부 사유 (필수)</label>
                  <Textarea placeholder="거부 사유를 입력하세요" value={rejectionReason}
                    onChange={e => setRejectionReason(e.target.value)} rows={3} />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setActionOpen(false); setRejectionReason('') }}>취소</Button>
            <Button
              onClick={handleAction}
              disabled={actionLoading}
              className={actionType === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {actionLoading ? '처리 중...' : actionType === 'approve' ? '승인' : '거부'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 복직 신청 다이얼로그 (직원) */}
      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>복직 신청</DialogTitle>
          </DialogHeader>
          {returnTarget && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-background p-3 space-y-1">
                <p className="text-sm font-medium">{returnTarget.type.name}</p>
                <p className="text-sm text-muted-foreground">
                  휴직 기간: {formatDateLocale(returnTarget.startDate)} ~ {formatDateLocale(returnTarget.expectedEndDate)}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">특이사항</label>
                <p className="text-xs text-muted-foreground mb-1">희망 복직일이나 기타 사항을 입력하세요</p>
                <Textarea
                  placeholder="예: 희망 복직일 2026-04-15, 부서 변경 희망 등"
                  value={returnNotes}
                  onChange={e => setReturnNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReturnOpen(false); setReturnNotes('') }}>취소</Button>
            <Button onClick={handleReturnSubmit} disabled={returnLoading}>
              {returnLoading ? '처리 중...' : '복직 신청'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 복직 완료 다이얼로그 (HR) */}
      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>복직 완료 처리</DialogTitle>
          </DialogHeader>
          {completeTarget && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-background p-3 space-y-1">
                <p className="text-sm font-medium">{completeTarget.employee.name} ({completeTarget.employee.employeeNo})</p>
                <p className="text-sm text-muted-foreground">{completeTarget.type.name}</p>
                <p className="text-sm text-muted-foreground">
                  휴직 기간: {formatDateLocale(completeTarget.startDate)} ~ {formatDateLocale(completeTarget.expectedEndDate)}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">실제 복직일 (필수)</label>
                <Input
                  type="date"
                  value={completeForm.actualEndDate}
                  onChange={e => setCompleteForm(f => ({ ...f, actualEndDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">복귀 직위</label>
                <Select
                  value={completeForm.returnPositionId}
                  onValueChange={v => setCompleteForm(f => ({ ...f, returnPositionId: v === '__none__' ? '' : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="현재 직위 유지" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">현재 직위 유지</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">다른 직위로 복귀 시 직위 변경은 인사 발령에서 처리하세요</p>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">복직 메모</label>
                <Textarea
                  placeholder="복직 관련 메모 (선택)"
                  value={completeForm.returnNotes}
                  onChange={e => setCompleteForm(f => ({ ...f, returnNotes: e.target.value }))}
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteOpen(false)}>취소</Button>
            <Button
              onClick={handleCompleteSubmit}
              disabled={completeLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {completeLoading ? '처리 중...' : '복직 완료'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── KPI Card ────────────────────────────────────────────

const COLOR_MAP: Record<string, { border: string; icon: string }> = {
  yellow: { border: 'border-l-yellow-400', icon: 'text-yellow-500' },
  orange: { border: 'border-l-orange-400', icon: 'text-orange-500' },
  purple: { border: 'border-l-purple-400', icon: 'text-purple-500' },
  green: { border: 'border-l-green-400', icon: 'text-green-500' },
}

function KpiCard({ icon: Icon, label, value, color }: {
  icon: typeof Clock; label: string; value: number; color: string
}) {
  const c = COLOR_MAP[color] ?? COLOR_MAP.yellow
  return (
    <div className={cn('rounded-lg border border-border border-l-4 bg-card p-4', c.border)}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn('h-4 w-4', c.icon)} />
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </div>
  )
}
