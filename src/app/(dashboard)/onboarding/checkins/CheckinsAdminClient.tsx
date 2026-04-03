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
import { Button } from '@/components/ui/button'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { PageHeader } from '@/components/shared/PageHeader'
import { apiClient } from '@/lib/api'
import type { SessionUser, PaginationInfo, OnboardingCheckin } from '@/types'
import { CHART_THEME } from '@/lib/styles'

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

export function CheckinsAdminClient({ user: _user }: CheckinsAdminClientProps) {
  const t = useTranslations('onboarding')

  const MOOD_MAP: Record<string, { emoji: string; label: string; value: number }> = {
    GREAT: { emoji: '\u{1F603}', label: '최고', value: 5 },
    GOOD: { emoji: '\u{1F642}', label: '좋음', value: 4 },
    NEUTRAL: { emoji: '\u{1F610}', label: '보통', value: 3 },
    STRUGGLING: { emoji: '\u{1F61F}', label: '힘듦', value: 2 },
    BAD: { emoji: '\u{1F622}', label: '매우 힘듦', value: 1 },
  }

  const SENTIMENT_BADGE: Record<string, { label: string; className: string }> = {
    POSITIVE: { label: '긍정적', className: 'bg-tertiary-container/20 text-tertiary' },
    MIXED: { label: '혼합', className: 'bg-primary/10 text-primary' },
    CONCERNING: { label: '우려', className: 'bg-destructive/5 text-red-500' },
  }

  const TREND_BADGE: Record<string, { label: string; className: string }> = {
    IMPROVING: { label: '개선 중', className: 'bg-tertiary-container/20 text-tertiary' },
    STABLE: { label: '안정적', className: 'bg-muted text-muted-foreground' },
    DECLINING: { label: '하락 중', className: 'bg-destructive/5 text-red-500' },
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
        header: '직원명',
        render: (r) => {
          const row = r as unknown as CheckinRow
          return (
            <button
              type="button"
              className="text-sm font-medium text-primary hover:underline"
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
        header: '체크인 주차',
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
            <span className={`text-sm ${row.belonging <= 2 ? 'font-semibold text-red-500' : ''}`}>
              {row.belonging}/5
            </span>
          )
        },
      },
      {
        key: 'submittedAt',
        header: '제출일',
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
        <div className="h-10 w-64 bg-muted rounded animate-pulse" />
        <div className="h-60 w-full bg-muted rounded-xl animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title={'온보딩 체크인 관리'}
        description={'신입사원 주간 체크인 현황을 확인하고 AI 분석을 요청하세요.'}
      />

      {/* ─── Employee selector ─── */}
      {uniqueEmployees.length > 0 && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-foreground">{'직원 선택:'}</label>
          <select
            className="rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            value={selectedEmployeeId ?? ''}
            onChange={(e) => {
              const emp = uniqueEmployees.find((u) => u.id === e.target.value)
              if (emp) selectEmployee(emp.id, emp.name)
            }}
          >
            <option value="">{'-- 직원을 선택하세요 --'}</option>
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
        emptyMessage={'체크인 데이터가 없습니다'}
        emptyDescription={'아직 제출된 체크인이 없습니다.'}
        rowKey={(row) => (row as unknown as CheckinRow).id}
      />

      {/* ─── Employee Detail Section ─── */}
      {selectedEmployeeId && (
        <div className="space-y-4">
          <div className="bg-card rounded-xl shadow-sm border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-foreground tracking-[-0.02em]">
                {selectedEmployeeName} - {'체크인 트렌드'}
              </h3>
              <button
                onClick={requestAiSummary}
                disabled={loadingAi || employeeCheckins.length === 0}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-50 transition-colors"
              >
                <Sparkles className="h-4 w-4" />
                {loadingAi ? 'AI 분석 중...' : 'AI 요약'}
              </button>
            </div>
            <div>
              {loadingDetail ? (
                <div className="h-64 w-full bg-muted rounded-xl animate-pulse" />
              ) : chartData.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">{'체크인 데이터가 없습니다'}</p>
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
                      stroke={CHART_THEME.colors[0]}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="energy"
                      stroke={CHART_THEME.colors[2]}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="belonging"
                      stroke="#2196F3"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* ─── AI Summary ─── */}
          {aiSummary && (
            <div className="bg-card rounded-xl shadow-sm border border-border p-6">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="text-base font-bold text-foreground tracking-[-0.02em]">
                  {'AI 분석 요약'}
                </h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] text-xs font-semibold bg-muted text-muted-foreground ml-2">
                  AI Generated
                </span>
              </div>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div>
                    <span className="text-xs text-muted-foreground">{'전반적 감정'}</span>
                    <div className="mt-1">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-[4px] text-xs font-semibold ${SENTIMENT_BADGE[aiSummary.overall_sentiment]?.className ?? 'bg-muted text-muted-foreground'}`}>
                        {SENTIMENT_BADGE[aiSummary.overall_sentiment]?.label ?? aiSummary.overall_sentiment}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">{'추이'}</span>
                    <div className="mt-1">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-[4px] text-xs font-semibold ${TREND_BADGE[aiSummary.trend]?.className ?? 'bg-muted text-muted-foreground'}`}>
                        {TREND_BADGE[aiSummary.trend]?.label ?? aiSummary.trend}
                      </span>
                    </div>
                  </div>
                </div>

                {aiSummary.key_observations.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-foreground mb-1">{'주요 관찰 사항'}</h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {aiSummary.key_observations.map((obs, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                          {obs}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {aiSummary.recommended_actions.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-foreground mb-1">{'권장 조치'}</h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {aiSummary.recommended_actions.map((action, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive/50" />
                          {action}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
