'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — My Profile · Performance Tab (rich-fidelity)
// 본인 (공개된) 평가 결과: 최신 KPI + 다주기 평가이력(평가자·코멘트) +
//   MBO 가중 달성점수 이력 + 받은 칭찬 피드.
// 공개 게이트: 서버(my-history)가 notifiedAt!=null cycle만 반환 →
//   미통보 cycle의 평가/코멘트는 절대 내려오지 않음. status 결합 없음.
// achievementScore는 0–5 평가점수(% 아님) — "/5"로 표기.
// ═══════════════════════════════════════════════════════════

// ─── Imports ────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Award, Star, Target, ArrowRight, Heart } from 'lucide-react'
import { WdStatStrip } from '@/components/shared/WdStatStrip'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { KpiCardsSkeleton } from '@/components/shared/PageSkeleton'
import { apiClient } from '@/lib/api'
import { CARD_STYLES, TABLE_STYLES } from '@/lib/styles'
import { formatDate } from '@/lib/format/date'

// ─── Types ──────────────────────────────────────────────────
interface HistoryItem {
  cycleId: string
  cycleName: string
  year: number
  half: string | null
  label: string
  mboScore: number | null
  beiScore: number | null
  totalScore: number | null
  finalGrade: string | null
  finalGradeLabel: string | null
  evaluatorName: string | null
  comment: string | null
  mboGoalCount: number
  mboAchievement: number | null
  mboKeyGoals: string[]
}

interface RecognitionItem {
  senderName: string
  coreValue: string
  message: string
  createdAt: string
}

interface RecognitionSummary {
  receivedCount: number
  recent: RecognitionItem[]
}

interface Props {
  employeeId: string
}

// ─── Helpers ────────────────────────────────────────────────
// 최신 cycle = year DESC, half DESC (H2 > H1; null 후순위)
const byLatest = (a: HistoryItem, b: HistoryItem): number =>
  b.year - a.year || (b.half ?? '').localeCompare(a.half ?? '')

// ─── Component ──────────────────────────────────────────────
export function ProfilePerformanceTab({ employeeId }: Props) {
  const t = useTranslations('mySpace')
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [recognitions, setRecognitions] = useState<RecognitionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(false)
      const [historyRes, recogRes] = await Promise.all([
        apiClient.get<HistoryItem[]>('/api/v1/performance/reviews/my-history'),
        apiClient.get<RecognitionSummary>(`/api/v1/cfr/recognitions/employee/${employeeId}`),
      ])
      setHistory((historyRes.data ?? []).slice().sort(byLatest))
      setRecognitions(recogRes.data?.recent ?? [])
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [employeeId])

  useEffect(() => { load() }, [load])

  if (loading) return <KpiCardsSkeleton count={3} />
  if (error) {
    return (
      <EmptyState
        icon={Award}
        title={t('profile.summary.loadError')}
        action={{ label: t('profile.summary.retry'), onClick: load }}
      />
    )
  }

  const latest = history[0] ?? null
  const mboRows = history.filter((h) => h.mboGoalCount > 0)
  const hasAnything = history.length > 0 || recognitions.length > 0

  if (!hasAnything) {
    return <EmptyState icon={Award} title={t('profile.performanceTab.empty')} />
  }

  return (
    <div className="space-y-6">
      {/* ── 최신 결과 KPI ── */}
      {latest && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{latest.cycleName}</p>
            <Link href="/performance/my-result" className="flex items-center gap-1 text-sm text-primary hover:underline">
              {t('profile.summary.viewDetail')} <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <WdStatStrip
            items={[
              {
                label: t('profile.performanceTab.latestGrade'),
                value: latest.finalGradeLabel ?? latest.finalGrade ?? '-',
                icon: Award,
                tone: 'success',
              },
              {
                label: t('profile.performanceTab.totalScore'),
                value: latest.totalScore != null ? latest.totalScore.toFixed(1) : '-',
                icon: Star,
                tone: 'info',
              },
              {
                label: t('profile.performanceTab.mboScore'),
                value: latest.mboScore != null ? latest.mboScore.toFixed(1) : '-',
                icon: Target,
                tone: 'default',
              },
            ]}
          />
        </div>
      )}

      {/* ── 평가 이력 (다주기) ── */}
      {history.length > 0 && (
        <section aria-labelledby="perf-history-title" className={CARD_STYLES.padded}>
          <h2 id="perf-history-title" className="text-base font-semibold text-foreground mb-4">
            {t('profile.performanceTab.evalHistory')}
          </h2>
          <div role="list" className="space-y-3">
            {history.map((h) => (
              <article key={h.cycleId} role="listitem" className="flex items-start gap-4 rounded-xl border border-border bg-card p-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-base font-bold text-primary">
                  {h.finalGrade ?? '-'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">{h.label}</p>
                    {h.totalScore != null && (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {t('profile.performanceTab.totalScore')} {h.totalScore.toFixed(1)}
                      </span>
                    )}
                  </div>
                  {h.evaluatorName && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t('profile.performanceTab.evaluator', { name: h.evaluatorName })}
                    </p>
                  )}
                  {h.comment && (
                    <p className="mt-1.5 text-sm italic text-muted-foreground">&ldquo;{h.comment}&rdquo;</p>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* ── MBO 달성 이력 ── */}
      {mboRows.length > 0 && (
        <section aria-labelledby="perf-mbo-title" className={CARD_STYLES.padded}>
          <h2 id="perf-mbo-title" className="text-base font-semibold text-foreground mb-4">
            {t('profile.performanceTab.mboHistory')}
          </h2>
          <div className={TABLE_STYLES.wrapper}>
            <table className={TABLE_STYLES.table}>
              <thead>
                <tr className={TABLE_STYLES.header}>
                  <th className={TABLE_STYLES.headerCell}>{t('profile.performanceTab.mboCol.cycle')}</th>
                  <th className={TABLE_STYLES.headerCell}>{t('profile.performanceTab.mboCol.goals')}</th>
                  <th className={`${TABLE_STYLES.headerCell} text-right`}>{t('profile.performanceTab.mboCol.achievement')}</th>
                  <th className={TABLE_STYLES.headerCell}>{t('profile.performanceTab.mboCol.keyGoals')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {mboRows.map((h) => (
                  <tr key={h.cycleId} className={TABLE_STYLES.row}>
                    <td className={`${TABLE_STYLES.cell} font-medium text-foreground`}>{h.label}</td>
                    <td className={`${TABLE_STYLES.cell} tabular-nums`}>
                      {t('profile.performanceTab.goalsCount', { count: h.mboGoalCount })}
                    </td>
                    <td className={`${TABLE_STYLES.cell} text-right tabular-nums font-medium text-foreground`}>
                      {h.mboAchievement != null ? `${h.mboAchievement.toFixed(1)} / 5.0` : '-'}
                    </td>
                    <td className={`${TABLE_STYLES.cell} text-muted-foreground`}>
                      {h.mboKeyGoals.length > 0 ? h.mboKeyGoals.join(' · ') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── 받은 칭찬 ── */}
      {recognitions.length > 0 && (
        <section aria-labelledby="perf-recognitions-title" className={CARD_STYLES.padded}>
          <h2 id="perf-recognitions-title" className="text-base font-semibold text-foreground mb-4">
            {t('profile.performanceTab.recognitions')}
          </h2>
          <div role="list" className="space-y-3">
            {recognitions.map((r, i) => (
              <article key={i} role="listitem" className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-wd-orange-soft text-wd-orange-ink">
                  <Heart className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {t('profile.performanceTab.praisedYou', { name: r.senderName })}
                  </p>
                  {r.message && (
                    <p className="mt-0.5 text-sm italic text-muted-foreground">&ldquo;{r.message}&rdquo;</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {r.coreValue && <Badge variant="accent">{r.coreValue}</Badge>}
                  <span className="text-[11px] text-muted-foreground tabular-nums">{formatDate(r.createdAt)}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
