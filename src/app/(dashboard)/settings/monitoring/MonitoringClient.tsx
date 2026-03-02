'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — System Monitoring Dashboard
// API 응답시간, DB/Redis 상태, 에러 모니터링
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  Clock,
  Database,
  Server,
  AlertTriangle,
  RefreshCw,
  Zap,
  CheckCircle2,
  XCircle,
} from 'lucide-react'

import type { SessionUser } from '@/types'
import { apiClient } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

// ─── Types ───────────────────────────────────────────────

interface HealthCheck {
  status: string
  timestamp: string
  checks: Record<string, { status: string; latencyMs?: number }>
}

interface ApiMetrics {
  totalRequests: number
  avgResponseTime: number
  p95ResponseTime: number
  p99ResponseTime: number
  slowQueries: number
  recentErrors: number
  topEndpoints: Array<{ path: string; count: number; avgMs: number }>
}

// ─── Component ───────────────────────────────────────────

export function MonitoringClient({ user }: { user: SessionUser }) {
  const { toast } = useToast()
  const [health, setHealth] = useState<HealthCheck | null>(null)
  const [metrics, setMetrics] = useState<ApiMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [healthRes, metricsRes] = await Promise.allSettled([
        fetch('/api/v1/monitoring/health').then((r) => r.json()),
        apiClient.get<ApiMetrics>('/api/v1/monitoring/metrics'),
      ])

      if (healthRes.status === 'fulfilled') {
        setHealth(healthRes.value as HealthCheck)
      }
      if (metricsRes.status === 'fulfilled') {
        setMetrics(metricsRes.value.data)
      }
    } catch {
      toast({
        title: '오류',
        description: '모니터링 데이터를 불러오지 못했습니다.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [toast])

  useEffect(() => {
    fetchData()
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  const handleRefresh = useCallback(() => {
    setRefreshing(true)
    fetchData()
  }, [fetchData])

  const statusIcon = (status: string) => {
    if (status === 'ok' || status === 'healthy') {
      return <CheckCircle2 className="h-5 w-5 text-[#059669]" />
    }
    return <XCircle className="h-5 w-5 text-[#EF4444]" />
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-[#999]" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="시스템 모니터링"
        description="API 성능, 시스템 상태, 에러를 모니터링합니다."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw
              className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`}
            />
            새로고침
          </Button>
        }
      />

      {/* System Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#E8F5E9] rounded-lg">
                  <Server className="h-5 w-5 text-[#00C853]" />
                </div>
                <div>
                  <p className="text-xs text-[#666]">시스템 상태</p>
                  <p className="text-lg font-bold text-[#1A1A1A]">
                    {health?.status === 'healthy' ? '정상' : '점검 필요'}
                  </p>
                </div>
              </div>
              {health && statusIcon(health.status)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#D1FAE5] rounded-lg">
                  <Database className="h-5 w-5 text-[#059669]" />
                </div>
                <div>
                  <p className="text-xs text-[#666]">데이터베이스</p>
                  <p className="text-lg font-bold text-[#1A1A1A]">
                    {health?.checks.database?.latencyMs != null
                      ? `${health.checks.database.latencyMs}ms`
                      : '-'}
                  </p>
                </div>
              </div>
              {health?.checks.database && statusIcon(health.checks.database.status)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#FAF5FF] rounded-lg">
                  <Zap className="h-5 w-5 text-[#9333EA]" />
                </div>
                <div>
                  <p className="text-xs text-[#666]">Redis</p>
                  <p className="text-lg font-bold text-[#1A1A1A]">
                    {health?.checks.redis?.latencyMs != null
                      ? `${health.checks.redis.latencyMs}ms`
                      : '-'}
                  </p>
                </div>
              </div>
              {health?.checks.redis && statusIcon(health.checks.redis.status)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* API Metrics */}
      {metrics && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#E8F5E9] rounded-lg">
                    <Activity className="h-5 w-5 text-[#00C853]" />
                  </div>
                  <div>
                    <p className="text-xs text-[#666]">총 요청</p>
                    <p className="text-2xl font-bold text-[#1A1A1A]">
                      {metrics.totalRequests.toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#D1FAE5] rounded-lg">
                    <Clock className="h-5 w-5 text-[#059669]" />
                  </div>
                  <div>
                    <p className="text-xs text-[#666]">평균 응답시간</p>
                    <p className="text-2xl font-bold text-[#1A1A1A]">
                      {metrics.avgResponseTime}ms
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#FEF3C7] rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-[#D97706]" />
                  </div>
                  <div>
                    <p className="text-xs text-[#666]">P95 / P99</p>
                    <p className="text-2xl font-bold text-[#1A1A1A]">
                      {metrics.p95ResponseTime}
                      <span className="text-sm font-normal text-[#999]">
                        {' '}
                        / {metrics.p99ResponseTime}ms
                      </span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#FEE2E2] rounded-lg">
                    <XCircle className="h-5 w-5 text-[#DC2626]" />
                  </div>
                  <div>
                    <p className="text-xs text-[#666]">슬로우 / 에러</p>
                    <p className="text-2xl font-bold text-[#1A1A1A]">
                      {metrics.slowQueries}
                      <span className="text-sm font-normal text-[#999]">
                        {' '}
                        / {metrics.recentErrors}
                      </span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Endpoints */}
          {metrics.topEndpoints.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">
                  상위 API 엔드포인트 (호출 빈도)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-[#FAFAFA]">
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#666] uppercase">
                        엔드포인트
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-[#666] uppercase">
                        호출 수
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-[#666] uppercase">
                        평균 응답시간
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.topEndpoints.map((ep) => (
                      <tr
                        key={ep.path}
                        className="border-b border-[#F5F5F5] hover:bg-[#FAFAFA]"
                      >
                        <td className="px-4 py-3">
                          <code className="text-xs bg-[#F5F5F5] px-1.5 py-0.5 rounded">
                            {ep.path}
                          </code>
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          {ep.count.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`font-medium ${
                              ep.avgMs > 2000
                                ? 'text-[#DC2626]'
                                : ep.avgMs > 1000
                                  ? 'text-[#D97706]'
                                  : 'text-[#059669]'
                            }`}
                          >
                            {ep.avgMs}ms
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Last updated */}
      <p className="text-xs text-[#999] text-right">
        마지막 업데이트: {health?.timestamp ? new Date(health.timestamp).toLocaleString('ko-KR') : '-'}
        {' · '}30초마다 자동 갱신
      </p>
    </div>
  )
}
