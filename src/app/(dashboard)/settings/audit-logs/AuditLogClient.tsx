'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Audit Log Viewer
// 감사 로그 조회, 필터링, CSV 내보내기, 보존 정책 설정
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import {
  Shield,
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  AlertTriangle,
  Activity,
  Clock,
  Settings,
} from 'lucide-react'
import { useTranslations } from 'next-intl'

import type { SessionUser } from '@/types'
import { apiClient } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

// ─── Types ───────────────────────────────────────────────

interface AuditLogEntry {
  id: string
  actorId: string
  action: string
  resourceType: string
  resourceId: string
  companyId: string | null
  changes: Record<string, unknown> | null
  ipAddress: string | null
  userAgent: string | null
  sensitivityLevel: string | null
  createdAt: string
  actor: { id: string; name: string; employeeNo: string }
}

interface AuditStats {
  totalLogs: number
  todayLogs: number
  highSensitivityAccess: number
  actionDistribution: Array<{ action: string; count: number }>
  resourceDistribution: Array<{ resourceType: string; count: number }>
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

// ─── Component ───────────────────────────────────────────

export function AuditLogClient({ user }: { user: SessionUser }) {
  const t = useTranslations()
  const { toast } = useToast()

  // State
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [stats, setStats] = useState<AuditStats | null>(null)
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })
  const [loading, setLoading] = useState(true)
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null)
  const [activeTab, setActiveTab] = useState<'logs' | 'settings'>('logs')

  // Filters
  const [actionFilter, setActionFilter] = useState('')
  const [resourceTypeFilter, setResourceTypeFilter] = useState('')
  const [sensitivityFilter, setSensitivityFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Retention policy
  const [retentionDays, setRetentionDays] = useState(730)
  const [savingRetention, setSavingRetention] = useState(false)

  // ─── Fetch Logs ──────────────────────────────────────

  const fetchLogs = useCallback(
    async (page = 1) => {
      try {
        setLoading(true)
        const params: Record<string, string | number> = { page, limit: 20 }
        if (actionFilter) params.action = actionFilter
        if (resourceTypeFilter) params.resourceType = resourceTypeFilter
        if (sensitivityFilter) params.sensitivityLevel = sensitivityFilter
        if (dateFrom) params.dateFrom = dateFrom
        if (dateTo) params.dateTo = dateTo

        const res = await apiClient.getList<AuditLogEntry>(
          '/api/v1/audit/logs',
          params,
        )
        setLogs(res.data)
        setPagination(res.pagination)
      } catch {
        toast({
          title: '오류',
          description: '감사 로그를 불러오지 못했습니다.',
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    },
    [actionFilter, resourceTypeFilter, sensitivityFilter, dateFrom, dateTo, toast],
  )

  const fetchStats = useCallback(async () => {
    try {
      const res = await apiClient.get<AuditStats>('/api/v1/audit/logs/stats')
      setStats(res.data)
    } catch {
      // Non-critical, ignore
    }
  }, [])

  const fetchRetentionPolicy = useCallback(async () => {
    try {
      const res = await apiClient.get<{ retentionDays: number }>(
        '/api/v1/audit/retention-policy',
      )
      setRetentionDays(res.data.retentionDays)
    } catch {
      // Use default
    }
  }, [])

  useEffect(() => {
    fetchLogs()
    fetchStats()
    fetchRetentionPolicy()
  }, [fetchLogs, fetchStats, fetchRetentionPolicy])

  // ─── Export CSV ──────────────────────────────────────

  const handleExport = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (actionFilter) params.set('action', actionFilter)
      if (resourceTypeFilter) params.set('resourceType', resourceTypeFilter)
      if (sensitivityFilter) params.set('sensitivityLevel', sensitivityFilter)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)

      const url = `/api/v1/audit/logs/export?${params.toString()}`
      const response = await fetch(url)
      if (!response.ok) throw new Error('Export failed')

      const blob = await response.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(a.href)

      toast({ title: '성공', description: 'CSV 파일이 다운로드되었습니다.' })
    } catch {
      toast({
        title: '오류',
        description: 'CSV 내보내기에 실패했습니다.',
        variant: 'destructive',
      })
    }
  }, [actionFilter, resourceTypeFilter, sensitivityFilter, dateFrom, dateTo, toast])

  // ─── Save Retention Policy ──────────────────────────

  const handleSaveRetention = useCallback(async () => {
    try {
      setSavingRetention(true)
      await apiClient.put('/api/v1/audit/retention-policy', { retentionDays })
      toast({ title: '성공', description: '보존 정책이 저장되었습니다.' })
    } catch {
      toast({
        title: '오류',
        description: '보존 정책 저장에 실패했습니다.',
        variant: 'destructive',
      })
    } finally {
      setSavingRetention(false)
    }
  }, [retentionDays, toast])

  // ─── Helpers ─────────────────────────────────────────

  const sensitivityBadge = (level: string | null) => {
    if (!level) return null
    const colors: Record<string, string> = {
      HIGH: 'bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]',
      MEDIUM: 'bg-[#FEF3C7] text-[#B45309] border-[#FCD34D]',
      LOW: 'bg-[#FAFAFA] text-[#555] border-[#E8E8E8]',
    }
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colors[level] ?? colors.LOW}`}
      >
        {level}
      </span>
    )
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // ─── Render ──────────────────────────────────────────

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="감사 로그"
        description="시스템 활동 내역을 조회하고 관리합니다."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-1" />
              CSV 내보내기
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#E8F5E9] rounded-lg">
                  <Activity className="h-5 w-5 text-[#00C853]" />
                </div>
                <div>
                  <p className="text-xs text-[#666]">전체 로그</p>
                  <p className="text-2xl font-bold text-[#1A1A1A]">
                    {stats.totalLogs.toLocaleString()}
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
                  <p className="text-xs text-[#666]">오늘 작업</p>
                  <p className="text-2xl font-bold text-[#1A1A1A]">
                    {stats.todayLogs.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#FEE2E2] rounded-lg">
                  <Shield className="h-5 w-5 text-[#DC2626]" />
                </div>
                <div>
                  <p className="text-xs text-[#666]">민감 데이터 접근</p>
                  <p className="text-2xl font-bold text-[#1A1A1A]">
                    {stats.highSensitivityAccess.toLocaleString()}
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
                  <p className="text-xs text-[#666]">주요 액션</p>
                  <p className="text-2xl font-bold text-[#1A1A1A]">
                    {stats.actionDistribution.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-[#E8E8E8]">
        <button
          className={`px-4 py-2.5 text-sm font-medium border-b-2 ${
            activeTab === 'logs'
              ? 'border-[#00C853] text-[#00C853]'
              : 'border-transparent text-[#666] hover:text-[#333]'
          }`}
          onClick={() => setActiveTab('logs')}
        >
          로그 조회
        </button>
        <button
          className={`px-4 py-2.5 text-sm font-medium border-b-2 ${
            activeTab === 'settings'
              ? 'border-[#00C853] text-[#00C853]'
              : 'border-transparent text-[#666] hover:text-[#333]'
          }`}
          onClick={() => setActiveTab('settings')}
        >
          <Settings className="h-4 w-4 inline mr-1" />
          보존 정책
        </button>
      </div>

      {activeTab === 'logs' && (
        <>
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div>
                  <Label className="text-xs text-[#666] mb-1">액션</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[#999]" />
                    <Input
                      placeholder="액션 검색..."
                      value={actionFilter}
                      onChange={(e) => setActionFilter(e.target.value)}
                      className="pl-8 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-[#666] mb-1">리소스 유형</Label>
                  <Input
                    placeholder="리소스 유형..."
                    value={resourceTypeFilter}
                    onChange={(e) => setResourceTypeFilter(e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-[#666] mb-1">민감도</Label>
                  <Select value={sensitivityFilter} onValueChange={setSensitivityFilter}>
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="전체" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체</SelectItem>
                      <SelectItem value="HIGH">HIGH</SelectItem>
                      <SelectItem value="MEDIUM">MEDIUM</SelectItem>
                      <SelectItem value="LOW">LOW</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-[#666] mb-1">시작일</Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-[#666] mb-1">종료일</Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end mt-3">
                <Button size="sm" onClick={() => fetchLogs(1)}>
                  <Search className="h-4 w-4 mr-1" />
                  검색
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-[#FAFAFA]">
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#666] uppercase tracking-wider">
                        시각
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#666] uppercase tracking-wider">
                        사용자
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#666] uppercase tracking-wider">
                        액션
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#666] uppercase tracking-wider">
                        리소스
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#666] uppercase tracking-wider">
                        IP
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#666] uppercase tracking-wider">
                        민감도
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[#666] uppercase tracking-wider">
                        상세
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-[#999]">
                          로딩 중...
                        </td>
                      </tr>
                    ) : logs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-[#999]">
                          감사 로그가 없습니다.
                        </td>
                      </tr>
                    ) : (
                      logs.map((log) => (
                        <tr
                          key={log.id}
                          className="border-b border-[#F5F5F5] hover:bg-[#FAFAFA]"
                        >
                          <td className="px-4 py-3 text-[#555] whitespace-nowrap">
                            {formatDate(log.createdAt)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-[#1A1A1A]">
                              {log.actor.name}
                            </div>
                            <div className="text-xs text-[#666]">
                              {log.actor.employeeNo}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <code className="text-xs bg-[#F5F5F5] px-1.5 py-0.5 rounded">
                              {log.action}
                            </code>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[#555]">{log.resourceType}</span>
                            <span className="text-[#999] text-xs ml-1">
                              {log.resourceId.slice(0, 8)}...
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[#666] text-xs">
                            {log.ipAddress ?? '-'}
                          </td>
                          <td className="px-4 py-3">
                            {sensitivityBadge(log.sensitivityLevel)}
                          </td>
                          <td className="px-4 py-3">
                            {log.changes && (
                              <button
                                onClick={() => setSelectedLog(log)}
                                className="text-[#00C853] hover:text-[#00A844]"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <p className="text-sm text-[#666]">
                    전체 {pagination.total.toLocaleString()}건 중{' '}
                    {((pagination.page - 1) * pagination.limit + 1).toLocaleString()}-
                    {Math.min(
                      pagination.page * pagination.limit,
                      pagination.total,
                    ).toLocaleString()}
                    건
                  </p>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page <= 1}
                      onClick={() => fetchLogs(pagination.page - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => fetchLogs(pagination.page + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {activeTab === 'settings' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">감사 로그 보존 정책</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-[#666]">
              감사 로그의 보존 기간을 설정합니다. 법적 요구사항에 따라 최소 1년(365일)
              이상 보존해야 합니다.
            </p>
            <div className="flex items-end gap-3 max-w-md">
              <div className="flex-1">
                <Label className="text-sm font-medium text-[#333]">
                  보존 기간 (일)
                </Label>
                <Input
                  type="number"
                  min={365}
                  max={3650}
                  value={retentionDays}
                  onChange={(e) => setRetentionDays(Number(e.target.value))}
                  className="mt-1"
                />
              </div>
              <Button
                onClick={handleSaveRetention}
                disabled={savingRetention}
                className="bg-[#00C853] hover:bg-[#00A844] text-white"
              >
                {savingRetention ? '저장 중...' : '저장'}
              </Button>
            </div>
            <div className="text-xs text-[#999] space-y-1">
              <p>• 기본값: 730일 (2년)</p>
              <p>• 최소: 365일 (1년) — 법정 최소 요구</p>
              <p>• 최대: 3650일 (10년)</p>
              <p>• 약 {Math.round(retentionDays / 365 * 10) / 10}년</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedLog(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold">변경 상세</h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-[#999] hover:text-[#555]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[#666]">시각</p>
                  <p className="font-medium">{formatDate(selectedLog.createdAt)}</p>
                </div>
                <div>
                  <p className="text-[#666]">사용자</p>
                  <p className="font-medium">{selectedLog.actor.name}</p>
                </div>
                <div>
                  <p className="text-[#666]">액션</p>
                  <p className="font-medium">{selectedLog.action}</p>
                </div>
                <div>
                  <p className="text-[#666]">리소스</p>
                  <p className="font-medium">
                    {selectedLog.resourceType} / {selectedLog.resourceId}
                  </p>
                </div>
                <div>
                  <p className="text-[#666]">IP</p>
                  <p className="font-medium">{selectedLog.ipAddress ?? '-'}</p>
                </div>
                <div>
                  <p className="text-[#666]">민감도</p>
                  {sensitivityBadge(selectedLog.sensitivityLevel)}
                </div>
              </div>
              {selectedLog.changes && (
                <div>
                  <p className="text-[#666] text-sm mb-2">변경 내용</p>
                  <pre className="bg-[#FAFAFA] rounded-lg p-4 text-xs overflow-auto max-h-96 border border-[#E8E8E8]">
                    {JSON.stringify(selectedLog.changes, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
