'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'

import React, { useEffect, useState, useCallback } from 'react'
import { Heart, Clock, CalendarDays, Target, AlertTriangle, Flame } from 'lucide-react'
import { ChartCard } from '@/components/analytics/ChartCard'
import type { TeamHealthResponse } from '@/lib/analytics/types'
import { TABLE_STYLES } from '@/lib/styles'
import { STATUS_FG } from '@/lib/styles/status'
import { cn } from '@/lib/utils'
import type { SessionUser } from '@/types'

const SCORE_COLORS: Record<string, string> = {
  HEALTHY: STATUS_FG.success, CAUTION: STATUS_FG.warning, WARNING: '#F97316', CRITICAL: STATUS_FG.error,
}
const SCORE_LABEL_KEYS: Record<string, string> = {
  HEALTHY: 'teamHealth.scoreLabels.healthy', CAUTION: 'teamHealth.scoreLabels.caution', WARNING: 'teamHealth.scoreLabels.warning', CRITICAL: 'teamHealth.scoreLabels.critical',
}
const SUB_ICONS = [
  { key: 'overtime', labelKey: 'teamHealth.subScores.overtime', icon: Clock },
  { key: 'leaveUsage', labelKey: 'teamHealth.subScores.leaveUsage', icon: CalendarDays },
  { key: 'performanceDist', labelKey: 'teamHealth.subScores.performanceDist', icon: Target },
  { key: 'turnoverRisk', labelKey: 'teamHealth.subScores.turnoverRisk', icon: AlertTriangle },
  { key: 'burnoutRisk', labelKey: 'teamHealth.subScores.burnoutRisk', icon: Flame },
]
const STATUS_LABELS = { GREEN: '🟢', YELLOW: '🟡', RED: '🔴' }
const RISK_COLORS = { HIGH: 'text-destructive bg-destructive/5', MEDIUM: 'text-amber-600 bg-amber-500/10', LOW: 'text-emerald-600 bg-emerald-500/10' }

export default function TeamHealthClient({ user: _user }: { user: SessionUser }) {
  const t = useTranslations('analytics')

  const [data, setData] = useState<TeamHealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/v1/analytics/team-health/overview')
      if (res.ok) { const j = await res.json(); setData(j.data) }
      else { setError(true) }
    } catch { setError(true) } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) {
    return <div className="space-y-6 animate-pulse">{[...Array(3)].map((_, i) => <div key={i} className="h-48 bg-muted rounded-xl" />)}</div>
  }

  if (error || !data) {
    return (
      <EmptyState
        title={t('error.loadFailed')}
        description={t('error.teamHealthLoadFailed')}
        action={{ label: t('retry'), onClick: () => fetchData() }}
      />
    )
  }

  if (data.isEmpty) {
    return (
      <div className="bg-card rounded-xl border border-border p-12 text-center">
        <div className="flex justify-center mb-4">
          <div className="rounded-full bg-muted p-4">
            <Heart className="h-8 w-8 text-muted-foreground/60" />
          </div>
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">{t('teamHealth.emptyTitle')}</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          {t('teamHealth.emptyDescription')}
        </p>
      </div>
    )
  }

  const scoreColor = SCORE_COLORS[data.scoreLevel] || '#94A3B8'

  return (
    <div className="space-y-6">
      {/* Health Score Hero */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex flex-col items-center">
          <div className="relative w-48 h-28 mb-4">
            <svg viewBox="0 0 120 70" className="w-48 h-28">
              {/* Background arc */}
              <path d="M10 65 A50 50 0 0 1 110 65" fill="none" stroke="#E5E7EB" strokeWidth="8" strokeLinecap="round" />
              {/* Score arc */}
              <path d="M10 65 A50 50 0 0 1 110 65" fill="none" stroke={scoreColor} strokeWidth="8" strokeLinecap="round"
                strokeDasharray={`${(data.score / 100) * 157} 157`} className="transition-all duration-1000" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
              <span className="text-3xl font-bold" style={{ color: scoreColor }}>{data.score}</span>
              <span className="text-xs font-medium" style={{ color: scoreColor }}>
                {t(SCORE_LABEL_KEYS[data.scoreLevel])}
              </span>
            </div>
          </div>
        </div>

        {/* Sub-scores */}
        <div className="grid grid-cols-5 gap-3 mt-4">
          {SUB_ICONS.map(({ key, labelKey, icon: Icon }) => {
            const sub = data.subScores[key as keyof typeof data.subScores]
            const subColor = sub.level === 'GOOD' ? '#10B981' : sub.level === 'CAUTION' ? '#F59E0B' : sub.level === 'WARNING' ? '#F97316' : '#EF4444'
            return (
              <div key={key} className="text-center p-3 bg-muted/50 rounded-xl">
                <Icon className="h-4 w-4 mx-auto mb-1" style={{ color: subColor }} />
                <div className="text-lg font-bold" style={{ color: subColor }}>{sub.score}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{t(labelKey)}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Members Table */}
      <ChartCard title={t('teamHealth.memberStatus')}>
        <div className="overflow-x-auto">
          <table className={TABLE_STYLES.table}>
            <thead className={TABLE_STYLES.header}>
              <tr>
                <th className={TABLE_STYLES.headerCell}>{t('name')}</th>
                <th className={TABLE_STYLES.headerCellRight}>{t('teamHealth.table.overtime')}</th>
                <th className={TABLE_STYLES.headerCellRight}>{t('teamHealth.table.leaveUsageRate')}</th>
                <th className={cn(TABLE_STYLES.headerCell, 'text-center')}>{t('teamHealth.table.performanceGrade')}</th>
                <th className={cn(TABLE_STYLES.headerCell, 'text-center')}>{t('teamHealth.table.turnoverRisk')}</th>
                <th className={cn(TABLE_STYLES.headerCell, 'text-center')}>{t('status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.members.map((m) => (
                <tr key={m.employeeId} className={TABLE_STYLES.row}>
                  <td className={TABLE_STYLES.cell}>{m.name}</td>
                  <td className={cn(TABLE_STYLES.cellRight, m.weeklyOvertime > 10 && 'text-destructive font-medium')}>{m.weeklyOvertime}h</td>
                  <td className={cn(TABLE_STYLES.cellRight, m.leaveUsageRate < 30 && 'text-amber-600 font-medium')}>{m.leaveUsageRate}%</td>
                  <td className={cn(TABLE_STYLES.cell, 'text-center')}>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${m.lastGrade === 'B' ? 'bg-destructive/5 text-destructive' : 'bg-border text-foreground'}`}>
                      {m.lastGrade}
                    </span>
                  </td>
                  <td className={cn(TABLE_STYLES.cell, 'text-center')}>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${RISK_COLORS[m.turnoverRisk]}`}>
                      {m.turnoverRisk}
                    </span>
                  </td>
                  <td className={cn(TABLE_STYLES.cell, 'text-center')}>{STATUS_LABELS[m.overallStatus]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>

      {/* Recommendations */}
      <ChartCard title={t('teamHealth.recommendedActions')}>
        <div className="space-y-3">
          {data.recommendations.map((rec, i) => (
            <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border-l-4 ${
              rec.severity === 'RED' ? 'border-l-red-500 bg-destructive/5/30' : 'border-l-amber-500 bg-amber-500/10/30'
            }`}>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  {rec.employeeName}
                  {rec.factors.length > 0 && ` — ${rec.factors.join(', ')}`}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{rec.actionText}</p>
              </div>
              {rec.actionLink && (
                <a href={rec.actionLink} className="text-xs text-primary hover:underline whitespace-nowrap">
                  {t('teamHealth.viewProfile')}
                </a>
              )}
            </div>
          ))}
        </div>
      </ChartCard>
    </div>
  )
}
