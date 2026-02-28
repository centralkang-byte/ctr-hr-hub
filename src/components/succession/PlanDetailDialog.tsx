'use client'

import { useState, useCallback, useEffect } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import CandidateCard from '@/components/succession/CandidateCard'
import { apiClient } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'

// ─── Types ───────────────────────────────────────────────

interface PlanDetail {
  id: string
  positionTitle: string
  criticality: string
  status: string
  notes: string | null
  department: { id: string; name: string } | null
  currentHolder: { id: string; name: string } | null
  candidates: CandidateData[]
}

export interface CandidateData {
  id: string
  readiness: string
  developmentAreas: string[] | null
  notes: string | null
  employee: { id: string; name: string; employeeNo: string }
}

interface PlanDetailDialogProps {
  planId: string
  onClose: () => void
}

const STATUS_LABELS: Record<string, string> = {
  PLAN_DRAFT: '초안',
  PLAN_ACTIVE: '활성',
  ARCHIVED: '보관',
}

const CRITICALITY_LABELS: Record<string, string> = {
  LOW: '낮음',
  MEDIUM: '보통',
  HIGH: '높음',
  CRITICAL: '핵심',
}

// ─── Component ───────────────────────────────────────────

export default function PlanDetailDialog({ planId, onClose }: PlanDetailDialogProps) {
  const { toast } = useToast()
  const [plan, setPlan] = useState<PlanDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [addingCandidate, setAddingCandidate] = useState(false)
  const [candidateForm, setCandidateForm] = useState({
    employeeId: '',
    readiness: 'READY_1_2_YEARS',
    notes: '',
  })

  const fetchPlan = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<PlanDetail>(`/api/v1/succession/plans/${planId}`)
      setPlan(res.data)
    } catch {
      toast({ title: '상세 정보 로드 실패', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [planId, toast])

  useEffect(() => {
    fetchPlan()
  }, [fetchPlan])

  const handleAddCandidate = async () => {
    if (!candidateForm.employeeId) return
    try {
      await apiClient.post(`/api/v1/succession/plans/${planId}/candidates`, {
        employeeId: candidateForm.employeeId,
        readiness: candidateForm.readiness,
        ...(candidateForm.notes ? { notes: candidateForm.notes } : {}),
      })
      toast({ title: '후보자가 등록되었습니다.' })
      setAddingCandidate(false)
      setCandidateForm({ employeeId: '', readiness: 'READY_1_2_YEARS', notes: '' })
      fetchPlan()
    } catch {
      toast({ title: '후보자 등록 실패', variant: 'destructive' })
    }
  }

  const handleDeleteCandidate = async (candidateId: string) => {
    try {
      await apiClient.delete(`/api/v1/succession/candidates/${candidateId}`)
      toast({ title: '후보자가 삭제되었습니다.' })
      fetchPlan()
    } catch {
      toast({ title: '삭제 실패', variant: 'destructive' })
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    try {
      await apiClient.put(`/api/v1/succession/plans/${planId}`, { status: newStatus })
      toast({ title: '상태가 변경되었습니다.' })
      fetchPlan()
    } catch {
      toast({ title: '상태 변경 실패', variant: 'destructive' })
    }
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{plan?.positionTitle ?? '로딩...'}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-slate-500">로딩 중...</div>
        ) : plan ? (
          <div className="space-y-6">
            {/* ─── Plan Info ─── */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-500">부서:</span>{' '}
                <span className="font-medium">{plan.department?.name ?? '-'}</span>
              </div>
              <div>
                <span className="text-slate-500">현 직책자:</span>{' '}
                <span className="font-medium">
                  {plan.currentHolder?.name ?? '-'}
                </span>
              </div>
              <div>
                <span className="text-slate-500">중요도:</span>{' '}
                <Badge variant="outline">{CRITICALITY_LABELS[plan.criticality] ?? plan.criticality}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">상태:</span>
                <Badge variant="outline">{STATUS_LABELS[plan.status] ?? plan.status}</Badge>
                {plan.status === 'PLAN_DRAFT' && (
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => handleStatusChange('PLAN_ACTIVE')}>
                    활성화
                  </Button>
                )}
                {plan.status === 'PLAN_ACTIVE' && (
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => handleStatusChange('ARCHIVED')}>
                    보관
                  </Button>
                )}
              </div>
            </div>
            {plan.notes && (
              <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">{plan.notes}</p>
            )}

            {/* ─── Candidates ─── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-slate-900">
                  후보자 ({plan.candidates.length}명)
                </h3>
                <Button size="sm" onClick={() => setAddingCandidate(true)}>
                  <Plus className="mr-1 h-4 w-4" />
                  후보 추가
                </Button>
              </div>

              {addingCandidate && (
                <div className="bg-slate-50 rounded-lg p-4 mb-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">후보자 추가</span>
                    <Button variant="ghost" size="sm" onClick={() => setAddingCandidate(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <input
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="직원 ID (UUID)"
                    value={candidateForm.employeeId}
                    onChange={(e) => setCandidateForm((f) => ({ ...f, employeeId: e.target.value }))}
                  />
                  <select
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    value={candidateForm.readiness}
                    onChange={(e) => setCandidateForm((f) => ({ ...f, readiness: e.target.value }))}
                  >
                    <option value="READY_NOW">즉시 가능</option>
                    <option value="READY_1_2_YEARS">1-2년 내</option>
                    <option value="READY_3_PLUS_YEARS">3년 이상</option>
                  </select>
                  <textarea
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    rows={2}
                    placeholder="비고"
                    value={candidateForm.notes}
                    onChange={(e) => setCandidateForm((f) => ({ ...f, notes: e.target.value }))}
                  />
                  <Button size="sm" onClick={handleAddCandidate} disabled={!candidateForm.employeeId}>
                    등록
                  </Button>
                </div>
              )}

              {plan.candidates.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">등록된 후보자가 없습니다.</p>
              ) : (
                <div className="grid gap-3">
                  {plan.candidates.map((c) => (
                    <CandidateCard
                      key={c.id}
                      candidate={c}
                      onDelete={() => handleDeleteCandidate(c.id)}
                      onUpdate={fetchPlan}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
