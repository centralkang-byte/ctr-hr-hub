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
      } catch (err) { toast({ title: '평가 결과 로드 실패', description: err instanceof Error ? err.message : '다시 시도해 주세요.', variant: 'destructive' }) }
    }
    fetchCycles()
  }, [])

  const fetchResult = useCallback(async () => {
    if (!selectedCycleId) return
    setLoading(true)
    try {
      const res = await apiClient.get<MyResult>('/api/v1/performance/results/me', { cycleId: selectedCycleId })
      setResult(res.data)
    } catch (err) { toast({ title: '평가 결과 로드 실패', description: err instanceof Error ? err.message : '다시 시도해 주세요.', variant: 'destructive' }) }
    finally { setLoading(false) }
  }, [selectedCycleId])

  useEffect(() => { fetchResult() }, [fetchResult])

  if (loading) {
    return <div className="p-6 flex items-center justify-center h-64 text-muted-foreground">{tc('loading')}...</div>
  }

  const final = result?.finalResult

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('results')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('kr_keb8298ec_kec84b1ea_keab2b0ea_')}</p>
        </div>
        <select
          value={selectedCycleId}
          onChange={(e) => setSelectedCycleId(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10"
        >
          {!cycles?.length && <EmptyState />}
              {cycles?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Target className="w-3.5 h-3.5" /> {t('kr_kec84b1ea_score')}</p>
          <p className="text-3xl font-bold text-foreground">
            {final?.performanceScore?.toFixed(1) ?? '-'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">/5.0</p>
        </div>
        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> {t('kr_kec97adeb_score')}</p>
          <p className="text-3xl font-bold text-foreground">
            {final?.competencyScore?.toFixed(1) ?? '-'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">/5.0</p>
        </div>
        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Award className="w-3.5 h-3.5" /> {t('kr_ems_kebb894eb')}</p>
          <p className="text-3xl font-bold text-primary">
            {final?.emsBlock ?? '-'}
          </p>
          {final?.calibrated && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-500/15 text-primary/90 mt-1">
              {t('calibration_kebb098ec')}
            </span>
          )}
        </div>
      </div>

      {/* Self vs Manager comparison */}
      {(result?.selfEvaluation || result?.managerEvaluation) && (
        <div className="rounded-xl border border-border bg-card">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">{t('evaluation_kebb984ea')}</h2>
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
                    <td className={cn(TABLE_STYLES.cell, "text-center font-medium text-primary")}>{result.selfEvaluation.emsBlock ?? '-'}</td>
                    <td className={cn(TABLE_STYLES.cell, "text-center")}>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-700">{result.selfEvaluation.status}</span>
                    </td>
                  </tr>
                )}
                {result?.managerEvaluation && (
                  <tr className={TABLE_STYLES.row}>
                    <td className={cn(TABLE_STYLES.cell, "font-medium")}>{t('managerEval')}</td>
                    <td className={cn(TABLE_STYLES.cellMuted, "text-center")}>{result.managerEvaluation.performanceScore?.toFixed(1) ?? '-'}</td>
                    <td className={cn(TABLE_STYLES.cellMuted, "text-center")}>{result.managerEvaluation.competencyScore?.toFixed(1) ?? '-'}</td>
                    <td className={cn(TABLE_STYLES.cell, "text-center font-medium text-primary")}>{result.managerEvaluation.emsBlock ?? '-'}</td>
                    <td className={cn(TABLE_STYLES.cell, "text-center")}>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-700">{result.managerEvaluation.status}</span>
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
        <div className="rounded-xl border border-border bg-card">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">{t('goals_keb8bacec')}</h2>
          </div>
          <div className="divide-y divide-border">
            {result.goals.map((goal) => (
              <div key={goal.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{goal.title}</p>
                  <p className="text-xs text-muted-foreground">가중치: {goal.weight}%</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-foreground">
                    {goal.achievementScore != null ? `${goal.achievementScore}/5` : '-'}
                  </p>
                  <p className="text-xs text-muted-foreground">
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
