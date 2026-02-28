'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Play,
  CheckCircle2,
  CreditCard,
  AlertTriangle,
  Pencil,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/shared/DataTable'
import type { DataTableColumn } from '@/components/shared/DataTable'
import PayrollStatusBadge from '@/components/payroll/PayrollStatusBadge'
import PayrollKpiCards from '@/components/payroll/PayrollKpiCards'
import PayrollAdjustDialog from '@/components/payroll/PayrollAdjustDialog'
import AnomalyPanel from '@/components/payroll/AnomalyPanel'
import { apiClient } from '@/lib/api'
import { formatCurrency } from '@/lib/compensation'
import type { SessionUser } from '@/types'
import type { PayrollAnomaly } from '@/lib/payroll/types'

interface PayrollItemRow {
  [key: string]: unknown
  id: string
  employeeId: string
  baseSalary: string | number
  overtimePay: string | number
  bonus: string | number
  allowances: string | number
  grossPay: string | number
  deductions: string | number
  netPay: string | number
  isManuallyAdjusted: boolean
  adjustmentReason: string | null
  employee: {
    id: string
    name: string
    employeeNo: string
    department: { id: string; name: string }
    jobGrade: { id: string; name: string }
  }
}

interface ReviewData {
  run: {
    id: string
    name: string
    runType: string
    yearMonth: string
    status: string
    headcount: number
    totalGross: string | number | null
    totalDeductions: string | number | null
    totalNet: string | number | null
    payrollItems: PayrollItemRow[]
  }
  summary: {
    headcount: number
    totalGross: number
    totalDeductions: number
    totalNet: number
    anomalies: PayrollAnomaly[]
  }
}

interface PayrollReviewClientProps {
  user: SessionUser
  runId: string
}

export default function PayrollReviewClient({ user, runId }: PayrollReviewClientProps) {
  const router = useRouter()
  const [data, setData] = useState<ReviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [adjustItem, setAdjustItem] = useState<PayrollItemRow | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<ReviewData>(`/api/v1/payroll/runs/${runId}/review`)
      setData(res.data)
    } catch {
      // error handled
    } finally {
      setLoading(false)
    }
  }, [runId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleCalculate = async () => {
    setActionLoading(true)
    try {
      await apiClient.post(`/api/v1/payroll/runs/${runId}/calculate`)
      fetchData()
    } catch {
      // error handled
    } finally {
      setActionLoading(false)
    }
  }

  const handleApprove = async () => {
    setActionLoading(true)
    try {
      await apiClient.put(`/api/v1/payroll/runs/${runId}/approve`)
      fetchData()
    } catch {
      // error handled
    } finally {
      setActionLoading(false)
    }
  }

  const handlePaid = async () => {
    setActionLoading(true)
    try {
      await apiClient.put(`/api/v1/payroll/runs/${runId}/paid`)
      fetchData()
    } catch {
      // error handled
    } finally {
      setActionLoading(false)
    }
  }

  if (loading || !data) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  const { run, summary } = data
  const status = run.status

  // 이상항목 맵
  const anomalyMap = new Map<string, PayrollAnomaly[]>()
  for (const a of summary.anomalies) {
    const list = anomalyMap.get(a.employeeId) ?? []
    list.push(a)
    anomalyMap.set(a.employeeId, list)
  }

  const columns: DataTableColumn<PayrollItemRow>[] = [
    {
      key: 'employee',
      header: '직원',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.employee.name}</p>
          <p className="text-xs text-slate-500">{row.employee.employeeNo}</p>
        </div>
      ),
    },
    {
      key: 'department',
      header: '부서',
      render: (row) => row.employee.department.name,
    },
    {
      key: 'baseSalary',
      header: '기본급',
      render: (row) => formatCurrency(Number(row.baseSalary)),
    },
    {
      key: 'overtimePay',
      header: '초과근무',
      render: (row) => formatCurrency(Number(row.overtimePay)),
    },
    {
      key: 'allowances',
      header: '수당',
      render: (row) => formatCurrency(Number(row.allowances)),
    },
    {
      key: 'grossPay',
      header: '총지급',
      render: (row) => (
        <span className="font-medium text-emerald-600">
          {formatCurrency(Number(row.grossPay))}
        </span>
      ),
    },
    {
      key: 'deductions',
      header: '공제',
      render: (row) => (
        <span className="text-red-600">
          -{formatCurrency(Number(row.deductions))}
        </span>
      ),
    },
    {
      key: 'netPay',
      header: '실지급',
      render: (row) => (
        <span className="font-bold text-slate-900">
          {formatCurrency(Number(row.netPay))}
        </span>
      ),
    },
    {
      key: 'flags',
      header: '',
      render: (row) => {
        const anomalies = anomalyMap.get(row.employeeId) ?? []
        const hasError = anomalies.some((a) => a.severity === 'ERROR')
        const hasWarning = anomalies.some((a) => a.severity === 'WARNING')

        return (
          <div className="flex items-center gap-1">
            {hasError && <AlertTriangle className="h-4 w-4 text-red-500" aria-label="이상 항목" />}
            {hasWarning && <AlertTriangle className="h-4 w-4 text-amber-500" aria-label="경고" />}
            {row.isManuallyAdjusted && (
              <Pencil className="h-3.5 w-3.5 text-blue-500" aria-label="수동 조정됨" />
            )}
            {status === 'REVIEW' && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setAdjustItem(row)
                }}
                className="text-slate-400 hover:text-blue-600"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/payroll')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{run.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-slate-500">{run.yearMonth}</span>
              <PayrollStatusBadge status={run.status} />
            </div>
          </div>
        </div>

        {/* Status Actions */}
        <div className="flex items-center gap-2">
          {status === 'DRAFT' && (
            <Button
              onClick={handleCalculate}
              disabled={actionLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Play className="h-4 w-4 mr-1" />
              계산 실행
            </Button>
          )}
          {status === 'REVIEW' && (
            <Button
              onClick={handleApprove}
              disabled={actionLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              승인
            </Button>
          )}
          {status === 'APPROVED' && (
            <Button
              onClick={handlePaid}
              disabled={actionLoading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <CreditCard className="h-4 w-4 mr-1" />
              지급완료
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <PayrollKpiCards
        headcount={summary.headcount}
        totalGross={summary.totalGross}
        totalDeductions={summary.totalDeductions}
        totalNet={summary.totalNet}
      />

      {/* AI Anomaly Panel */}
      {(status === 'REVIEW' || status === 'APPROVED') && (
        <AnomalyPanel runId={runId} />
      )}

      {/* Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="p-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">
            급여 항목 ({run.payrollItems.length}명)
          </h2>
        </div>
        <DataTable<PayrollItemRow>
          columns={columns}
          data={run.payrollItems}
          emptyMessage="계산된 급여 항목이 없습니다."
        />
      </div>

      {/* Adjust Dialog */}
      {adjustItem && (
        <PayrollAdjustDialog
          open={!!adjustItem}
          onOpenChange={(open) => !open && setAdjustItem(null)}
          runId={runId}
          item={{
            id: adjustItem.id,
            employeeName: adjustItem.employee.name,
            baseSalary: Number(adjustItem.baseSalary),
            overtimePay: Number(adjustItem.overtimePay),
            bonus: Number(adjustItem.bonus),
            allowances: Number(adjustItem.allowances),
            deductions: Number(adjustItem.deductions),
            grossPay: Number(adjustItem.grossPay),
            netPay: Number(adjustItem.netPay),
          }}
          onAdjusted={fetchData}
        />
      )}
    </div>
  )
}
