'use client'

import { useState, useCallback, useEffect } from 'react'
import { Plus, Eye, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/DataTable'
import type { DataTableColumn } from '@/components/shared/DataTable'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import PlanDetailDialog from '@/components/succession/PlanDetailDialog'
import { apiClient } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import type { PaginationInfo } from '@/types'

// ─── Types ───────────────────────────────────────────────

type PlanRow = {
  id: string
  positionTitle: string
  criticality: string
  status: string
  notes: string | null
  department: { id: string; name: string } | null
  currentHolder: { id: string; name: string } | null
  _count: { candidates: number }
  [key: string]: unknown
}

const CRITICALITY_BADGE: Record<string, { label: string; className: string }> = {
  LOW: { label: '낮음', className: 'bg-slate-50 text-slate-600 border-slate-200' },
  MEDIUM: { label: '보통', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  HIGH: { label: '높음', className: 'bg-orange-50 text-orange-700 border-orange-200' },
  CRITICAL: { label: '핵심', className: 'bg-red-50 text-red-700 border-red-200' },
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  PLAN_DRAFT: { label: '초안', className: 'bg-slate-50 text-slate-600 border-slate-200' },
  PLAN_ACTIVE: { label: '활성', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  ARCHIVED: { label: '보관', className: 'bg-amber-50 text-amber-700 border-amber-200' },
}

// ─── Component ───────────────────────────────────────────

export default function PlansTab() {
  const { toast } = useToast()
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [detailPlanId, setDetailPlanId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    positionTitle: '',
    criticality: 'MEDIUM',
    notes: '',
  })

  const fetchPlans = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const res = await apiClient.getList<PlanRow>('/api/v1/succession/plans', {
        page: String(page),
        limit: '20',
      })
      setPlans(res.data ?? [])
      setPagination(res.pagination ?? null)
    } catch {
      toast({ title: '핵심직책 로드 실패', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchPlans()
  }, [fetchPlans])

  const handleCreate = async () => {
    setSaving(true)
    try {
      await apiClient.post('/api/v1/succession/plans', {
        positionTitle: form.positionTitle,
        criticality: form.criticality,
        ...(form.notes ? { notes: form.notes } : {}),
      })
      toast({ title: '핵심직책이 등록되었습니다.' })
      setCreateDialogOpen(false)
      fetchPlans()
    } catch {
      toast({ title: '등록 실패', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (plan: PlanRow) => {
    if (!confirm(`"${plan.positionTitle}" 계획을 삭제하시겠습니까?`)) return
    try {
      await apiClient.delete(`/api/v1/succession/plans/${plan.id}`)
      toast({ title: '핵심직책이 삭제되었습니다.' })
      fetchPlans()
    } catch {
      toast({ title: '삭제 실패', variant: 'destructive' })
    }
  }

  const columns: DataTableColumn<PlanRow>[] = [
    { key: 'positionTitle', header: '직책명' },
    {
      key: 'department',
      header: '부서',
      render: (row) => row.department?.name ?? '-',
    },
    {
      key: 'currentHolder',
      header: '현 직책자',
      render: (row) =>
        row.currentHolder
          ? row.currentHolder.name
          : '-',
    },
    {
      key: 'criticality',
      header: '중요도',
      render: (row) => {
        const badge = CRITICALITY_BADGE[row.criticality]
        return badge ? (
          <Badge variant="outline" className={badge.className}>{badge.label}</Badge>
        ) : (
          <Badge variant="outline">{row.criticality}</Badge>
        )
      },
    },
    {
      key: 'status',
      header: '상태',
      render: (row) => {
        const badge = STATUS_BADGE[row.status]
        return badge ? (
          <Badge variant="outline" className={badge.className}>{badge.label}</Badge>
        ) : (
          <Badge variant="outline">{row.status}</Badge>
        )
      },
    },
    {
      key: 'candidates',
      header: '후보 수',
      render: (row) => (
        <span className={row._count.candidates === 0 ? 'text-red-500 font-medium' : ''}>
          {row._count.candidates}명
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => setDetailPlanId(row.id)}>
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleDelete(row)}>
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => {
          setForm({ positionTitle: '', criticality: 'MEDIUM', notes: '' })
          setCreateDialogOpen(true)
        }}>
          <Plus className="mr-1.5 h-4 w-4" />
          핵심직책 등록
        </Button>
      </div>

      <DataTable<PlanRow>
        columns={columns}
        data={plans}
        pagination={pagination ?? undefined}
        onPageChange={fetchPlans}
        loading={loading}
        emptyMessage="등록된 핵심직책이 없습니다."
        rowKey={(row) => row.id}
      />

      {/* ─── Create Dialog ─── */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>핵심직책 등록</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">직책명 *</label>
              <input
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                value={form.positionTitle}
                onChange={(e) => setForm((f) => ({ ...f, positionTitle: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">중요도 *</label>
              <select
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                value={form.criticality}
                onChange={(e) => setForm((f) => ({ ...f, criticality: e.target.value }))}
              >
                {Object.entries(CRITICALITY_BADGE).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">비고</label>
              <textarea
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>취소</Button>
            <Button onClick={handleCreate} disabled={saving || !form.positionTitle}>
              {saving ? '등록 중...' : '등록'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Detail Dialog ─── */}
      {detailPlanId && (
        <PlanDetailDialog
          planId={detailPlanId}
          onClose={() => {
            setDetailPlanId(null)
            fetchPlans()
          }}
        />
      )}
    </div>
  )
}
