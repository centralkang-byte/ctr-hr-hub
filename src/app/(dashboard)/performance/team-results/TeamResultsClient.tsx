'use client'

import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Users, Target, TrendingUp } from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import { TABLE_STYLES } from '@/lib/styles'

// ─── Types ────────────────────────────────────────────────

interface CycleOption { id: string; name: string; status: string }

interface TeamResult {
  employee: {
    id: string; name: string; employeeCode: string
    department: { name: string } | null
    jobGrade: { name: string } | null
  }
  selfEval: { status: string; performanceScore: number | null; competencyScore: number | null; emsBlock: string | null } | null
  managerEval: { status: string; performanceScore: number | null; competencyScore: number | null; emsBlock: string | null } | null
  finalResult: { performanceScore: number | null; competencyScore: number | null; emsBlock: string | null; calibrated: boolean } | null
}

// ─── Component ────────────────────────────────────────────

export default function TeamResultsClient({
  const tCommon = useTranslations('common')
  const t = useTranslations('performance')
 user }: { user: SessionUser }) {
  const t = useTranslations('performance')
  const tc = useTranslations('common')

  const [cycles, setCycles] = useState<CycleOption[]>([])
  const [selectedCycleId, setSelectedCycleId] = useState('')
  const [results, setResults] = useState<TeamResult[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchCycles() {
      try {
        const res = await apiClient.getList<CycleOption>('/api/v1/performance/cycles', { page: 1, limit: 100 })
        setCycles(res.data)
        if (res.data.length > 0) setSelectedCycleId(res.data[0].id)
      } catch { /* ignore */ }
    }
    fetchCycles()
  }, [])

  const fetchResults = useCallback(async () => {
    if (!selectedCycleId) return
    setLoading(true)
    try {
      const res = await apiClient.get<TeamResult[]>('/api/v1/performance/results/team', { cycleId: selectedCycleId })
      setResults(res.data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [selectedCycleId])

  useEffect(() => { fetchResults() }, [fetchResults])

  // Stats
  const avgPerf = results.filter((r) => r.finalResult?.performanceScore != null)
  const avgPerfScore = avgPerf.length > 0
    ? avgPerf.reduce((sum, r) => sum + (r.finalResult?.performanceScore ?? 0), 0) / avgPerf.length
    : 0

  if (loading) {
    return <div className="p-6 flex items-center justify-center h-64 text-[#666]">{tc('loading')}...</div>
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">{t('teamResults')}</h1>
          <p className="text-sm text-[#666] mt-1">팀원 성과 결과 현황</p>
        </div>
        <select
          value={selectedCycleId}
          onChange={(e) => setSelectedCycleId(e.target.value)}
          className="px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10"
        >
          {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <p className="text-xs text-[#666] mb-1 flex items-center gap-1"><Users className="w-3.5 h-3.5" /> 팀원 수</p>
          <p className="text-3xl font-bold text-[#1A1A1A]">{results.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <p className="text-xs text-[#666] mb-1 flex items-center gap-1"><Target className="w-3.5 h-3.5" /> 평균 성과</p>
          <p className="text-3xl font-bold text-[#1A1A1A]">{avgPerfScore.toFixed(1)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <p className="text-xs text-[#666] mb-1 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> 평가 완료율</p>
          <p className="text-3xl font-bold text-[#00C853]">
            {results.length > 0 ? Math.round(results.filter((r) => r.managerEval?.status === 'SUBMITTED').length / results.length * 100) : 0}%
          </p>
        </div>
      </div>

      {/* Results table */}
      <div className="rounded-xl border border-[#E8E8E8] bg-white overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className={TABLE_STYLES.header}>
              <th className={TABLE_STYLES.headerCell}>직원</th>
              <th className={TABLE_STYLES.headerCell}>부서</th>
              <th className={TABLE_STYLES.headerCell}>자기평가</th>
              <th className={TABLE_STYLES.headerCell}>매니저 평가</th>
              <th className={TABLE_STYLES.headerCell}>최종 성과</th>
              <th className={TABLE_STYLES.headerCell}>최종 역량</th>
              <th className={TABLE_STYLES.headerCell}>EMS 블록</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.employee.id} className={TABLE_STYLES.header}>
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-[#1A1A1A]">{r.employee.name}</p>
                  <p className="text-xs text-[#999]">{r.employee.employeeCode}</p>
                </td>
                <td className="px-4 py-3 text-sm text-[#555]">{r.employee.department?.name ?? '-'}</td>
                <td className="px-4 py-3 text-sm text-center">
                  {r.selfEval ? (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.selfEval.status === 'SUBMITTED' ? 'bg-[#D1FAE5] text-[#047857]' : 'bg-[#F5F5F5] text-[#666]'}`}>
                      {r.selfEval.performanceScore?.toFixed(1) ?? '-'}
                    </span>
                  ) : <span className="text-[#999]">-</span>}
                </td>
                <td className="px-4 py-3 text-sm text-center">
                  {r.managerEval ? (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.managerEval.status === 'SUBMITTED' ? 'bg-[#D1FAE5] text-[#047857]' : 'bg-[#F5F5F5] text-[#666]'}`}>
                      {r.managerEval.performanceScore?.toFixed(1) ?? '-'}
                    </span>
                  ) : <span className="text-[#999]">-</span>}
                </td>
                <td className="px-4 py-3 text-sm text-center font-medium text-[#1A1A1A]">
                  {r.finalResult?.performanceScore?.toFixed(1) ?? '-'}
                </td>
                <td className="px-4 py-3 text-sm text-center font-medium text-[#1A1A1A]">
                  {r.finalResult?.competencyScore?.toFixed(1) ?? '-'}
                </td>
                <td className="px-4 py-3 text-center">
                  {r.finalResult?.emsBlock ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#E8F5E9] text-[#00A844]">
                      {r.finalResult.emsBlock}
                      {r.finalResult.calibrated && ' ✓'}
                    </span>
                  ) : <span className="text-[#999]">-</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
