'use client'

import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Target, TrendingUp, Award } from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import { TABLE_STYLES } from '@/lib/styles'

// ─── Types ────────────────────────────────────────────────

interface CycleOption { id: string; name: string; status: string }

interface EvalResult {
  performanceScore: number | null
  competencyScore: number | null
  emsBlock: string | null
  comment: string | null
  status: string
}

interface GoalResult {
  id: string
  title: string
  weight: number
  achievementScore: number | null
}

interface MyResult {
  cycle: { id: string; name: string; year: number; half: string; status: string } | null
  selfEvaluation: EvalResult | null
  managerEvaluation: EvalResult | null
  finalResult: { performanceScore: number | null; competencyScore: number | null; emsBlock: string | null; calibrated: boolean } | null
  goals: GoalResult[]
}

const SCORE_LABELS = ['', '매우 부족', '부족', '보통', '우수', '탁월']

// ─── Component ────────────────────────────────────────────

export default function ResultsClient({
  const tCommon = useTranslations('common')
  const t = useTranslations('performance')
 user }: { user: SessionUser }) {
  const t = useTranslations('performance')
  const tc = useTranslations('common')

  const [cycles, setCycles] = useState<CycleOption[]>([])
  const [selectedCycleId, setSelectedCycleId] = useState('')
  const [result, setResult] = useState<MyResult | null>(null)
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

  const fetchResult = useCallback(async () => {
    if (!selectedCycleId) return
    setLoading(true)
    try {
      const res = await apiClient.get<MyResult>('/api/v1/performance/results/me', { cycleId: selectedCycleId })
      setResult(res.data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [selectedCycleId])

  useEffect(() => { fetchResult() }, [fetchResult])

  if (loading) {
    return <div className="p-6 flex items-center justify-center h-64 text-[#666]">{tc('loading')}...</div>
  }

  const final = result?.finalResult

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">{t('results')}</h1>
          <p className="text-sm text-[#666] mt-1">나의 성과 결과를 확인합니다</p>
        </div>
        <select
          value={selectedCycleId}
          onChange={(e) => setSelectedCycleId(e.target.value)}
          className="px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10"
        >
          {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <p className="text-xs text-[#666] mb-1 flex items-center gap-1"><Target className="w-3.5 h-3.5" /> 성과 점수</p>
          <p className="text-3xl font-bold text-[#1A1A1A]">
            {final?.performanceScore?.toFixed(1) ?? '-'}
          </p>
          <p className="text-xs text-[#999] mt-1">/5.0</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <p className="text-xs text-[#666] mb-1 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> 역량 점수</p>
          <p className="text-3xl font-bold text-[#1A1A1A]">
            {final?.competencyScore?.toFixed(1) ?? '-'}
          </p>
          <p className="text-xs text-[#999] mt-1">/5.0</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <p className="text-xs text-[#666] mb-1 flex items-center gap-1"><Award className="w-3.5 h-3.5" /> EMS 블록</p>
          <p className="text-3xl font-bold text-[#00C853]">
            {final?.emsBlock ?? '-'}
          </p>
          {final?.calibrated && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#E0E7FF] text-[#4338CA] mt-1">
              캘리브레이션 반영
            </span>
          )}
        </div>
      </div>

      {/* Self vs Manager comparison */}
      {(result?.selfEvaluation || result?.managerEvaluation) && (
        <div className="rounded-xl border border-[#E8E8E8] bg-white">
          <div className="px-5 py-4 border-b border-[#E8E8E8]">
            <h2 className="text-lg font-semibold text-[#1A1A1A]">평가 비교</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={TABLE_STYLES.header}>
                  <th className={TABLE_STYLES.headerCell}>구분</th>
                  <th className={TABLE_STYLES.headerCell}>성과 점수</th>
                  <th className={TABLE_STYLES.headerCell}>역량 점수</th>
                  <th className={TABLE_STYLES.headerCell}>EMS 블록</th>
                  <th className={TABLE_STYLES.headerCell}>상태</th>
                </tr>
              </thead>
              <tbody>
                {result?.selfEvaluation && (
                  <tr className="border-b border-[#F5F5F5]">
                    <td className="px-4 py-3 text-sm font-medium text-[#1A1A1A]">자기평가</td>
                    <td className="px-4 py-3 text-sm text-center text-[#555]">{result.selfEvaluation.performanceScore?.toFixed(1) ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-center text-[#555]">{result.selfEvaluation.competencyScore?.toFixed(1) ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-center font-medium text-[#00C853]">{result.selfEvaluation.emsBlock ?? '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#D1FAE5] text-[#047857]">{result.selfEvaluation.status}</span>
                    </td>
                  </tr>
                )}
                {result?.managerEvaluation && (
                  <tr className="border-b border-[#F5F5F5]">
                    <td className="px-4 py-3 text-sm font-medium text-[#1A1A1A]">매니저 평가</td>
                    <td className="px-4 py-3 text-sm text-center text-[#555]">{result.managerEvaluation.performanceScore?.toFixed(1) ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-center text-[#555]">{result.managerEvaluation.competencyScore?.toFixed(1) ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-center font-medium text-[#00C853]">{result.managerEvaluation.emsBlock ?? '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#D1FAE5] text-[#047857]">{result.managerEvaluation.status}</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Goals */}
      {result?.goals && result.goals.length > 0 && (
        <div className="rounded-xl border border-[#E8E8E8] bg-white">
          <div className="px-5 py-4 border-b border-[#E8E8E8]">
            <h2 className="text-lg font-semibold text-[#1A1A1A]">목표 달성</h2>
          </div>
          <div className="divide-y divide-[#F5F5F5]">
            {result.goals.map((goal) => (
              <div key={goal.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#1A1A1A]">{goal.title}</p>
                  <p className="text-xs text-[#999]">가중치: {goal.weight}%</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-[#1A1A1A]">
                    {goal.achievementScore != null ? `${goal.achievementScore}/5` : '-'}
                  </p>
                  <p className="text-xs text-[#999]">
                    {goal.achievementScore != null ? SCORE_LABELS[Math.round(goal.achievementScore)] : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
