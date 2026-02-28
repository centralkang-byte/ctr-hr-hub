'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { DataTable } from '@/components/shared/DataTable'
import type { DataTableColumn } from '@/components/shared/DataTable'
import { COMPA_RATIO_CONFIG, formatCurrency } from '@/lib/compensation'
import type { CompaRatioBand } from '@/lib/compensation'
import { apiClient } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import type { PaginationInfo } from '@/types'

// ─── Types ───────────────────────────────────────────────

type HistoryRow = {
  id: string
  employeeName: string
  departmentName: string
  jobGradeName: string
  changeType: string
  previousBaseSalary: number
  newBaseSalary: number
  changePct: number
  compaRatio: number | null
  effectiveDate: string
  approverName: string | null
}

interface DistributionItem {
  band: CompaRatioBand
  count: number
  percentage: number
}

// ─── Change Type Labels ──────────────────────────────────

const CHANGE_TYPE_LABELS: Record<string, string> = {
  HIRE: '입사',
  ANNUAL_INCREASE: '연봉 인상',
  PROMOTION: '승진',
  MARKET_ADJUSTMENT: '시장 조정',
  DEMOTION_COMP: '강등',
  TRANSFER_COMP: '전환',
  OTHER: '기타',
}

// ─── Component ───────────────────────────────────────────

export default function HistoryTab() {
  const { toast } = useToast()
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [distribution, setDistribution] = useState<DistributionItem[]>([])

  const fetchHistory = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const res = await apiClient.getList<HistoryRow>('/api/v1/compensation/history', {
        page: String(page),
        limit: '20',
      })
      setHistory(res.data)
      setPagination(res.pagination)
    } catch {
      toast({ title: '이력 로드 실패', description: '연봉 변경 이력을 불러올 수 없습니다.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  const fetchAnalysis = useCallback(async () => {
    try {
      const res = await apiClient.get<{ distribution: DistributionItem[] }>(
        '/api/v1/compensation/analysis',
      )
      setDistribution(res.data.distribution ?? [])
    } catch {
      toast({ title: '분석 로드 실패', description: 'Compa-Ratio 분포를 불러올 수 없습니다.', variant: 'destructive' })
    }
  }, [toast])

  useEffect(() => {
    fetchHistory()
    fetchAnalysis()
  }, [fetchHistory, fetchAnalysis])

  // ─── Table Columns ───────────────────────────────────

  const columns: DataTableColumn<HistoryRow>[] = [
    { key: 'employeeName', header: '직원명' },
    { key: 'departmentName', header: '부서' },
    {
      key: 'changeType',
      header: '유형',
      render: (row) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
          {CHANGE_TYPE_LABELS[row.changeType] ?? row.changeType}
        </span>
      ),
    },
    {
      key: 'previousBaseSalary',
      header: '이전 연봉',
      render: (row) => (
        <span className="text-sm text-slate-500">{formatCurrency(row.previousBaseSalary)}</span>
      ),
    },
    {
      key: 'newBaseSalary',
      header: '변경 연봉',
      render: (row) => (
        <span className="text-sm font-medium">{formatCurrency(row.newBaseSalary)}</span>
      ),
    },
    {
      key: 'changePct',
      header: '인상률',
      render: (row) => {
        const pct = Number(row.changePct)
        const color = pct > 0 ? 'text-emerald-600' : pct < 0 ? 'text-red-600' : 'text-slate-500'
        return (
          <span className={`text-sm font-medium ${color}`}>
            {pct > 0 ? '+' : ''}
            {pct.toFixed(1)}%
          </span>
        )
      },
    },
    {
      key: 'effectiveDate',
      header: '적용일',
      render: (row) =>
        new Date(row.effectiveDate).toLocaleDateString('ko-KR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }),
    },
  ]

  // ─── Chart Data ──────────────────────────────────────

  const chartData = distribution.map((d) => ({
    ...d,
    label: COMPA_RATIO_CONFIG[d.band].label,
    color: COMPA_RATIO_CONFIG[d.band].color,
  }))

  return (
    <div className="space-y-6">
      {/* ─── Compa-Ratio 분포 차트 ─── */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Compa-Ratio 분포</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload as (typeof chartData)[0]
                  return (
                    <div className="rounded-md border bg-white p-3 shadow-lg">
                      <p className="font-medium text-sm">{d.label}</p>
                      <p className="text-xs text-slate-500">
                        {d.count}명 ({d.percentage.toFixed(1)}%)
                      </p>
                    </div>
                  )
                }}
              />
              <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ─── 이력 테이블 ─── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="p-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">연봉 변경 이력</h3>
        </div>
        <DataTable<HistoryRow>
          columns={columns}
          data={history}
          pagination={pagination ?? undefined}
          onPageChange={fetchHistory}
          loading={loading}
          emptyMessage="연봉 변경 이력이 없습니다."
          rowKey={(row) => row.id}
        />
      </div>
    </div>
  )
}
