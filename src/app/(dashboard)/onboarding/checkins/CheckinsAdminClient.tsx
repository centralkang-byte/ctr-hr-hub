'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Onboarding Check-ins Admin Dashboard
// 체크인 목록, 트렌드 차트, AI 요약
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Sparkles } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { PageHeader } from '@/components/shared/PageHeader'
import { apiClient } from '@/lib/api'
import type { SessionUser, PaginationInfo, OnboardingCheckin } from '@/types'

// ─── Types ──────────────────────────────────────────────────

interface CheckinsAdminClientProps {
  user: SessionUser
}

interface CheckinRow extends OnboardingCheckin {
  employee: { id: string; name: string }
}

interface AiSummaryResult {
  overall_sentiment: 'POSITIVE' | 'MIXED' | 'CONCERNING'
  trend: 'IMPROVING' | 'STABLE' | 'DECLINING'
  key_observations: string[]
  recommended_actions: string[]
}

interface ChartDataPoint {
  week: number
  mood: number
  energy: number
  belonging: number
}

// ─── Helpers ──────────────────────────────────────────────────

function isRiskRow(row: CheckinRow): boolean {
  return row.mood === 'STRUGGLING' || row.mood === 'BAD' || row.belonging <= 2
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('ko-KR')
}

// ─── Component ──────────────────────────────────────────────

export function CheckinsAdminClient({ user }: CheckinsAdminClientProps) {
  const t = useTranslations('onboarding')

  const MOOD_MAP: Record<string, { emoji: string; label: string; value: number }> = {
    GREAT: { emoji: '\u{1F603}', label: t('moodBestShort'), value: 5 },
    GOOD: { emoji: '\u{1F642}', label: t('moodGoodShort'), value: 4 },
    NEUTRAL: { emoji: '\u{1F610}', label: t('moodNeutralShort'), value: 3 },
    STRUGGLING: { emoji: '\u{1F61F}', label: t('moodStrugglingShort'), value: 2 },
    BAD: { emoji: '\u{1F622}', label: t('moodBadShort'), value: 1 },
  }

  const SENTIMENT_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
    POSITIVE: { label: t('sentimentPositive'), variant: 'default' },
    MIXED: { label: t('sentimentMixed'), variant: 'secondary' },
    CONCERNING: { label: t('sentimentConcerning'), variant: 'destructive' },
  }

  const TREND_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
    IMPROVING: { label: t('trendImproving'), variant: 'default' },
    STABLE: { label: t('trendStable'), variant: 'secondary' },
    DECLINING: { label: t('trendDeclining'), variant: 'destructive' },
  }

  const [checkins, setCheckins] = useState<CheckinRow[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  // Employee detail view
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const [selectedEmployeeName, setSelectedEmployeeName] = useState<string>('')
  const [employeeCheckins, setEmployeeCheckins] = useState<OnboardingCheckin[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  // AI summary
  const [aiSummary, setAiSummary] = useState<AiSummaryResult | null>(null)
  const [loadingAi, setLoadingAi] = useState(false)

  // ─── Fetch checkins list ───
  const fetchCheckins = useCallback(() => {
    setLoading(true)
    apiClient
      .getList<CheckinRow>('/api/v1/onboarding/checkins', { page, limit: 20 })
      .then((res) => {
        setCheckins(res.data)
        setPagination(res.pagination)
      })
      .catch(() => {
        setCheckins([])
        setPagination(null)
      })
      .finally(() => setLoading(false))
  }, [page])

  useEffect(() => {
    fetchCheckins()
  }, [fetchCheckins])

  // ─── Fetch employee detail ───
  const selectEmployee = useCallback((employeeId: string, employeeName: string) => {
    setSelectedEmployeeId(employeeId)
    setSelectedEmployeeName(employeeName)
    setAiSummary(null)
    setLoadingDetail(true)
    apiClient
      .get<OnboardingCheckin[]>(`/api/v1/onboarding/checkins/${employeeId}`)
      .then((res) => setEmployeeCheckins(res.data ?? []))
      .catch(() => setEmployeeCheckins([]))
      .finally(() => setLoadingDetail(false))
  }, [])

  // ─── Request AI summary ───
  const requestAiSummary = useCallback(async () => {
    if (!selectedEmployeeId) return
    setLoadingAi(true)
    try {
      const res = await apiClient.post<{ summary: AiSummaryResult; aiGenerated: boolean }>(
        '/api/v1/ai/onboarding-checkin-summary',
        { employeeId: selectedEmployeeId },
      )
      setAiSummary(res.data.summary)
    } catch {
      // Error handled by apiClient
    } finally {
      setLoadingAi(false)
    }
  }, [selectedEmployeeId])

  // ─── Chart data ───
  const chartData: ChartDataPoint[] = useMemo(() => {
    return employeeCheckins.map((c) => ({
      week: c.checkinWeek,
      mood: MOOD_MAP[c.mood]?.value ?? 3,
      energy: c.energy,
      belonging: c.belonging,
    }))
  }, [employeeCheckins])

  // ─── Unique employees for dropdown ───
  const uniqueEmployees = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of checkins) {
      if (!map.has(c.employee.id)) {
        map.set(c.employee.id, c.employee.name)
      }
    }
    return Array.from(map, ([id, name]) => ({ id, name }))
  }, [checkins])

  // ─── Table columns ───
  const columns: DataTableColumn<Record<string, unknown>>[] = useMemo(
    () => [
      {
        key: 'employeeName',
        header: t('employeeName'),
        render: (r) => {
          const row = r as unknown as CheckinRow
          return (
            <button
              type="button"
              className="text-sm font-medium text-ctr-primary hover:underline"
              onClick={(e) => {
                e.stopPropagation()
                selectEmployee(row.employee.id, row.employee.name)
              }}
            >
              {row.employee.name}
            </button>
          )
        },
      },
      {
        key: 'checkinWeek',
        header: t('checkinWeekLabel'),
        render: (r) => {
          const row = r as unknown as CheckinRow
          return <span className="text-sm">{t('weekLabel', { week: row.checkinWeek })}</span>
        },
      },
      {
        key: 'mood',
        header: 'Mood',
        render: (r) => {
          const row = r as unknown as CheckinRow
          const m = MOOD_MAP[row.mood]
          return (
            <span className="text-sm" title={m?.label}>
              {m?.emoji ?? row.mood} {m?.label ?? ''}
            </span>
          )
        },
      },
      {
        key: 'energy',
        header: 'Energy',
        render: (r) => {
          const row = r as unknown as CheckinRow
          return <span className="text-sm">{row.energy}/5</span>
        },
      },
      {
        key: 'belonging',
        header: 'Belonging',
        render: (r) => {
          const row = r as unknown as CheckinRow
          return (
            <span className={`text-sm ${row.belonging <= 2 ? 'font-semibold text-red-600' : ''}`}>
              {row.belonging}/5
            </span>
          )
        },
      },
      {
        key: 'submittedAt',
        header: t('submittedDate'),
        render: (r) => {
          const row = r as unknown as CheckinRow
          return <span className="text-sm text-muted-foreground">{formatDate(String(row.submittedAt))}</span>
        },
      },
    ],
    [selectEmployee, t],
  )

  // ─── Loading state ───
  if (loading && checkins.length === 0) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-60 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title={t('checkinAdminTitle')}
        description={t('checkinAdminDescription')}
      />

      {/* ─── Employee selector ─── */}
      {uniqueEmployees.length > 0 && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-foreground">{t('selectEmployee')}</label>
          <select
            className="rounded-md border px-3 py-2 text-sm"
            value={selectedEmployeeId ?? ''}
            onChange={(e) => {
              const emp = uniqueEmployees.find((u) => u.id === e.target.value)
              if (emp) selectEmployee(emp.id, emp.name)
            }}
          >
            <option value="">{t('selectEmployeePlaceholder')}</option>
            {uniqueEmployees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ─── Data Table ─── */}
      <DataTable
        columns={columns}
        data={checkins as unknown as Record<string, unknown>[]}
        pagination={pagination ?? undefined}
        onPageChange={setPage}
        loading={loading}
        emptyMessage={t('noCheckinData')}
        emptyDescription={t('noCheckinDataDesc')}
        rowKey={(row) => (row as unknown as CheckinRow).id}
      />

      {/* ─── Employee Detail Section ─── */}
      {selectedEmployeeId && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">
                {selectedEmployeeName} - {t('checkinTrend')}
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={requestAiSummary}
                disabled={loadingAi || employeeCheckins.length === 0}
                className="gap-2"
              >
                <Sparkles className="h-4 w-4" />
                {loadingAi ? t('aiAnalyzing') : t('aiSummary')}
              </Button>
            </CardHeader>
            <CardContent>
              {loadingDetail ? (
                <Skeleton className="h-64 w-full" />
              ) : chartData.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">{t('noCheckinData')}</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <XAxis
                      dataKey="week"
                      tickFormatter={(v: number) => t('weekShort', { week: v })}
                      fontSize={12}
                    />
                    <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} fontSize={12} />
                    <Tooltip
                      labelFormatter={(v) => t('weekLong', { week: v })}
                      formatter={(value, name) => {
                        const labels: Record<string, string> = {
                          mood: 'Mood',
                          energy: 'Energy',
                          belonging: 'Belonging',
                        }
                        return [String(value), labels[String(name)] ?? String(name)]
                      }}
                    />
                    <Legend
                      formatter={(value: string) => {
                        const labels: Record<string, string> = {
                          mood: 'Mood',
                          energy: 'Energy',
                          belonging: 'Belonging',
                        }
                        return labels[value] ?? value
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="mood"
                      stroke="#003876"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="energy"
                      stroke="#0068B7"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="belonging"
                      stroke="#10B981"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* ─── AI Summary ─── */}
          {aiSummary && (
            <Card className="border-ctr-secondary/30">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-ctr-secondary" />
                  {t('aiAnalysisSummary')}
                  <Badge variant="outline" className="ml-2 text-xs">
                    AI Generated
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <div>
                    <span className="text-xs text-muted-foreground">{t('overallSentiment')}</span>
                    <div className="mt-1">
                      <Badge variant={SENTIMENT_BADGE[aiSummary.overall_sentiment]?.variant ?? 'secondary'}>
                        {SENTIMENT_BADGE[aiSummary.overall_sentiment]?.label ?? aiSummary.overall_sentiment}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">{t('trendLabel')}</span>
                    <div className="mt-1">
                      <Badge variant={TREND_BADGE[aiSummary.trend]?.variant ?? 'secondary'}>
                        {TREND_BADGE[aiSummary.trend]?.label ?? aiSummary.trend}
                      </Badge>
                    </div>
                  </div>
                </div>

                {aiSummary.key_observations.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-foreground mb-1">{t('keyObservations')}</h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {aiSummary.key_observations.map((obs, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-ctr-primary" />
                          {obs}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {aiSummary.recommended_actions.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-foreground mb-1">{t('recommendedActions')}</h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {aiSummary.recommended_actions.map((action, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-ctr-accent" />
                          {action}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
