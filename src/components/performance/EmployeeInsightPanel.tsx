'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { X, Target, MessageSquare, Award, Star, ChevronRight } from 'lucide-react'
import { apiClient } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────

interface InsightGoal {
  id: string
  title: string
  weight: number | string
  status: string
  targetValue?: string | null
  achievementScore?: number | string | null
}

interface InsightOneOnOne {
  id: string
  scheduledAt: string
  notes?: string | null
  aiSummary?: string | null
  meetingType: string
  sentimentTag?: string | null
}

interface InsightEval {
  id: string
  performanceScore?: number | string | null
  competencyScore?: number | string | null
  performanceGrade?: string | null
  competencyGrade?: string | null
  emsBlock?: string | null
  status: string
  cycle: { name: string }
}

interface InsightSuccession {
  readiness: string
  notes?: string | null
  plan: { positionTitle: string } | null
}

interface InsightData {
  employee: { id: string; name: string }
  goals: InsightGoal[]
  oneOnOnes: InsightOneOnOne[]
  latestEval: InsightEval | null
  successionEntry: InsightSuccession | null
}

// ─── Constants ────────────────────────────────────────────

const READINESS_BADGE: Record<string, { labelKey: string; color: string; icon: string }> = {
  READY_NOW: { labelKey: 'insight.readinessReadyNow', color: 'bg-emerald-500/15 text-emerald-700', icon: '🟢' },
  READY_1_2_YEARS: { labelKey: 'insight.readiness1to2Years', color: 'bg-amber-500/15 text-amber-700', icon: '🟡' },
  READY_3_PLUS_YEARS: { labelKey: 'insight.readinessDevelopment', color: 'bg-destructive/10 text-destructive', icon: '🔴' },
}

const SENTIMENT_ICON: Record<string, string> = {
  positive: '😊',
  neutral: '😐',
  negative: '😞',
  concerned: '😟',
}

// ─── Component ────────────────────────────────────────────

interface Props {
  employeeId: string | null
  employeeName?: string
  onClose: () => void
}

export default function EmployeeInsightPanel({ employeeId, employeeName, onClose }: Props) {
  const t = useTranslations('performance')
  const locale = useLocale()
  const [data, setData] = useState<InsightData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchInsights = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const res = await apiClient.get<InsightData>(`/api/v1/employees/${id}/insights`)
      setData(res.data)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (employeeId) {
      fetchInsights(employeeId)
    } else {
      setData(null)
    }
  }, [employeeId, fetchInsights])

  if (!employeeId) return null

  // achievementScore는 0~100 범위의 달성률로 사용
  const getAchievementRate = (goal: InsightGoal): number | null => {
    if (goal.achievementScore != null) return Math.round(Number(goal.achievementScore))
    return null
  }

  return (
    <>
      {/* 오버레이 (클릭 시 닫기) */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      {/* 사이드패널 */}
      <div className="fixed right-0 top-0 h-full w-96 bg-card border-l border-border shadow-lg z-50 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {data?.employee.name ?? employeeName ?? t('insight.employeeInfo')}
            </h2>
            <p className="text-xs text-muted-foreground">{t('insight.integratedInsight')}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-muted rounded-lg transition-colors"
            aria-label={t('insight.close')}
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {loading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">{t('insight.loading')}</div>
        ) : !data ? (
          <div className="p-6 text-center text-sm text-muted-foreground">{t('insight.loadFailed')}</div>
        ) : (
          <div className="p-4 space-y-5">

            {/* 1. 목표 달성률 */}
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">{t('insight.goalAchievement')}</span>
              </div>
              {data.goals.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('insight.noGoals')}</p>
              ) : (
                <div className="space-y-1.5">
                  {data.goals.map((goal) => {
                    const rate = getAchievementRate(goal)
                    return (
                      <div key={goal.id} className="bg-background rounded-lg p-2.5">
                        <p className="text-xs font-medium text-foreground truncate">{goal.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 bg-border rounded-full h-1.5">
                            <div
                              className="bg-primary h-1.5 rounded-full"
                              style={{ width: `${Math.min(rate ?? 0, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-foreground whitespace-nowrap w-10 text-right">
                            {rate != null ? `${Math.min(rate, 999)}%` : '-'}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* 2. 최근 원온원 */}
            <section>
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-4 h-4 text-primary/90" />
                <span className="text-sm font-semibold text-foreground">
                  {t('insight.recentOneOnOnes', { count: data.oneOnOnes.length })}
                </span>
              </div>
              {data.oneOnOnes.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('insight.noRecentOneOnOnes')}</p>
              ) : (
                <div className="space-y-1.5">
                  {data.oneOnOnes.map((o) => (
                    <div key={o.id} className="bg-background rounded-lg p-2.5 flex items-start gap-2">
                      <span className="text-base flex-shrink-0">
                          {SENTIMENT_ICON[o.sentimentTag ?? ''] ?? '💬'}
                        </span>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">
                          {new Date(o.scheduledAt).toLocaleDateString(locale, {
                            month: '2-digit', day: '2-digit',
                          })}
                        </p>
                        <p className="text-xs text-foreground line-clamp-2">
                          {o.aiSummary ?? o.notes ?? t('insight.noNotes')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 3. 최근 평가 */}
            {data.latestEval && (
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <Award className="w-4 h-4 text-amber-700" />
                  <span className="text-sm font-semibold text-foreground">{t('insight.latestEval')}</span>
                  <span className="text-xs text-muted-foreground">({data.latestEval.cycle.name})</span>
                </div>
                <div className="bg-background rounded-lg p-2.5 grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">{t('insight.performanceGrade')}</p>
                    <p className="text-sm font-semibold text-foreground">
                      {data.latestEval.performanceGrade ?? '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('insight.competencyGrade')}</p>
                    <p className="text-sm font-semibold text-foreground">
                      {data.latestEval.competencyGrade ?? '-'}
                    </p>
                  </div>
                  {data.latestEval.emsBlock && (
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">{t('insight.emsBlock')}</p>
                      <p className="text-sm font-semibold text-foreground">{data.latestEval.emsBlock}</p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* 4. Readiness */}
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-semibold text-foreground">{t('insight.successionReadiness')}</span>
              </div>
              {data.successionEntry ? (
                <div className="bg-background rounded-lg p-2.5">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${READINESS_BADGE[data.successionEntry.readiness]?.color ?? 'bg-muted text-muted-foreground'}`}>
                      {READINESS_BADGE[data.successionEntry.readiness]?.icon}{' '}
                      {READINESS_BADGE[data.successionEntry.readiness]?.labelKey ? t(READINESS_BADGE[data.successionEntry.readiness].labelKey) : data.successionEntry.readiness}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {data.successionEntry.plan?.positionTitle}
                    </span>
                  </div>
                  {data.successionEntry.notes && (
                    <p className="text-xs text-muted-foreground mt-1 border-t border-border pt-1.5">
                      {data.successionEntry.notes}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{t('insight.noSuccessionPlan')}</p>
              )}
            </section>

            {/* 5. 링크 */}
            <div className="pt-2">
              <a
                href={`/employees/${employeeId}`}
                className="flex items-center justify-between w-full px-3 py-2 bg-card border border-border rounded-lg hover:bg-background text-sm text-foreground transition-colors"
              >
                <span>{t('insight.viewProfile')}</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </a>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
