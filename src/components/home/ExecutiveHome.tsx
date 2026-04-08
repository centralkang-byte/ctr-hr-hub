'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Executive Home (Phase 3 Redesign)
// 경영진 대시보드. KpiStrip + DashboardTaskList + 회사별/AI.
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import {
  Building2,
  FileText,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AiGeneratedBadge } from '@/components/shared/AiGeneratedBadge'
import { KpiStrip } from './KpiStrip'
import { DashboardTaskList } from './DashboardTaskList'
import { DashboardErrorBanner } from './DashboardErrorBanner'
import { WidgetSkeleton } from '@/components/shared/WidgetSkeleton'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import type { SessionUser } from '@/types'

// ─── Types ────────────────────────────────────────────────

interface Props {
  user: SessionUser
}

interface ExecSummary {
  role: string
  totalEmployees: number
  newHires: number
  terminations: number
  turnoverRate: number
  openPositions: number
  pendingLeaves: number
}

// ─── Component ────────────────────────────────────────────

export function ExecutiveHome({ user }: Props) {
  const t = useTranslations('home')
  const [summary, setSummary] = useState<ExecSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchSummary = useCallback(async () => {
    setError(false)
    setLoading(true)
    try {
      const res = await apiClient.get<ExecSummary>('/api/v1/home/summary')
      setSummary(res.data)
    } catch {
      setError(true)
      toast({ title: '로드 실패', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchSummary()
  }, [fetchSummary])

  return (
    <div className="space-y-8">
      {/* ── Greeting ── */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          {t('employee.greetingName', { name: user.name })}
        </h1>
        <p className="mt-1 text-base text-muted-foreground">
          {t('executive.greetingDesc')}
        </p>
      </div>

      {/* ── KPI Strip ── */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <WidgetSkeleton key={i} height="h-24" lines={2} />
          ))}
        </div>
      ) : error ? (
        <DashboardErrorBanner
          message={t('loadError')}
          onRetry={() => void fetchSummary()}
        />
      ) : (
        <KpiStrip
          hero={{
            label: t('executive.totalHeadcount'),
            value: summary?.totalEmployees?.toLocaleString() ?? '-',
            delta: t('executive.prevMonthDelta', { count: summary?.newHires ?? 0, pct: ((summary?.newHires ?? 0) / Math.max(summary?.totalEmployees ?? 1, 1) * 100).toFixed(1) }),
            deltaVariant: 'good',
          }}
          items={[
            {
              label: t('executive.turnoverRate'),
              value: `${(summary?.turnoverRate ?? 0).toFixed(1)}%`,
              variant: (summary?.turnoverRate ?? 0) > 5 ? 'alert' : 'default',
            },
            {
              label: t('hrAdmin.newHires'),
              value: summary?.newHires ?? 0,
              variant: 'accent',
            },
            {
              label: t('hrAdmin.terminations'),
              value: summary?.terminations ?? 0,
              variant: (summary?.terminations ?? 0) > 5 ? 'alert' : 'default',
            },
            {
              label: t('hrAdmin.openPositions'),
              value: summary?.openPositions ?? 0,
            },
          ]}
        />
      )}

      {/* ── Task List ── */}
      <DashboardTaskList user={user} />

      {/* ── Detail Grid ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 회사별 현황 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground">
              <Building2 className="mr-2 inline-block h-4 w-4" />
              {t('executive.companyOverview')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* TODO: replace with API data */}
            <div className="space-y-3">
              {[
                { name: '씨티알모빌리티', count: 420, rate: '2.8%' },
                { name: '씨티알정보통신', count: 310, rate: '3.5%' },
                { name: '씨티알글로벌', count: 185, rate: '4.1%' },
                { name: '씨티알이엔지', count: 152, rate: '2.2%' },
                { name: '씨티알오토모티브', count: 180, rate: '3.9%' },
              ].map((company) => (
                <div
                  key={company.name}
                  className="flex items-center justify-between rounded-lg bg-muted/50 p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {company.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {company.count}명
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-foreground">
                      {t('executive.turnoverRateLabel')}
                    </p>
                    <p
                      className={`text-xs font-bold ${
                        parseFloat(company.rate) > 3.5
                          ? 'text-destructive'
                          : 'text-tertiary'
                      }`}
                    >
                      {company.rate}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* AI 인사이트 + 최근 보고서 */}
        <div className="space-y-4">
          {/* AI 전략 인사이트 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-foreground">
                {t('executive.aiStrategicInsight')}
              </CardTitle>
              <AiGeneratedBadge />
            </CardHeader>
            <CardContent>
              {/* TODO: replace with API data */}
              <div className="space-y-3">
                <div className="rounded-xl bg-destructive/5 p-3">
                  <p className="text-sm font-medium text-destructive">
                    핵심 인재 유출 위험
                  </p>
                  <p className="mt-1 text-xs text-destructive">
                    SW개발 직군의 이직 위험도가 업계 평균 대비 높은 수준입니다.
                    경쟁력 있는 보상 패키지 검토를 권장합니다.
                  </p>
                </div>
                <div className="rounded-xl bg-tertiary-container/10 p-3">
                  <p className="text-sm font-medium text-tertiary">
                    조직 효율성 개선
                  </p>
                  <p className="mt-1 text-xs text-tertiary">
                    1인당 생산성이 전년 동기 대비 8% 향상되었습니다.
                    디지털 전환 투자 효과가 나타나고 있습니다.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 최근 보고서 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-foreground">
                <FileText className="mr-2 inline-block h-4 w-4" />
                {t('executive.recentReports')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* TODO: replace with API data */}
              <div className="space-y-2">
                {[
                  { title: '2026년 1분기 인사 현황 보고서', date: '2026-02-25' },
                  { title: '성과 평가 결과 분석', date: '2026-02-20' },
                  { title: '채용 파이프라인 월간 리포트', date: '2026-02-15' },
                ].map((report) => (
                  <div
                    key={report.title}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm text-foreground">
                      {report.title}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {report.date}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
