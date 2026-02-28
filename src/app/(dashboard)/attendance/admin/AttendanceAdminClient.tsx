'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Attendance Admin Client
// 전체 근태 관리: KPI 카드 + 이상 근태 테이블 + 수동 보정
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { apiClient } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import type { DataTableColumn } from '@/components/shared/DataTable'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { ko } from '@/lib/i18n/ko'
import type { SessionUser } from '@/types'

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

interface CorrectionForm {
  clockIn: string
  clockOut: string
  status: string
  workType: string
  note: string
}

// ─── Status label map ───────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  NORMAL: ko.attendance.normal,
  LATE: ko.attendance.late,
  EARLY_OUT: ko.attendance.earlyOut,
  ABSENT: ko.attendance.absent,
}

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  NORMAL: 'default',
  LATE: 'secondary',
  EARLY_OUT: 'outline',
  ABSENT: 'destructive',
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

  const [data, setData] = useState<AdminAttendanceData | null>(null)
  const [loading, setLoading] = useState(true)

  // Correction dialog state
  const [selectedAnomaly, setSelectedAnomaly] = useState<AnomalyRecord | null>(null)
  const [correction, setCorrection] = useState<CorrectionForm>(INITIAL_CORRECTION)
  const [submitting, setSubmitting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<AdminAttendanceData>('/api/v1/attendance/admin')
      setData(res.data)
    } catch {
      // TODO: error toast
    } finally {
      setLoading(false)
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

  const handleSubmitCorrection = useCallback(async () => {
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
      header: ko.employee.name,
      render: (row) => row.employee?.name ?? '—',
    },
    {
      key: 'employeeNo',
      header: ko.employee.employeeCode,
      render: (row) => row.employee?.employeeNo ?? '—',
    },
    {
      key: 'clockIn',
      header: ko.attendance.clockIn,
      render: (row) => formatTime(row.clockIn),
    },
    {
      key: 'clockOut',
      header: ko.attendance.clockOut,
      render: (row) => formatTime(row.clockOut),
    },
    {
      key: 'status',
      header: ko.attendance.status,
      render: (row) => (
        <Badge variant={STATUS_VARIANTS[row.status] ?? 'outline'}>
          {STATUS_LABELS[row.status] ?? row.status}
        </Badge>
      ),
    },
    {
      key: 'workType',
      header: ko.attendance.workType,
    },
  ]

  // ─── Render ───

  return (
    <div className="space-y-6">
      <PageHeader title={ko.attendance.adminAttendance} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              전체 인원
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{kpi?.totalEmployees ?? 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {ko.attendance.clockIn}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {kpi?.presentCount ?? 0}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({presentPct}%)
              </span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {ko.attendance.late}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${(kpi?.lateCount ?? 0) > 0 ? 'text-red-600' : ''}`}>
              {kpi?.lateCount ?? 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {ko.attendance.absent}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${(kpi?.absentCount ?? 0) > 0 ? 'text-red-600' : ''}`}>
              {kpi?.absentCount ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Average work hours */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {ko.attendance.workHours} (평균)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">
            {kpi ? formatMinutes(kpi.avgTotalMinutes) : '—'}
          </p>
        </CardContent>
      </Card>

      {/* Anomaly table */}
      <DataTable
        columns={columns as unknown as DataTableColumn<Record<string, unknown>>[]}
        data={anomalies as unknown as Record<string, unknown>[]}
        loading={loading}
        rowKey={(row) => (row as unknown as AnomalyRecord).id}
        onRowClick={(row) => handleRowClick(row as unknown as AnomalyRecord)}
        emptyMessage={ko.common.noData}
      />

      {/* Correction dialog */}
      <Dialog open={selectedAnomaly !== null} onOpenChange={(open) => { if (!open) handleCloseDialog() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {ko.attendance.correction} — {selectedAnomaly?.employee?.name ?? ''}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="correction-clockIn">{ko.attendance.clockIn}</Label>
              <Input
                id="correction-clockIn"
                type="datetime-local"
                value={correction.clockIn}
                onChange={(e) => setCorrection((prev) => ({ ...prev, clockIn: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="correction-clockOut">{ko.attendance.clockOut}</Label>
              <Input
                id="correction-clockOut"
                type="datetime-local"
                value={correction.clockOut}
                onChange={(e) => setCorrection((prev) => ({ ...prev, clockOut: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>{ko.attendance.status}</Label>
              <Select
                value={correction.status}
                onValueChange={(v) => setCorrection((prev) => ({ ...prev, status: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={ko.common.selectPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NORMAL">{ko.attendance.normal}</SelectItem>
                  <SelectItem value="LATE">{ko.attendance.late}</SelectItem>
                  <SelectItem value="EARLY_OUT">{ko.attendance.earlyOut}</SelectItem>
                  <SelectItem value="ABSENT">{ko.attendance.absent}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{ko.attendance.workType}</Label>
              <Select
                value={correction.workType}
                onValueChange={(v) => setCorrection((prev) => ({ ...prev, workType: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={ko.common.selectPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="REGULAR">{ko.attendance.regular}</SelectItem>
                  <SelectItem value="REMOTE">{ko.attendance.remote}</SelectItem>
                  <SelectItem value="FIELD">{ko.attendance.field}</SelectItem>
                  <SelectItem value="BUSINESS_TRIP">{ko.attendance.businessTrip}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="correction-note">
                {ko.attendance.correctionReason} <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="correction-note"
                value={correction.note}
                onChange={(e) => setCorrection((prev) => ({ ...prev, note: e.target.value }))}
                placeholder={ko.attendance.correctionReason}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog} disabled={submitting}>
              {ko.common.cancel}
            </Button>
            <Button
              onClick={handleSubmitCorrection}
              disabled={submitting || !correction.note.trim()}
            >
              {submitting ? ko.common.loading : ko.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
