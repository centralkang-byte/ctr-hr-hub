'use client'

import { useState, useCallback, useEffect } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
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
import { apiClient } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import type { PaginationInfo } from '@/types'

// ─── Types ───────────────────────────────────────────────

type PolicyRow = {
  id: string
  name: string
  category: string
  amount: number | null
  frequency: string
  currency: string
  isTaxable: boolean
  isActive: boolean
  effectiveFrom: string
  effectiveTo: string | null
  [key: string]: unknown
}

const CATEGORY_LABELS: Record<string, string> = {
  MEAL: '식대',
  TRANSPORT: '교통비',
  EDUCATION: '교육비',
  HEALTH: '건강',
  HOUSING: '주거',
  CHILDCARE: '보육',
  OTHER: '기타',
}

const FREQUENCY_LABELS: Record<string, string> = {
  MONTHLY: '월간',
  QUARTERLY: '분기',
  ANNUAL: '연간',
  ONE_TIME: '1회성',
}

// ─── Component ───────────────────────────────────────────

export default function BenefitPoliciesTab() {
  const { toast } = useToast()
  const [policies, setPolicies] = useState<PolicyRow[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPolicy, setEditingPolicy] = useState<PolicyRow | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [form, setForm] = useState({
    name: '',
    category: 'MEAL',
    amount: '',
    frequency: 'MONTHLY',
    currency: 'KRW',
    isTaxable: true,
    effectiveFrom: '',
    effectiveTo: '',
  })

  const fetchPolicies = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const res = await apiClient.getList<PolicyRow>('/api/v1/benefits/policies', {
        page: String(page),
        limit: '20',
      })
      setPolicies(res.data ?? [])
      setPagination(res.pagination ?? null)
    } catch {
      toast({ title: '정책 목록 로드 실패', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchPolicies()
  }, [fetchPolicies])

  const openCreate = () => {
    setEditingPolicy(null)
    setForm({
      name: '',
      category: 'MEAL',
      amount: '',
      frequency: 'MONTHLY',
      currency: 'KRW',
      isTaxable: true,
      effectiveFrom: new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z',
      effectiveTo: '',
    })
    setDialogOpen(true)
  }

  const openEdit = (policy: PolicyRow) => {
    setEditingPolicy(policy)
    setForm({
      name: policy.name,
      category: policy.category,
      amount: policy.amount?.toString() ?? '',
      frequency: policy.frequency,
      currency: policy.currency,
      isTaxable: policy.isTaxable,
      effectiveFrom: policy.effectiveFrom,
      effectiveTo: policy.effectiveTo ?? '',
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        category: form.category,
        frequency: form.frequency,
        currency: form.currency,
        isTaxable: form.isTaxable,
        effectiveFrom: form.effectiveFrom,
        ...(form.amount ? { amount: Number(form.amount) } : {}),
        ...(form.effectiveTo ? { effectiveTo: form.effectiveTo } : {}),
      }

      if (editingPolicy) {
        await apiClient.put(`/api/v1/benefits/policies/${editingPolicy.id}`, payload)
        toast({ title: '정책이 수정되었습니다.' })
      } else {
        await apiClient.post('/api/v1/benefits/policies', payload)
        toast({ title: '정책이 생성되었습니다.' })
      }

      setDialogOpen(false)
      fetchPolicies()
    } catch {
      toast({ title: '저장 실패', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (policy: PolicyRow) => {
    if (!confirm(`"${policy.name}" 정책을 삭제하시겠습니까?`)) return
    try {
      await apiClient.delete(`/api/v1/benefits/policies/${policy.id}`)
      toast({ title: '정책이 삭제되었습니다.' })
      fetchPolicies()
    } catch {
      toast({ title: '삭제 실패', variant: 'destructive' })
    }
  }

  const columns: DataTableColumn<PolicyRow>[] = [
    { key: 'name', header: '정책명' },
    {
      key: 'category',
      header: '분류',
      render: (row) => (
        <Badge variant="outline">{CATEGORY_LABELS[row.category] ?? row.category}</Badge>
      ),
    },
    {
      key: 'amount',
      header: '금액',
      render: (row) =>
        row.amount ? `${row.amount.toLocaleString()} ${row.currency}` : '-',
    },
    {
      key: 'frequency',
      header: '지급주기',
      render: (row) => FREQUENCY_LABELS[row.frequency] ?? row.frequency,
    },
    {
      key: 'isTaxable',
      header: '과세',
      render: (row) =>
        row.isTaxable ? (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">과세</Badge>
        ) : (
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">비과세</Badge>
        ),
    },
    {
      key: 'isActive',
      header: '상태',
      render: (row) =>
        row.isActive ? (
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">활성</Badge>
        ) : (
          <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">비활성</Badge>
        ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
            <Pencil className="h-4 w-4" />
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
        <Button onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          정책 추가
        </Button>
      </div>

      <DataTable<PolicyRow>
        columns={columns}
        data={policies}
        pagination={pagination ?? undefined}
        onPageChange={fetchPolicies}
        loading={loading}
        emptyMessage="등록된 복리후생 정책이 없습니다."
        rowKey={(row) => row.id}
      />

      {/* ─── Create/Edit Dialog ─── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPolicy ? '정책 수정' : '정책 추가'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">정책명 *</label>
              <input
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">분류 *</label>
                <select
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                >
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">지급주기 *</label>
                <select
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  value={form.frequency}
                  onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}
                >
                  {Object.entries(FREQUENCY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">금액</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">통화</label>
                <input
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  value={form.currency}
                  onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isTaxable"
                className="w-4 h-4 rounded border-slate-300 text-blue-600"
                checked={form.isTaxable}
                onChange={(e) => setForm((f) => ({ ...f, isTaxable: e.target.checked }))}
              />
              <label htmlFor="isTaxable" className="text-sm text-slate-700">과세 항목</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>취소</Button>
            <Button onClick={handleSave} disabled={saving || !form.name}>
              {saving ? '저장 중...' : editingPolicy ? '수정' : '생성'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
