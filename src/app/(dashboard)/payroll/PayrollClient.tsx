'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Wallet } from 'lucide-react'
import { DataTable } from '@/components/shared/DataTable'
import type { DataTableColumn } from '@/components/shared/DataTable'
import PayrollStatusBadge from '@/components/payroll/PayrollStatusBadge'
import PayrollCreateDialog from '@/components/payroll/PayrollCreateDialog'
import { apiClient } from '@/lib/api'
import { formatCurrency } from '@/lib/compensation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { PaginationInfo, SessionUser } from '@/types'

const RUN_TYPE_LABELS: Record<string, string> = {
  MONTHLY: '월급',
  BONUS: '상여금',
  SEVERANCE: '퇴직금',
  SPECIAL: '특별',
}

interface PayrollRunRow {
  [key: string]: unknown
  id: string
  name: string
  runType: string
  yearMonth: string
  periodStart: string
  periodEnd: string
  headcount: number
  totalGross: string | number | null
  totalNet: string | number | null
  status: string
  approver?: { id: string; name: string } | null
  createdAt: string
}

interface PayrollClientProps {
  user: SessionUser
}

export default function PayrollClient({ user }: PayrollClientProps) {
  const router = useRouter()
  const [runs, setRuns] = useState<PayrollRunRow[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('')

  const fetchRuns = useCallback(
    async (page = 1) => {
      setLoading(true)
      try {
        const params: Record<string, string | number> = { page, limit: 20 }
        if (statusFilter) params.status = statusFilter

        const res = await apiClient.getList<PayrollRunRow>('/api/v1/payroll/runs', params)
        setRuns(res.data ?? [])
        setPagination(res.pagination ?? null)
      } catch {
        // error handled
      } finally {
        setLoading(false)
      }
    },
    [statusFilter],
  )

  useEffect(() => {
    fetchRuns()
  }, [fetchRuns])

  const columns: DataTableColumn<PayrollRunRow>[] = [
    { key: 'name', header: '실행명' },
    {
      key: 'runType',
      header: '유형',
      render: (row) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
          {RUN_TYPE_LABELS[row.runType] ?? row.runType}
        </span>
      ),
    },
    { key: 'yearMonth', header: '급여기간' },
    {
      key: 'headcount',
      header: '대상인원',
      render: (row) => `${row.headcount}명`,
    },
    {
      key: 'totalGross',
      header: '총지급액',
      render: (row) => formatCurrency(Number(row.totalGross ?? 0)),
    },
    {
      key: 'totalNet',
      header: '총실지급액',
      render: (row) => formatCurrency(Number(row.totalNet ?? 0)),
    },
    {
      key: 'status',
      header: '상태',
      render: (row) => <PayrollStatusBadge status={row.status} />,
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            router.push(`/payroll/${row.id}/review`)
          }}
          className="text-blue-600 hover:text-blue-800 text-xs font-medium"
        >
          상세
        </button>
      ),
    },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wallet className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-slate-900">급여 정산</h1>
        </div>
        <PayrollCreateDialog onCreated={() => fetchRuns()} />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="전체 상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">전체</SelectItem>
            <SelectItem value="DRAFT">초안</SelectItem>
            <SelectItem value="CALCULATING">계산중</SelectItem>
            <SelectItem value="REVIEW">검토</SelectItem>
            <SelectItem value="APPROVED">승인</SelectItem>
            <SelectItem value="PAID">지급완료</SelectItem>
            <SelectItem value="CANCELLED">취소</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <DataTable<PayrollRunRow>
        columns={columns}
        data={runs}
        pagination={pagination ?? undefined}
        onPageChange={(page) => fetchRuns(page)}
        loading={loading}
        emptyMessage="급여 실행 내역이 없습니다."
        onRowClick={(row) => router.push(`/payroll/${row.id}/review`)}
      />
    </div>
  )
}
