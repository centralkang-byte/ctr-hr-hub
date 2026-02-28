'use client'

import { useState, useCallback, useEffect } from 'react'
import { Sparkles, AlertTriangle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/DataTable'
import type { DataTableColumn } from '@/components/shared/DataTable'
import CompaRatioBadge from '@/components/compensation/CompaRatioBadge'
import { formatCurrency, calculateBudgetSummary } from '@/lib/compensation'
import { apiClient } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
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

interface AiRecommendation {
  recommendedPct: number
  reasoning: string
  riskFactors: string[]
  alternativeActions: string[]
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
  const { toast } = useToast()
  const [rows, setRows] = useState<SimulationRow[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [aiLoadingId, setAiLoadingId] = useState<string | null>(null)
  const [aiResult, setAiResult] = useState<{ employeeId: string; data: AiRecommendation } | null>(null)

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
        toast({ title: '시뮬레이션 로드 실패', description: '데이터를 불러올 수 없습니다.', variant: 'destructive' })
      } finally {
        setLoading(false)
      }
    },
    [cycleId, departmentFilter, toast],
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
      const res = await apiClient.post<AiRecommendation>(
        '/api/v1/compensation/simulation/ai-recommend',
        { cycleId, employeeId },
      )
      handlePctChange(employeeId, res.data.recommendedPct)
      setAiResult({ employeeId, data: res.data })
    } catch {
      toast({ title: 'AI 추천 실패', description: 'AI 서비스를 사용할 수 없습니다. 잠시 후 다시 시도해주세요.', variant: 'destructive' })
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
          <Sparkles className={`h-4 w-4 ${aiLoadingId === row.id ? 'animate-pulse' : ''}`} />
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

      {/* ─── AI 추천 결과 패널 ─── */}
      {aiResult && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-indigo-600" />
              <h4 className="text-sm font-semibold text-indigo-900">
                AI 추천 결과 — {rows.find((r) => r.id === aiResult.employeeId)?.name ?? ''}
              </h4>
              <Badge className="bg-indigo-100 text-indigo-700 border-indigo-300 text-xs">
                {aiResult.data.recommendedPct}%
              </Badge>
            </div>
            <button onClick={() => setAiResult(null)} className="text-indigo-400 hover:text-indigo-600">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-sm text-indigo-800 mb-3">{aiResult.data.reasoning}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {aiResult.data.riskFactors.length > 0 && (
              <div>
                <p className="text-xs font-medium text-indigo-700 mb-1">위험 요인</p>
                <ul className="space-y-1">
                  {aiResult.data.riskFactors.map((f, i) => (
                    <li key={i} className="text-xs text-indigo-600 flex items-start gap-1">
                      <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {aiResult.data.alternativeActions.length > 0 && (
              <div>
                <p className="text-xs font-medium text-indigo-700 mb-1">대안</p>
                <ul className="space-y-1">
                  {aiResult.data.alternativeActions.map((a, i) => (
                    <li key={i} className="text-xs text-indigo-600">
                      {i + 1}. {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

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
