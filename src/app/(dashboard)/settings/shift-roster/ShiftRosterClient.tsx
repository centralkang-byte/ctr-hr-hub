'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Shift Roster Client
// 근무 배정표 (월간 그리드)
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'

import type { SessionUser } from '@/types'
import { apiClient } from '@/lib/api'
import { ko } from '@/lib/i18n/ko'
import { PageHeader } from '@/components/shared/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// ─── Local interfaces (matching API response) ───────────

interface RosterData {
  year: number
  month: number
  days: string[]
  roster: RosterEntry[]
}

interface RosterEntry {
  employeeId: string
  employeeName: string
  employeeNo: string
  scheduleName: string
  scheduleType: string
  shiftGroup: string | null
  effectiveFrom: string
  effectiveTo: string | null
}

interface Warning {
  employeeId: string
  employeeName: string
  type: string
  message: string
}

// ─── Helper functions ───────────────────────────────────

function getShiftColor(type: string): string {
  switch (type) {
    case 'FIXED':
      return 'bg-blue-100 text-blue-800'
    case 'FLEXIBLE':
      return 'bg-green-100 text-green-800'
    case 'SHIFT':
      return 'bg-purple-100 text-purple-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

function getShiftLabel(type: string, group: string | null): string {
  switch (type) {
    case 'FIXED':
      return '고'
    case 'FLEXIBLE':
      return '유'
    case 'SHIFT':
      return group ? group.charAt(0) : '교'
    default:
      return '—'
  }
}

// ─── Component ──────────────────────────────────────────

export function ShiftRosterClient({ user }: { user: SessionUser }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [rosterData, setRosterData] = useState<RosterData | null>(null)
  const [warnings, setWarnings] = useState<Warning[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ─── 연도 옵션 (현재 연도 ± 2) ──────────────────────────
  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i)
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1)

  // ─── 근무 배정표 조회 ───────────────────────────────────
  const fetchRoster = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.get<RosterData>(
        `/api/v1/shift-roster/${year}/${month}`,
      )
      setRosterData(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : ko.common.error)
    } finally {
      setLoading(false)
    }
  }, [year, month])

  // ─── 경고 조회 ─────────────────────────────────────────
  const fetchWarnings = useCallback(async () => {
    try {
      const res = await apiClient.get<{ warnings: Warning[] }>(
        '/api/v1/shift-roster/warnings',
      )
      setWarnings(res.data.warnings)
    } catch {
      // 경고 실패는 조용히 처리
    }
  }, [])

  useEffect(() => {
    void fetchRoster()
    void fetchWarnings()
  }, [fetchRoster, fetchWarnings])

  const days = rosterData?.days ?? []
  const roster = rosterData?.roster ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title={ko.shift.roster}
        description="월간 근무 배정 현황을 확인합니다."
      />

      {/* ─── 월 선택기 ─────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Select
          value={String(year)}
          onValueChange={(v) => setYear(Number(v))}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}년
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={String(month)}
          onValueChange={(v) => setMonth(Number(v))}
        >
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((m) => (
              <SelectItem key={m} value={String(m)}>
                {m}월
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ─── 경고 배너 ─────────────────────────────────────── */}
      {warnings.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-orange-800">
              <AlertTriangle className="h-4 w-4" />
              {ko.attendance.overtimeCritical} ({warnings.length}건)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="space-y-1">
              {warnings.map((w, idx) => (
                <li key={idx} className="text-sm text-orange-700">
                  {w.message}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* ─── 범례 ──────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <span className="inline-block h-5 w-7 rounded bg-blue-100 text-center text-xs leading-5 text-blue-800">
            고
          </span>
          <span className="text-xs text-muted-foreground">{ko.shift.fixed}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block h-5 w-7 rounded bg-green-100 text-center text-xs leading-5 text-green-800">
            유
          </span>
          <span className="text-xs text-muted-foreground">{ko.shift.flexible}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block h-5 w-7 rounded bg-purple-100 text-center text-xs leading-5 text-purple-800">
            교
          </span>
          <span className="text-xs text-muted-foreground">{ko.shift.shiftWork}</span>
        </div>
      </div>

      {/* ─── 로딩 / 에러 / 빈 상태 ───────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">{ko.common.loading}</span>
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && roster.length === 0 && (
        <div className="py-12 text-center text-sm text-muted-foreground">
          {ko.common.noData}
        </div>
      )}

      {/* ─── 월간 그리드 ───────────────────────────────────── */}
      {!loading && !error && roster.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="sticky left-0 z-10 bg-gray-50 px-4 py-2 text-left font-medium">
                  {ko.employee.name}
                </th>
                {days.map((day) => {
                  const d = new Date(day)
                  const dayOfWeek = d.getDay()
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
                  return (
                    <th
                      key={day}
                      className={`min-w-[40px] px-2 py-2 text-center font-medium ${
                        isWeekend ? 'text-red-400' : ''
                      }`}
                    >
                      {d.getDate()}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {roster.map((entry) => (
                <tr key={entry.employeeId} className="border-t hover:bg-gray-50/50">
                  <td className="sticky left-0 z-10 bg-white px-4 py-2 font-medium">
                    <div className="flex flex-col">
                      <span>{entry.employeeName}</span>
                      <span className="text-xs text-muted-foreground">
                        {entry.scheduleName}
                      </span>
                    </div>
                  </td>
                  {days.map((day) => {
                    const isActive =
                      day >= entry.effectiveFrom &&
                      (!entry.effectiveTo || day <= entry.effectiveTo)

                    return (
                      <td key={day} className="px-1 py-1 text-center">
                        {isActive ? (
                          <span
                            className={`inline-block h-6 w-8 rounded text-xs leading-6 ${getShiftColor(entry.scheduleType)}`}
                            title={`${entry.scheduleName}${entry.shiftGroup ? ` (${entry.shiftGroup})` : ''}`}
                          >
                            {getShiftLabel(entry.scheduleType, entry.shiftGroup)}
                          </span>
                        ) : null}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
