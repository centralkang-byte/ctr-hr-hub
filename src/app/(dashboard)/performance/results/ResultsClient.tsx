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
import { cn } from '@/lib/utils'

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
 user }: { user: SessionUser }) {
  const tCommon = useTranslations('common')
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
          <p className="text-sm text-[#666] mt-1">{t('kr_keb8298ec_kec84b1ea_keab2b0ea_')}</p>
        </div>
        <select
          value={selectedCycleId}
          onChange={(e) => setSelectedCycleId(e.target.value)}
          className="px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#5E81F4]/10"
        >
          {!cycles?.length && <EmptyState />}
              {cycles?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <p className="text-xs text-[#666] mb-1 flex items-center gap-1"><Target className="w-3.5 h-3.5" /> {t('kr_kec84b1ea_score')}</p>
          <p className="text-3xl font-bold text-[#1A1A1A]">
            {final?.performanceScore?.toFixed(1) ?? '-'}
          </p>
          <p className="text-xs text-[#999] mt-1">/5.0</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <p className="text-xs text-[#666] mb-1 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> {t('kr_kec97adeb_score')}</p>
          <p className="text-3xl font-bold text-[#1A1A1A]">
            {final?.competencyScore?.toFixed(1) ?? '-'}
          </p>
          <p className="text-xs text-[#999] mt-1">/5.0</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <p className="text-xs text-[#666] mb-1 flex items-center gap-1"><Award className="w-3.5 h-3.5" /> {t('kr_ems_kebb894eb')}</p>
          <p className="text-3xl font-bold text-[#5E81F4]">
            {final?.emsBlock ?? '-'}
          </p>
          {final?.calibrated && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#E0E7FF] text-[#4B6DE0] mt-1">
              {t('calibration_kebb098ec')}
            </span>
          )}
        </div>
      </div>

      {/* Self vs Manager comparison */}
      {(result?.selfEvaluation || result?.managerEvaluation) && (
        <div className="rounded-xl border border-[#E8E8E8] bg-white">
          <div className="px-5 py-4 border-b border-[#E8E8E8]">
            <h2 className="text-lg font-semibold text-[#1A1A1A]">{t('evaluation_kebb984ea')}</h2>
          </div>
          <div className={TABLE_STYLES.wrapper}>
            <table className={TABLE_STYLES.table}>
              <thead>
                <tr className={TABLE_STYLES.header}>
                  <th className={TABLE_STYLES.headerCell}>{t('kr_keab5aceb')}</th>
                  <th className={cn(TABLE_STYLES.headerCell, "text-center")}>{t('kr_kec84b1ea_score')}</th>
                  <th className={cn(TABLE_STYLES.headerCell, "text-center")}>{t('kr_kec97adeb_score')}</th>
                  <th className={cn(TABLE_STYLES.headerCell, "text-center")}>{t('kr_ems_kebb894eb')}</th>
                  <th className={cn(TABLE_STYLES.headerCell, "text-center")}>{t('status')}</th>
                </tr>
              </thead>
              <tbody>
                {result?.selfEvaluation && (
                  <tr className={TABLE_STYLES.row}>
                    <td className={cn(TABLE_STYLES.cell, "font-medium")}>{t('selfEval')}</td>
                    <td className={cn(TABLE_STYLES.cellMuted, "text-center")}>{result.selfEvaluation.performanceScore?.toFixed(1) ?? '-'}</td>
                    <td className={cn(TABLE_STYLES.cellMuted, "text-center")}>{result.selfEvaluation.competencyScore?.toFixed(1) ?? '-'}</td>
                    <td className={cn(TABLE_STYLES.cell, "text-center font-medium text-[#5E81F4]")}>{result.selfEvaluation.emsBlock ?? '-'}</td>
                    <td className={cn(TABLE_STYLES.cell, "text-center")}>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#D1FAE5] text-[#047857]">{result.selfEvaluation.status}</span>
                    </td>
                  </tr>
                )}
                {result?.managerEvaluation && (
                  <tr className={TABLE_STYLES.row}>
                    <td className={cn(TABLE_STYLES.cell, "font-medium")}>{t('managerEval')}</td>
                    <td className={cn(TABLE_STYLES.cellMuted, "text-center")}>{result.managerEvaluation.performanceScore?.toFixed(1) ?? '-'}</td>
                    <td className={cn(TABLE_STYLES.cellMuted, "text-center")}>{result.managerEvaluation.competencyScore?.toFixed(1) ?? '-'}</td>
                    <td className={cn(TABLE_STYLES.cell, "text-center font-medium text-[#5E81F4]")}>{result.managerEvaluation.emsBlock ?? '-'}</td>
                    <td className={cn(TABLE_STYLES.cell, "text-center")}>
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
            <h2 className="text-lg font-semibold text-[#1A1A1A]">{t('goals_keb8bacec')}</h2>
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
