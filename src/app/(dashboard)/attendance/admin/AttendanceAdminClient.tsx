'use client'

import { EmptyState } from '@/components/ui/EmptyState'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Attendance Admin Client
// 전체 근태 관리: KPI 카드 + 이상 근태 테이블 + 수동 보정
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { TYPOGRAPHY } from '@/lib/styles/typography'
import { STATUS_VARIANT } from '@/lib/styles/status'
import { apiClient } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import type { DataTableColumn } from '@/components/shared/DataTable'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import type { SessionUser } from '@/types'
import { useSubmitGuard } from '@/hooks/useSubmitGuard'

// ─── Types ──────────────────────────────────────────────────

interface AttendanceKpi {
  totalEmployees: number
  presentCount: number
  lateCount: number
  absentCount: number
  avgTotalMinutes: number
}

interface AnomalyRecord {
  id: string
  employeeId: string
  clockIn: string | null
  clockOut: string | null
  status: string
  workType: string
  totalMinutes: number
  employee?: { name: string; employeeNo: string }
}

interface AdminAttendanceData {
  date: string
  kpi: AttendanceKpi
  anomalies: AnomalyRecord[]
}

interface WorkHourAlert {
  id: string
  alertLevel: 'caution' | 'warning' | 'blocked'
  totalHours: number
  weekStart: string
  isResolved: boolean
  employee?: { id: string; name: string; email: string }
}

interface CorrectionForm {
  clockIn: string
  clockOut: string
  status: string
  workType: string
  note: string
}

// ─── Status variant map ─────────────────────────────────────

const STATUS_BADGE_STYLES: Record<string, string> = {
  NORMAL: STATUS_VARIANT.success,
  LATE: STATUS_VARIANT.error,
  EARLY_OUT: STATUS_VARIANT.warning,
  ABSENT: STATUS_VARIANT.error,
}

// ─── Helpers ────────────────────────────────────────────────

function formatTime(t: string | null | undefined): string {
  if (!t) return '—'
  return new Date(t).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

function formatMinutes(m: number): string {
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

const INITIAL_CORRECTION: CorrectionForm = {
  clockIn: '',
  clockOut: '',
  status: '',
  workType: '',
  note: '',
}

// ─── Component ──────────────────────────────────────────────

export function AttendanceAdminClient({ user }: { user: SessionUser }) {
  void user

  const t = useTranslations('attendance')
  const tc = useTranslations('common')
  const te = useTranslations('employee')

  const STATUS_LABELS: Record<string, string> = {
    NORMAL: t('normal'),
    LATE: t('late'),
    EARLY_OUT: t('earlyOut'),
    ABSENT: t('absent'),
  }

  const [data, setData] = useState<AdminAttendanceData | null>(null)
  const [loading, setLoading] = useState(true)

  // 52h alerts state
  const [alerts, setAlerts] = useState<WorkHourAlert[]>([])
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  // Correction dialog state
  const [selectedAnomaly, setSelectedAnomaly] = useState<AnomalyRecord | null>(null)
  const [correction, setCorrection] = useState<CorrectionForm>(INITIAL_CORRECTION)
  const [submitting, setSubmitting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [adminRes, alertRes] = await Promise.all([
        apiClient.get<AdminAttendanceData>('/api/v1/attendance/admin'),
        apiClient.get<WorkHourAlert[]>('/api/v1/attendance/work-hour-alerts'),
      ])
      setData(adminRes.data)
      setAlerts(alertRes.data ?? [])
    } catch {
      // TODO: error toast
    } finally {
      setLoading(false)
    }
  }, [])

  const handleResolveAlert = useCallback(async (alertId: string) => {
    setResolvingId(alertId)
    try {
      await apiClient.patch(`/api/v1/attendance/work-hour-alerts/${alertId}`, {})
      setAlerts((prev) => prev.filter((a) => a.id !== alertId))
    } catch {
      // TODO: error toast
    } finally {
      setResolvingId(null)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  // ─── Open correction dialog ───

  const handleRowClick = useCallback((row: AnomalyRecord) => {
    setSelectedAnomaly(row)
    setCorrection({
      clockIn: row.clockIn ?? '',
      clockOut: row.clockOut ?? '',
      status: row.status,
      workType: row.workType,
      note: '',
    })
  }, [])

  const handleCloseDialog = useCallback(() => {
    setSelectedAnomaly(null)
    setCorrection(INITIAL_CORRECTION)
  }, [])

  // ─── Submit correction ───

  const submitAction = useCallback(async () => {
    if (!selectedAnomaly || !correction.note.trim()) return
    setSubmitting(true)
    try {
      await apiClient.put(`/api/v1/attendance/${selectedAnomaly.id}`, {
        clockIn: correction.clockIn || null,
        clockOut: correction.clockOut || null,
        status: correction.status,
        workType: correction.workType,
        note: correction.note,
      })
      handleCloseDialog()
      void fetchData()
    } catch {
      // TODO: error toast
    } finally {
      setSubmitting(false)
    }
  }, [selectedAnomaly, correction, handleCloseDialog, fetchData])

  const { guardedSubmit } = useSubmitGuard(submitAction)

  // ─── KPI data ───

  const kpi = data?.kpi
  const anomalies = data?.anomalies ?? []
  const presentPct = kpi && kpi.totalEmployees > 0
    ? ((kpi.presentCount / kpi.totalEmployees) * 100).toFixed(1)
    : '0'

  // ─── Anomaly table columns ───

  const columns: DataTableColumn<AnomalyRecord>[] = [
    {
      key: 'employeeName',
      header: te('name'),
      render: (row) => row.employee?.name ?? '—',
    },
    {
      key: 'employeeNo',
      header: te('employeeCode'),
      render: (row) => row.employee?.employeeNo ?? '—',
    },
    {
      key: 'clockIn',
      header: t('clockIn'),
      render: (row) => formatTime(row.clockIn),
    },
    {
      key: 'clockOut',
      header: t('clockOut'),
      render: (row) => formatTime(row.clockOut),
    },
    {
      key: 'status',
      header: t('status'),
      render: (row) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-[4px] text-xs font-semibold ${STATUS_BADGE_STYLES[row.status] ?? STATUS_VARIANT.neutral}`}>
          {STATUS_LABELS[row.status] ?? row.status}
        </span>
      ),
    },
    {
      key: 'workType',
      header: t('workType'),
    },
  ]

  // ─── Render ───

  return (
    <div className="space-y-4">
      <PageHeader title={t('adminAttendance')} />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-medium mb-2">{t('totalEmployees')}</p>
          <p className={TYPOGRAPHY.stat}><AnimatedNumber value={kpi?.totalEmployees ?? 0} /></p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-medium mb-2">{t('clockIn')}</p>
          <p className={TYPOGRAPHY.stat}><AnimatedNumber value={kpi?.presentCount ?? 0} /></p>
          <span className="text-xs font-semibold text-primary">{presentPct}%</span>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-medium mb-2">{t('late')}</p>
          <p className={`text-3xl font-bold tabular-nums ${(kpi?.lateCount ?? 0) > 0 ? 'text-red-500' : 'text-foreground'}`}><AnimatedNumber value={kpi?.lateCount ?? 0} /></p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-medium mb-2">{t('absent')}</p>
          <p className={`text-3xl font-bold tabular-nums ${(kpi?.absentCount ?? 0) > 0 ? 'text-red-500' : 'text-foreground'}`}><AnimatedNumber value={kpi?.absentCount ?? 0} /></p>
        </div>
      </div>

      {/* Average work hours */}
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-xs text-muted-foreground font-medium mb-2">{t('averageWorkHours')}</p>
        <p className={TYPOGRAPHY.stat}>{kpi ? formatMinutes(kpi.avgTotalMinutes) : '—'}</p>
      </div>

      {/* 52시간 모니터링 위젯 */}
      {alerts.length > 0 && (
        <div className="rounded-xl border border-destructive/20 bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-destructive/5 border-b border-destructive/20">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-sm font-semibold text-destructive">
                52시간 초과 경고 ({alerts.length}명)
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-500/100 inline-block" />
                주의: {alerts.filter((a) => a.alertLevel === 'caution').length}
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-orange-500/100 inline-block" />
                경고: {alerts.filter((a) => a.alertLevel === 'warning').length}
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-destructive/50 inline-block" />
                차단: {alerts.filter((a) => a.alertLevel === 'blocked').length}
              </span>
            </div>
          </div>
          <div className="divide-y divide-border">
            {!alerts?.length && <EmptyState />}
              {alerts?.map((alert) => (
              <div key={alert.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      alert.alertLevel === 'blocked'
                        ? 'bg-destructive/10 text-destructive'
                        : alert.alertLevel === 'warning'
                          ? 'bg-orange-500/10 text-orange-700'
                          : 'bg-amber-500/10 text-amber-700'
                    }`}
                  >
                    {alert.alertLevel === 'blocked' ? '차단' : alert.alertLevel === 'warning' ? '경고' : '주의'}
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {alert.employee?.name ?? '—'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {alert.totalHours.toFixed(1)}h / 주
                  </span>
                </div>
                <button
                  onClick={() => { void handleResolveAlert(alert.id) }}
                  disabled={resolvingId === alert.id}
                  className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
                >
                  {resolvingId === alert.id ? (
                    <XCircle className="h-4 w-4" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  해제
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Anomaly table */}
      <DataTable
        columns={columns as unknown as DataTableColumn<Record<string, unknown>>[]}
        data={anomalies as unknown as Record<string, unknown>[]}
        loading={loading}
        rowKey={(row) => (row as unknown as AnomalyRecord).id}
        onRowClick={(row) => handleRowClick(row as unknown as AnomalyRecord)}
        emptyMessage={tc('noData')}
      />

      {/* Correction dialog */}
      <Dialog open={selectedAnomaly !== null} onOpenChange={(open) => { if (!open) handleCloseDialog() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('correction')} — {selectedAnomaly?.employee?.name ?? ''}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="correction-clockIn">{t('clockIn')}</Label>
              <Input
                id="correction-clockIn"
                type="datetime-local"
                value={correction.clockIn}
                onChange={(e) => setCorrection((prev) => ({ ...prev, clockIn: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="correction-clockOut">{t('clockOut')}</Label>
              <Input
                id="correction-clockOut"
                type="datetime-local"
                value={correction.clockOut}
                onChange={(e) => setCorrection((prev) => ({ ...prev, clockOut: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('status')}</Label>
              <Select
                value={correction.status}
                onValueChange={(v) => setCorrection((prev) => ({ ...prev, status: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={tc('selectPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NORMAL">{t('normal')}</SelectItem>
                  <SelectItem value="LATE">{t('late')}</SelectItem>
                  <SelectItem value="EARLY_OUT">{t('earlyOut')}</SelectItem>
                  <SelectItem value="ABSENT">{t('absent')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('workType')}</Label>
              <Select
                value={correction.workType}
                onValueChange={(v) => setCorrection((prev) => ({ ...prev, workType: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={tc('selectPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="REGULAR">{t('regular')}</SelectItem>
                  <SelectItem value="REMOTE">{t('remote')}</SelectItem>
                  <SelectItem value="FIELD">{t('field')}</SelectItem>
                  <SelectItem value="BUSINESS_TRIP">{t('businessTrip')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="correction-note">
                {t('correctionReason')} <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="correction-note"
                value={correction.note}
                onChange={(e) => setCorrection((prev) => ({ ...prev, note: e.target.value }))}
                placeholder={t('correctionReason')}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog} disabled={submitting}>
              {tc('cancel')}
            </Button>
            <Button
              onClick={guardedSubmit}
              disabled={submitting || !correction.note.trim()}
            >
              {submitting ? tc('loading') : tc('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
