'use client'

import { useState, useCallback, useEffect } from 'react'
import { Plus, Eye, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/DataTable'
import type { DataTableColumn } from '@/components/shared/DataTable'
import { WdDrawer, WdField } from '@/components/shared/WdDrawer'
import PlanDetailDialog from '@/components/succession/PlanDetailDialog'
import { apiClient } from '@/lib/api'
import { STATUS_VARIANT } from '@/lib/styles/status'
import { useToast } from '@/hooks/use-toast'
import type { PaginationInfo } from '@/types'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'

// ─── Types ───────────────────────────────────────────────

const INPUT_CLS = 'w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus-visible:ring-2 focus-visible:ring-ring focus:outline-none'

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
  LOW: { label: '낮음', className: STATUS_VARIANT.success },
  MEDIUM: { label: '보통', className: STATUS_VARIANT.warning },
  HIGH: { label: '높음', className: STATUS_VARIANT.error },
  CRITICAL: { label: '핵심', className: STATUS_VARIANT.error },
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  PLAN_DRAFT: { label: '초안', className: STATUS_VARIANT.neutral },
  PLAN_ACTIVE: { label: '활성', className: STATUS_VARIANT.success },
  ARCHIVED: { label: '보관', className: STATUS_VARIANT.neutral },
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

  const { confirm, dialogProps } = useConfirmDialog()

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
    confirm({ variant: 'destructive', title: `"${plan.positionTitle}" 계획을 삭제하시겠습니까?`, onConfirm: async () => {
      try {
        await apiClient.delete(`/api/v1/succession/plans/${plan.id}`)
        toast({ title: '핵심직책이 삭제되었습니다.' })
        fetchPlans()
      } catch {
        toast({ title: '삭제 실패', variant: 'destructive' })
      }
    }})
  }

  const columns: DataTableColumn<PlanRow>[] = [
    {
      key: 'positionTitle',
      header: '직책명',
      render: (row) => <span className="font-medium text-foreground">{row.positionTitle || '-'}</span>,
    },
    {
      key: 'department',
      header: '부서',
      render: (row) => row.department?.name ?? '-',
    },
    {
      key: 'currentHolder',
      header: '현 직책자',
      render: (row) => row.currentHolder?.name ?? '-',
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
    <>
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

      {/* ─── Create Drawer (입력 폼 표준 = WdDrawer, 우측 슬라이드) ─── */}
      <WdDrawer
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        title="핵심직책 등록"
        closeDisabled={saving}
        secondary={{ label: '취소', onClick: () => setCreateDialogOpen(false), disabled: saving }}
        primary={{ label: saving ? '등록 중...' : '등록', onClick: handleCreate, disabled: saving || !form.positionTitle }}
      >
        <WdField label="직책명" required htmlFor="plan-position">
          <input id="plan-position" className={INPUT_CLS} value={form.positionTitle}
            onChange={(e) => setForm((f) => ({ ...f, positionTitle: e.target.value }))} />
        </WdField>
        <WdField label="중요도" required htmlFor="plan-criticality">
          <select id="plan-criticality" className={INPUT_CLS} value={form.criticality}
            onChange={(e) => setForm((f) => ({ ...f, criticality: e.target.value }))}>
            {Object.entries(CRITICALITY_BADGE).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </WdField>
        <WdField label="비고" htmlFor="plan-notes">
          <textarea id="plan-notes" className={`${INPUT_CLS} resize-none`} rows={3} value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        </WdField>
      </WdDrawer>

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
      <ConfirmDialog {...dialogProps} />
      </>
  )
}
