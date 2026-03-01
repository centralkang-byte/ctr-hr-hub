'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
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
  const t = useTranslations('payrollPage')
  const tCommon = useTranslations('common')

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
    { key: 'name', header: t('runName') },
    {
      key: 'runType',
      header: tCommon('type'),
      render: (row) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
          {t(`runType.${row.runType}`, { defaultValue: row.runType })}
        </span>
      ),
    },
    { key: 'yearMonth', header: t('payPeriod') },
    {
      key: 'headcount',
      header: t('headcount'),
      render: (row) => t('headcountValue', { count: row.headcount }),
    },
    {
      key: 'totalGross',
      header: t('totalGross'),
      render: (row) => formatCurrency(Number(row.totalGross ?? 0)),
    },
    {
      key: 'totalNet',
      header: t('totalNet'),
      render: (row) => formatCurrency(Number(row.totalNet ?? 0)),
    },
    {
      key: 'status',
      header: tCommon('status'),
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
          {tCommon('detail')}
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
          <h1 className="text-2xl font-bold text-slate-900">{t('title')}</h1>
        </div>
        <PayrollCreateDialog onCreated={() => fetchRuns()} />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t('allStatus')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{tCommon('all')}</SelectItem>
            <SelectItem value="DRAFT">{t('status.draft')}</SelectItem>
            <SelectItem value="CALCULATING">{t('status.calculating')}</SelectItem>
            <SelectItem value="REVIEW">{t('status.review')}</SelectItem>
            <SelectItem value="APPROVED">{t('status.approved')}</SelectItem>
            <SelectItem value="PAID">{t('status.paid')}</SelectItem>
            <SelectItem value="CANCELLED">{t('status.cancelled')}</SelectItem>
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
        emptyMessage={t('emptyMessage')}
        onRowClick={(row) => router.push(`/payroll/${row.id}/review`)}
      />
    </div>
  )
}
