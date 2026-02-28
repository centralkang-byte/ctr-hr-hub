'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { apiClient } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import AttritionKpiCards from '@/components/compensation/AttritionKpiCards'
import AttritionDonutChart from '@/components/compensation/AttritionDonutChart'
import HighRiskList from '@/components/compensation/HighRiskList'
import DepartmentHeatmap from '@/components/compensation/DepartmentHeatmap'
import AttritionTrendChart from '@/components/compensation/AttritionTrendChart'

// ─── Types ───────────────────────────────────────────────

interface KpiData {
  totalEmployees: number
  highRiskCount: number
  mediumRiskCount: number
  avgScore: number
}

interface DistributionItem {
  level: string
  count: number
  percentage: number
}

interface HighRiskEmployee {
  employeeId: string
  employeeName: string
  departmentName: string
  jobGradeName: string
  score: number
  riskLevel: string
  factors: Array<{
    factor: string
    weight: number
    value: number
    description: string
  }>
  retentionActions?: string[]
}

interface DashboardData {
  kpi: KpiData
  distribution: DistributionItem[]
  highRiskEmployees: Array<{
    employeeId: string
    name: string
    department: string | null
    grade: string | null
    score: number
    factors: unknown
    calculatedAt: string
  }>
}

interface DeptHeatmapItem {
  departmentId: string
  departmentName: string
  avgScore: number
  highRiskCount: number
  totalCount: number
}

interface TrendItem {
  month: string
  avgScore: number
  highCount: number
  mediumCount: number
  lowCount: number
}

// ─── Risk level helpers ──────────────────────────────────

function getRiskLevel(score: number): string {
  if (score >= 80) return 'CRITICAL'
  if (score >= 60) return 'HIGH'
  if (score >= 40) return 'MEDIUM'
  return 'LOW'
}

function parseFactors(
  raw: unknown,
): Array<{ factor: string; weight: number; value: number; description: string }> {
  if (!Array.isArray(raw)) return []
  return raw.map((f: Record<string, unknown>) => ({
    factor: String(f.factor ?? ''),
    weight: Number(f.weight ?? 0),
    value: Number(f.value ?? 0),
    description: String(f.description ?? f.factor ?? ''),
  }))
}

// ═════════════════════════════════════════════════════════
// AttritionRiskClient
// ═════════════════════════════════════════════════════════

export default function AttritionRiskClient() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [recalculating, setRecalculating] = useState(false)

  const [kpi, setKpi] = useState<KpiData>({
    totalEmployees: 0,
    highRiskCount: 0,
    mediumRiskCount: 0,
    avgScore: 0,
  })
  const [distribution, setDistribution] = useState<DistributionItem[]>([])
  const [highRiskEmployees, setHighRiskEmployees] = useState<HighRiskEmployee[]>([])
  const [departments, setDepartments] = useState<DeptHeatmapItem[]>([])
  const [trend, setTrend] = useState<TrendItem[]>([])

  // ── Fetch all dashboard data ──────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [dashRes, heatRes, trendRes] = await Promise.all([
        apiClient.get<DashboardData>('/api/v1/attrition/dashboard'),
        apiClient.get<DeptHeatmapItem[]>('/api/v1/attrition/department-heatmap'),
        apiClient.get<TrendItem[]>('/api/v1/attrition/trend', { months: 12 }),
      ])

      // KPI
      setKpi(dashRes.data.kpi)

      // Distribution
      setDistribution(dashRes.data.distribution)

      // High risk employees — normalize from API shape
      const mapped: HighRiskEmployee[] = dashRes.data.highRiskEmployees.map((e) => ({
        employeeId: e.employeeId,
        employeeName: e.name,
        departmentName: e.department ?? '-',
        jobGradeName: e.grade ?? '-',
        score: e.score,
        riskLevel: getRiskLevel(e.score),
        factors: parseFactors(e.factors),
      }))
      setHighRiskEmployees(mapped)

      // Department heatmap
      setDepartments(heatRes.data)

      // Trend
      setTrend(trendRes.data)
    } catch {
      toast({ title: '데이터 로드 실패', description: '이탈 위험 데이터를 불러올 수 없습니다.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // ── Recalculate ───────────────────────────────────────
  const handleRecalculate = async () => {
    setRecalculating(true)
    try {
      await apiClient.post('/api/v1/attrition/recalculate')
      toast({ title: '재계산 완료', description: '이탈 위험 점수가 업데이트되었습니다.' })
      await fetchAll()
    } catch {
      toast({ title: '재계산 실패', variant: 'destructive' })
    } finally {
      setRecalculating(false)
    }
  }

  // ── Loading ───────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* ─── 헤더 ─── */}
      <div className="flex items-center justify-between">
        <div>
          <nav className="text-xs text-slate-400 mb-1">분석 / 이탈 위험</nav>
          <h1 className="text-2xl font-bold text-slate-900">이탈 위험 분석</h1>
        </div>
        <Button
          variant="outline"
          onClick={handleRecalculate}
          disabled={recalculating}
        >
          {recalculating ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-1.5 h-4 w-4" />
          )}
          재계산
        </Button>
      </div>

      {/* ─── KPI 카드 ─── */}
      <AttritionKpiCards
        totalEmployees={kpi.totalEmployees}
        highRiskCount={kpi.highRiskCount}
        mediumRiskCount={kpi.mediumRiskCount}
        avgScore={kpi.avgScore}
      />

      {/* ─── 차트 행 1: 도넛 + 히트맵 ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AttritionDonutChart
          distribution={distribution}
          totalCount={kpi.totalEmployees}
        />
        <DepartmentHeatmap departments={departments} />
      </div>

      {/* ─── 추이 차트 ─── */}
      <AttritionTrendChart data={trend} />

      {/* ─── 고위험 직원 목록 ─── */}
      <HighRiskList employees={highRiskEmployees} />
    </div>
  )
}
