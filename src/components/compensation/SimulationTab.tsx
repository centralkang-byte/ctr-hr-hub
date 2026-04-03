'use client'

import { useState, useCallback, useEffect } from 'react'
import { useTranslations } from 'next-intl'
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
import { BUTTON_VARIANTS } from '@/lib/styles'

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
  const t = useTranslations('compensation')
  const { toast } = useToast()
  const [rows, setRows] = useState<SimulationRow[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [departmentFilter, _setDepartmentFilter] = useState('')
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
        toast({ title: t('simulationLoadError'), description: t('simulationLoadErrorDesc'), variant: 'destructive' })
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
      toast({ title: t('simulationLoadError'), description: t('tryAgain'), variant: 'destructive' })
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
          <span className="text-muted-foreground">-</span>
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
        <span className="text-xs text-muted-foreground">
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
              className="w-16 px-2 py-1 border border-border rounded text-sm text-right focus:ring-2 focus:ring-primary/10"
              value={row.adjustedPct}
              onChange={(e) => handlePctChange(row.id, Number(e.target.value))}
              min={0}
              max={100}
              step={0.5}
            />
            <span className="text-xs text-muted-foreground">%</span>
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
        <span className="text-sm font-semibold text-primary/90">
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
          className="text-primary hover:text-primary/90"
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
        <div className="bg-card rounded-2xl shadow-sm p-6">
          <p className="text-xs text-muted-foreground mb-1">{t('targetCount')}</p>
          <p className="text-3xl font-bold text-foreground">{t('persons', { count: budget.headcount })}</p>
        </div>
        <div className="bg-card rounded-2xl shadow-sm p-6">
          <p className="text-xs text-muted-foreground mb-1">{t('totalCurrentSalary')}</p>
          <p className="text-xl font-bold text-foreground">
            {formatCurrency(budget.totalCurrentSalary)}
          </p>
        </div>
        <div className="bg-card rounded-2xl shadow-sm p-6">
          <p className="text-xs text-muted-foreground mb-1">{t('totalIncrease')}</p>
          <p className="text-xl font-bold text-emerald-600">
            +{formatCurrency(budget.totalIncrease)}
          </p>
        </div>
        <div className="bg-card rounded-2xl shadow-sm p-6">
          <p className="text-xs text-muted-foreground mb-1">{t('avgIncrease')}</p>
          <p className="text-3xl font-bold text-primary">{budget.avgIncreasePct}%</p>
        </div>
      </div>

      {/* ─── AI 추천 결과 패널 ─── */}
      {aiResult && (
        <div className="bg-primary/5 rounded-2xl p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold text-foreground">
                {t('aiRecommendation')} — {rows.find((r) => r.id === aiResult.employeeId)?.name ?? ''}
              </h4>
              <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                {aiResult.data.recommendedPct}%
              </Badge>
            </div>
            <button onClick={() => setAiResult(null)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground mb-3">{aiResult.data.reasoning}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {aiResult.data.riskFactors.length > 0 && (
              <div>
                <p className="text-xs font-medium text-foreground mb-1">{t('riskFactors')}</p>
                <ul className="space-y-1">
                  {aiResult.data.riskFactors.map((f, i) => (
                    <li key={i} className="text-xs text-primary flex items-start gap-1">
                      <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {aiResult.data.alternativeActions.length > 0 && (
              <div>
                <p className="text-xs font-medium text-foreground mb-1">{t('alternatives')}</p>
                <ul className="space-y-1">
                  {aiResult.data.alternativeActions.map((a, i) => (
                    <li key={i} className="text-xs text-primary">
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
      <div className="bg-card rounded-2xl shadow-sm">
        <DataTable<SimulationRow>
          columns={columns}
          data={rows}
          pagination={pagination ?? undefined}
          onPageChange={fetchSimulation}
          loading={loading}
          emptyMessage={t('noSimData')}
          rowKey={(row) => row.id}
        />
      </div>

      {/* ─── 확정 버튼 ─── */}
      <div className="flex justify-end">
        <Button
          onClick={handlePrepareConfirm}
          disabled={rows.length === 0}
          className="px-6 py-2"
        >
          {t('moveToConfirm')}
        </Button>
      </div>
    </div>
  )
}
