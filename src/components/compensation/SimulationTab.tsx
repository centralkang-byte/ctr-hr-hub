'use client'

import { useState, useCallback, useEffect } from 'react'
import { Sparkles, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/DataTable'
import type { DataTableColumn } from '@/components/shared/DataTable'
import CompaRatioBadge from '@/components/compensation/CompaRatioBadge'
import { formatCurrency, calculateBudgetSummary } from '@/lib/compensation'
import { apiClient } from '@/lib/api'
import type { PaginationInfo } from '@/types'

// ─── Types ───────────────────────────────────────────────

type SimulationRow = {
  id: string
  name: string
  departmentName: string
  jobGradeName: string
  currentSalary: number
  currency: string
  emsBlock: string | null
  compaRatio: number
  recommendedPct: number
  minPct: number
  maxPct: number
  adjustedPct: number
  newSalary: number
}

interface SimulationTabProps {
  cycleId: string
  onPrepareConfirm: (
    adjustments: Array<{
      employeeId: string
      employeeName: string
      department: string
      currentSalary: number
      newSalary: number
      changePct: number
    }>,
  ) => void
}

// ─── Component ───────────────────────────────────────────

export default function SimulationTab({ cycleId, onPrepareConfirm }: SimulationTabProps) {
  const [rows, setRows] = useState<SimulationRow[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [aiLoadingId, setAiLoadingId] = useState<string | null>(null)

  const fetchSimulation = useCallback(
    async (page = 1) => {
      if (!cycleId) return
      setLoading(true)
      try {
        const params: Record<string, string> = { cycleId, page: String(page), limit: '20' }
        if (departmentFilter) params.departmentId = departmentFilter

        const res = await apiClient.getList<SimulationRow>(
          '/api/v1/compensation/simulation',
          params,
        )
        setRows(
          (res.data ?? []).map((r: SimulationRow) => ({
            ...r,
            adjustedPct: r.recommendedPct,
            newSalary: Math.round(r.currentSalary * (1 + r.recommendedPct / 100)),
          })),
        )
        setPagination(res.pagination ?? null)
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    },
    [cycleId, departmentFilter],
  )

  useEffect(() => {
    fetchSimulation()
  }, [fetchSimulation])

  // ─── Inline Edit Handler ─────────────────────────────

  const handlePctChange = (employeeId: string, newPct: number) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === employeeId
          ? {
              ...r,
              adjustedPct: newPct,
              newSalary: Math.round(r.currentSalary * (1 + newPct / 100)),
            }
          : r,
      ),
    )
  }

  // ─── AI Recommend ────────────────────────────────────

  const handleAiRecommend = async (employeeId: string) => {
    setAiLoadingId(employeeId)
    try {
      const res = await apiClient.post<{ recommendedPct: number; reasoning: string }>(
        '/api/v1/compensation/simulation/ai-recommend',
        { cycleId, employeeId },
      )
      handlePctChange(employeeId, res.data.recommendedPct)
    } catch {
      // ignore
    } finally {
      setAiLoadingId(null)
    }
  }

  // ─── Budget Summary ──────────────────────────────────

  const budget = calculateBudgetSummary(
    rows.map((r) => ({ currentSalary: r.currentSalary, newSalary: r.newSalary })),
  )

  // ─── Prepare Confirm ─────────────────────────────────

  const handlePrepareConfirm = () => {
    onPrepareConfirm(
      rows
        .filter((r) => r.adjustedPct > 0)
        .map((r) => ({
          employeeId: r.id,
          employeeName: r.name,
          department: r.departmentName,
          currentSalary: r.currentSalary,
          newSalary: r.newSalary,
          changePct: r.adjustedPct,
        })),
    )
  }

  // ─── Table Columns ───────────────────────────────────

  const columns: DataTableColumn<SimulationRow>[] = [
    { key: 'name', header: '직원명' },
    { key: 'departmentName', header: '부서' },
    { key: 'jobGradeName', header: '직급' },
    {
      key: 'currentSalary',
      header: '현재 연봉',
      render: (row) => (
        <span className="text-sm font-medium">
          {formatCurrency(row.currentSalary, row.currency)}
        </span>
      ),
    },
    {
      key: 'emsBlock',
      header: 'EMS',
      render: (row) =>
        row.emsBlock ? (
          <Badge variant="outline" className="text-xs">
            {row.emsBlock}
          </Badge>
        ) : (
          <span className="text-slate-400">-</span>
        ),
    },
    {
      key: 'compaRatio',
      header: 'Compa',
      render: (row) => <CompaRatioBadge ratio={row.compaRatio} showLabel={false} />,
    },
    {
      key: 'recommendedPct',
      header: '추천%',
      render: (row) => (
        <span className="text-xs text-slate-500">
          {row.minPct}~{row.maxPct}%
        </span>
      ),
    },
    {
      key: 'adjustedPct',
      header: '조정%',
      render: (row) => {
        const outOfRange = row.adjustedPct < row.minPct || row.adjustedPct > row.maxPct
        return (
          <div className="flex items-center gap-1">
            <input
              type="number"
              className="w-16 px-2 py-1 border border-slate-300 rounded text-sm text-right focus:ring-2 focus:ring-blue-500"
              value={row.adjustedPct}
              onChange={(e) => handlePctChange(row.id, Number(e.target.value))}
              min={0}
              max={100}
              step={0.5}
            />
            <span className="text-xs text-slate-500">%</span>
            {outOfRange && (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            )}
          </div>
        )
      },
    },
    {
      key: 'newSalary',
      header: '신규 연봉',
      render: (row) => (
        <span className="text-sm font-semibold text-blue-700">
          {formatCurrency(row.newSalary, row.currency)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleAiRecommend(row.id)}
          disabled={aiLoadingId === row.id}
          className="text-indigo-600 hover:text-indigo-700"
        >
          <Sparkles className="h-4 w-4" />
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      {/* ─── 예산 요약 카드 ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs text-slate-500 mb-1">대상 인원</p>
          <p className="text-3xl font-bold text-slate-900">{budget.headcount}명</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs text-slate-500 mb-1">현재 총 연봉</p>
          <p className="text-xl font-bold text-slate-900">
            {formatCurrency(budget.totalCurrentSalary)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs text-slate-500 mb-1">총 인상액</p>
          <p className="text-xl font-bold text-emerald-600">
            +{formatCurrency(budget.totalIncrease)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs text-slate-500 mb-1">평균 인상률</p>
          <p className="text-3xl font-bold text-blue-600">{budget.avgIncreasePct}%</p>
        </div>
      </div>

      {/* ─── DataTable ─── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <DataTable<SimulationRow>
          columns={columns}
          data={rows}
          pagination={pagination ?? undefined}
          onPageChange={fetchSimulation}
          loading={loading}
          emptyMessage="시뮬레이션 데이터가 없습니다. 사이클을 선택해주세요."
          rowKey={(row) => row.id}
        />
      </div>

      {/* ─── 확정 버튼 ─── */}
      <div className="flex justify-end">
        <Button
          onClick={handlePrepareConfirm}
          disabled={rows.length === 0}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium text-sm"
        >
          연봉 조정 확정으로 이동 →
        </Button>
      </div>
    </div>
  )
}
