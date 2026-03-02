'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Shift Roster Client
// 근무 배정표 (월간 그리드)
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, Loader2 } from 'lucide-react'

import type { SessionUser } from '@/types'
import { apiClient } from '@/lib/api'
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
      return 'bg-[#E8F5E9] text-[#00A844]'
    case 'FLEXIBLE':
      return 'bg-green-100 text-green-800'
    case 'SHIFT':
      return 'bg-[#F3E8FF] text-[#6B21A8]'
    default:
      return 'bg-[#F5F5F5] text-[#1A1A1A]'
  }
}

// ─── Component ──────────────────────────────────────────

export function ShiftRosterClient({ user }: { user: SessionUser }) {
  const t = useTranslations('shift')
  const tc = useTranslations('common')
  const ta = useTranslations('attendance')
  const te = useTranslations('employee')

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [rosterData, setRosterData] = useState<RosterData | null>(null)
  const [warnings, setWarnings] = useState<Warning[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ─── Helper for shift label ───
  const getShiftLabel = (type: string, group: string | null): string => {
    switch (type) {
      case 'FIXED':
        return t('fixedShort')
      case 'FLEXIBLE':
        return t('flexibleShort')
      case 'SHIFT':
        return group ? group.charAt(0) : t('shiftShort')
      default:
        return '—'
    }
  }

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
      setError(err instanceof Error ? err.message : tc('error'))
    } finally {
      setLoading(false)
    }
  }, [year, month, tc])

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
        title={t('roster')}
        description={t('rosterDescription')}
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
                {t('yearSuffix', { year: y })}
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
                {t('monthSuffix', { month: m })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ─── 경고 배너 ─────────────────────────────────────── */}
      {warnings.length > 0 && (
        <Card className="border-[#FED7AA] bg-[#FFF7ED]">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-[#9A3412]">
              <AlertTriangle className="h-4 w-4" />
              {ta('overtimeCritical')} ({t('warningCount', { count: warnings.length })})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="space-y-1">
              {warnings.map((w, idx) => (
                <li key={idx} className="text-sm text-[#C2410C]">
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
          <span className="inline-block h-5 w-7 rounded bg-[#E8F5E9] text-center text-xs leading-5 text-[#00A844]">
            {t('fixedShort')}
          </span>
          <span className="text-xs text-muted-foreground">{t('fixed')}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block h-5 w-7 rounded bg-green-100 text-center text-xs leading-5 text-green-800">
            {t('flexibleShort')}
          </span>
          <span className="text-xs text-muted-foreground">{t('flexible')}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block h-5 w-7 rounded bg-[#F3E8FF] text-center text-xs leading-5 text-[#6B21A8]">
            {t('shiftShort')}
          </span>
          <span className="text-xs text-muted-foreground">{t('shiftWork')}</span>
        </div>
      </div>

      {/* ─── 로딩 / 에러 / 빈 상태 ───────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">{tc('loading')}</span>
        </div>
      )}

      {error && (
        <div className="rounded-md bg-[#FEE2E2] p-4 text-sm text-[#B91C1C]">
          {error}
        </div>
      )}

      {!loading && !error && roster.length === 0 && (
        <div className="py-12 text-center text-sm text-muted-foreground">
          {tc('noData')}
        </div>
      )}

      {/* ─── 월간 그리드 ───────────────────────────────────── */}
      {!loading && !error && roster.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-[#FAFAFA]">
                <th className="sticky left-0 z-10 bg-[#FAFAFA] px-4 py-2 text-left font-medium">
                  {te('name')}
                </th>
                {days.map((day) => {
                  const d = new Date(day)
                  const dayOfWeek = d.getDay()
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
                  return (
                    <th
                      key={day}
                      className={`min-w-[40px] px-2 py-2 text-center font-medium ${
                        isWeekend ? 'text-[#F87171]' : ''
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
                <tr key={entry.employeeId} className="border-t hover:bg-[#FAFAFA]/50">
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
