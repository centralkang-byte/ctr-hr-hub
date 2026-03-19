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
import { cn } from '@/lib/utils'
import { EmployeeCell } from '@/components/common/EmployeeCell'

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
 user }: { user: SessionUser }) {
  const tCommon = useTranslations('common')
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
          <p className="text-sm text-[#666] mt-1">{t('kr_ked8c80ec_kec84b1ea_keab2b0ea_')}</p>
        </div>
        <select
          value={selectedCycleId}
          onChange={(e) => setSelectedCycleId(e.target.value)}
          className="px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#5E81F4]/10"
        >
          {!cycles?.length && <EmptyState title="데이터가 없습니다" description="조건을 변경하거나 새로운 데이터를 추가해보세요." />}
              {cycles?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <p className="text-xs text-[#666] mb-1 flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {t('kr_ked8c80ec_kec8898')}</p>
          <p className="text-3xl font-bold text-[#1A1A1A]">{results.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <p className="text-xs text-[#666] mb-1 flex items-center gap-1"><Target className="w-3.5 h-3.5" /> {t('average_kec84b1ea')}</p>
          <p className="text-3xl font-bold text-[#1A1A1A]">{avgPerfScore.toFixed(1)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <p className="text-xs text-[#666] mb-1 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> {t('evaluation_kec9984eb')}</p>
          <p className="text-3xl font-bold text-[#5E81F4]">
            {results.length > 0 ? Math.round(results.filter((r) => r.managerEval?.status === 'SUBMITTED').length / results.length * 100) : 0}%
          </p>
        </div>
      </div>

      {/* Results table */}
      <div className={TABLE_STYLES.wrapper}>
        <table className={TABLE_STYLES.table}>
          <thead>
            <tr className={TABLE_STYLES.header}>
              <th className={TABLE_STYLES.headerCell}>{t('kr_keca781ec')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('department')}</th>
              <th className={cn(TABLE_STYLES.headerCell, "text-center")}>{t('selfEval')}</th>
              <th className={cn(TABLE_STYLES.headerCell, "text-center")}>{t('managerEval')}</th>
              <th className={cn(TABLE_STYLES.headerCell, "text-center")}>{t('kr_kecb59cec_kec84b1ea')}</th>
              <th className={cn(TABLE_STYLES.headerCell, "text-center")}>{t('kr_kecb59cec_kec97adeb')}</th>
              <th className={cn(TABLE_STYLES.headerCell, "text-center")}>{t('kr_ems_kebb894eb')}</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.employee.id} className={TABLE_STYLES.row}>
                <td className={cn(TABLE_STYLES.cell, "px-4")}>
                  <EmployeeCell
                    size="sm"
                    employee={{
                      id: r.employee.id,
                      name: r.employee.name,
                      employeeNo: r.employee.employeeCode,
                      department: r.employee.department?.name,
                      jobGrade: r.employee.jobGrade?.name,
                    }}
                  />
                </td>
                <td className={cn(TABLE_STYLES.cellMuted)}>{r.employee.department?.name ?? '-'}</td>
                <td className={cn(TABLE_STYLES.cellMuted, "text-center")}>
                  {r.selfEval ? (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.selfEval.status === 'SUBMITTED' ? 'bg-[#D1FAE5] text-[#047857]' : 'bg-[#F5F5F5] text-[#666]'}`}>
                      {r.selfEval.performanceScore?.toFixed(1) ?? '-'}
                    </span>
                  ) : <span className="text-[#999]">-</span>}
                </td>
                <td className={cn(TABLE_STYLES.cellMuted, "text-center")}>
                  {r.managerEval ? (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.managerEval.status === 'SUBMITTED' ? 'bg-[#D1FAE5] text-[#047857]' : 'bg-[#F5F5F5] text-[#666]'}`}>
                      {r.managerEval.performanceScore?.toFixed(1) ?? '-'}
                    </span>
                  ) : <span className="text-[#999]">-</span>}
                </td>
                <td className={cn(TABLE_STYLES.cell, "text-center font-medium")}>
                  {r.finalResult?.performanceScore?.toFixed(1) ?? '-'}
                </td>
                <td className={cn(TABLE_STYLES.cell, "text-center font-medium")}>
                  {r.finalResult?.competencyScore?.toFixed(1) ?? '-'}
                </td>
                <td className={cn(TABLE_STYLES.cell, "text-center")}>
                  {r.finalResult?.emsBlock ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#EDF1FE] text-[#4B6DE0]">
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
