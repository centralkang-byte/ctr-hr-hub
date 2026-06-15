'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Employee Performance Tab (직원 상세 · 성과평가)
// 인라인 성과 요약. 출처: _design-reference/page-employee-detail.jsx (perf 탭)
// 데이터: /insights(목표·원온원·최근평가·승계) + /cfr/recognitions(받은 칭찬)
// 두 소스는 독립 상태 — 한쪽 실패가 다른 쪽을 가리지 않음(Codex G1 HIGH3).
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import {
  Award,
  Heart,
  MessageCircle,
  MessageSquare,
  Star,
  Target,
  TrendingUp,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { WdStatStrip } from '@/components/shared/WdStatStrip'
import { apiClient } from '@/lib/api'
import { cn } from '@/lib/utils'
import { READINESS_CONFIG, MOOD_SCALE, type MoodKey } from '@/lib/styles/performance'

// ─── Types ──────────────────────────────────────────────────

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

interface RecognitionItem {
  senderName: string
  coreValue: string
  message: string | null
  createdAt: string
}

interface RecognitionData {
  receivedCount: number
  sentCount: number
  recent: RecognitionItem[]
}

type LoadState = 'loading' | 'loaded' | 'error'

interface PerformanceTabProps {
  employeeId: string
}

// ─── Helpers ────────────────────────────────────────────────

/** 점수 있는 목표만 평균. 없으면 null(=데이터 없음, 0으로 오기 금지 — Codex G1 MED5) */
function avgAchievement(goals: InsightGoal[]): number | null {
  const scored = goals
    .map((g) => (g.achievementScore != null ? Number(g.achievementScore) : null))
    .filter((n): n is number => n != null && !Number.isNaN(n))
  if (scored.length === 0) return null
  return Math.round(scored.reduce((s, n) => s + n, 0) / scored.length)
}

// ─── Component ──────────────────────────────────────────────

export function PerformanceTab({ employeeId }: PerformanceTabProps) {
  const t = useTranslations('performance')
  const locale = useLocale()

  // 회사 스코프는 서버가 결정(SUPER=전사조회·그 외=자기 법인). 클라이언트는 항상 fetch.
  const [insights, setInsights] = useState<InsightData | null>(null)
  const [insightsState, setInsightsState] = useState<LoadState>('loading')
  const [recognition, setRecognition] = useState<RecognitionData | null>(null)
  const [recognitionState, setRecognitionState] = useState<LoadState>('loading')

  const fetchAll = useCallback(async () => {
    setInsightsState('loading')
    setRecognitionState('loading')
    // 독립 fetch — 한쪽 실패가 다른 쪽 상태에 영향 없음
    apiClient
      .get<InsightData>(`/api/v1/employees/${employeeId}/insights`)
      .then((res) => {
        setInsights(res.data)
        setInsightsState('loaded')
      })
      .catch(() => setInsightsState('error'))
    apiClient
      .get<RecognitionData>(`/api/v1/cfr/recognitions/employee/${employeeId}`)
      .then((res) => {
        setRecognition(res.data)
        setRecognitionState('loaded')
      })
      .catch(() => setRecognitionState('error'))
  }, [employeeId])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // ─── 로딩 (insights 기준 — KPI/주 섹션) ───
  if (insightsState === 'loading') {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    )
  }

  // insights/recognition은 독립 렌더 — 한쪽 실패가 다른 쪽을 가리지 않음(Codex G1 HIGH3·G2 MED).
  const data = insightsState === 'loaded' ? insights : null
  const avg = data ? avgAchievement(data.goals) : null
  const recvCount = recognitionState === 'loaded' ? recognition?.receivedCount ?? 0 : null

  // 전체 빈상태 = 양 소스 모두 loaded + 데이터 없음일 때만 (한쪽 에러는 인라인 처리)
  const insightsEmpty =
    !!data &&
    data.goals.length === 0 &&
    data.oneOnOnes.length === 0 &&
    !data.latestEval &&
    !data.successionEntry
  const recognitionEmpty =
    recognitionState === 'loaded' && (recognition?.recent.length ?? 0) === 0
  if (insightsEmpty && recognitionEmpty) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <EmptyState icon={<TrendingUp className="h-12 w-12" />} title={t('profileTab.empty')} />
      </div>
    )
  }

  // ─── KPI 3카드 (proto: 최근 등급 / MBO 평균 달성 / 받은 칭찬) ───
  const kpiItems = [
    {
      label: t('profileTab.recentGrade'),
      value: data?.latestEval?.performanceGrade ?? '—',
      icon: Award,
      foot: data?.latestEval?.cycle.name ?? undefined,
    },
    {
      label: t('profileTab.mboAverage'),
      value: data ? (avg != null ? avg : t('profileTab.noScoredGoals')) : '—',
      unit: data && avg != null ? '%' : undefined,
      icon: Target,
      foot:
        data && avg != null
          ? t('profileTab.goalsCount', { count: data.goals.length })
          : undefined,
    },
    {
      label: t('profileTab.receivedRecognition'),
      value: recvCount != null ? recvCount : '—',
      unit: recvCount != null ? t('profileTab.unitCount') : undefined,
      icon: Heart,
      foot: recvCount != null ? t('profileTab.recognitionPeriod') : undefined,
    },
  ]

  return (
    <div className="space-y-4">
      <WdStatStrip items={kpiItems} className="md:grid-cols-3" />

      {/* insights 섹션 실패 시 인라인 에러 (받은 칭찬은 아래에서 독립 렌더) */}
      {insightsState === 'error' && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <EmptyState
            icon={<TrendingUp className="h-12 w-12" />}
            title={t('profileTab.loadError')}
            action={{ label: t('profileTab.retry'), onClick: fetchAll }}
          />
        </div>
      )}

      {data && (
        <>
      {/* ── 목표 달성 ── */}
      <section
        aria-labelledby="perf-goals-title"
        className="rounded-2xl border border-border bg-card p-6"
      >
        <div className="mb-3 flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" aria-hidden="true" />
          <h3 id="perf-goals-title" className="text-sm font-semibold text-foreground">
            {t('insight.goalAchievement')}
          </h3>
        </div>
        {data.goals.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('insight.noGoals')}</p>
        ) : (
          <div className="space-y-2.5">
            {data.goals.map((goal) => {
              const rate =
                goal.achievementScore != null
                  ? Math.round(Number(goal.achievementScore))
                  : null
              return (
                <div key={goal.id} className="rounded-lg bg-background p-3">
                  <p className="truncate text-sm font-medium text-foreground">{goal.title}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div
                      className="h-1.5 flex-1 rounded-full bg-border"
                      role="progressbar"
                      aria-valuenow={rate ?? 0}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={goal.title}
                    >
                      <div
                        className="h-1.5 rounded-full bg-primary"
                        style={{ width: `${Math.min(rate ?? 0, 100)}%` }}
                      />
                    </div>
                    <span className="w-12 whitespace-nowrap text-right text-xs font-semibold tabular-nums text-foreground">
                      {rate != null ? `${Math.min(rate, 999)}%` : '-'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── 최근 평가 (단건 — 가짜 이력 금지, Codex G1 MED4) ── */}
      {data.latestEval && (
        <section
          aria-labelledby="perf-eval-title"
          className="rounded-2xl border border-border bg-card p-6"
        >
          <div className="mb-3 flex items-center gap-2">
            <Award className="h-4 w-4 text-ctr-warning" aria-hidden="true" />
            <h3 id="perf-eval-title" className="text-sm font-semibold text-foreground">
              {t('profileTab.recentEval')}
            </h3>
            <span className="text-xs text-muted-foreground">({data.latestEval.cycle.name})</span>
          </div>
          <div className="grid grid-cols-2 gap-3 rounded-lg bg-background p-3">
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

      {/* ── 최근 원온원 ── */}
      <section
        aria-labelledby="perf-1on1-title"
        className="rounded-2xl border border-border bg-card p-6"
      >
        <div className="mb-3 flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" aria-hidden="true" />
          <h3 id="perf-1on1-title" className="text-sm font-semibold text-foreground">
            {t('insight.recentOneOnOnes', { count: data.oneOnOnes.length })}
          </h3>
        </div>
        {data.oneOnOnes.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('insight.noRecentOneOnOnes')}</p>
        ) : (
          <div className="space-y-2">
            {data.oneOnOnes.map((o) => {
              // 알 수 없는/빈 sentiment는 neutral로 오표기하지 않고 중립 아이콘으로 폴백(정직성)
              const mood = o.sentimentTag ? MOOD_SCALE[o.sentimentTag as MoodKey] : undefined
              const MoodIcon = mood?.icon ?? MessageCircle
              return (
                <div key={o.id} className="flex items-start gap-2 rounded-lg bg-background p-3">
                  <MoodIcon
                    className={cn('h-4 w-4 shrink-0', mood?.className ?? 'text-muted-foreground')}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      {new Date(o.scheduledAt).toLocaleDateString(locale, {
                        month: '2-digit',
                        day: '2-digit',
                      })}
                    </p>
                    <p className="line-clamp-2 text-sm text-foreground">
                      {o.aiSummary ?? o.notes ?? t('insight.noNotes')}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── 승계 준비도 ── */}
      {data.successionEntry && (
        <section
          aria-labelledby="perf-readiness-title"
          className="rounded-2xl border border-border bg-card p-6"
        >
          <div className="mb-3 flex items-center gap-2">
            <Star className="h-4 w-4 text-ctr-warning" aria-hidden="true" />
            <h3 id="perf-readiness-title" className="text-sm font-semibold text-foreground">
              {t('insight.successionReadiness')}
            </h3>
          </div>
          <div className="rounded-lg bg-background p-3">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              {(() => {
                const cfg = READINESS_CONFIG[data.successionEntry.readiness]
                const Icon = cfg?.icon
                return (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                      cfg?.className ?? 'bg-muted text-muted-foreground',
                    )}
                  >
                    {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
                    {cfg?.labelKey ? t(cfg.labelKey) : data.successionEntry.readiness}
                  </span>
                )
              })()}
              {data.successionEntry.plan?.positionTitle && (
                <span className="text-xs text-muted-foreground">
                  {data.successionEntry.plan.positionTitle}
                </span>
              )}
            </div>
            {data.successionEntry.notes && (
              <p className="mt-1 border-t border-border pt-1.5 text-xs text-muted-foreground">
                {data.successionEntry.notes}
              </p>
            )}
          </div>
        </section>
      )}
        </>
      )}

      {/* ── 받은 칭찬 (독립 소스 — 실패해도 위 섹션 무영향) ── */}
      <section
        aria-labelledby="perf-recognition-title"
        className="rounded-2xl border border-border bg-card p-6"
      >
        <div className="mb-3 flex items-center gap-2">
          <Heart className="h-4 w-4 text-ctr-warning" aria-hidden="true" />
          <h3 id="perf-recognition-title" className="text-sm font-semibold text-foreground">
            {t('profileTab.receivedRecognition')}
          </h3>
        </div>
        {recognitionState === 'loading' ? (
          <Skeleton className="h-16 rounded-lg" />
        ) : recognitionState === 'error' ? (
          <p className="text-sm text-muted-foreground">{t('profileTab.recognitionLoadError')}</p>
        ) : !recognition || recognition.recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('profileTab.noRecognition')}</p>
        ) : (
          <div className="space-y-2">
            {recognition.recent.map((r, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg bg-background p-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-wd-orange/15 text-wd-orange">
                  <Heart className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {t('profileTab.recognitionFrom', { name: r.senderName })}
                  </p>
                  {r.message && (
                    <p className="mt-0.5 line-clamp-2 text-xs italic text-muted-foreground">
                      &ldquo;{r.message}&rdquo;
                    </p>
                  )}
                </div>
                {r.coreValue && (
                  <span className="shrink-0 rounded-full bg-wd-orange/10 px-2 py-0.5 text-[10.5px] font-medium text-wd-orange">
                    {r.coreValue}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
