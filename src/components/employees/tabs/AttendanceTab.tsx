'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Employee Attendance Tab (B6-1)
// 직원 프로필 > 근태현황 탭
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { Clock, AlertTriangle, CheckCircle2, MinusCircle, CalendarClock } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { ScheduleAdjustmentModal } from '@/components/attendance/ScheduleAdjustmentModal'

// ─── Types ───────────────────────────────────────────────

interface AttendanceRecord {
  id: string
  workDate: string
  clockIn: string | null
  clockOut: string | null
  status: string
  workType: string
  totalMinutes: number | null
  overtimeMinutes: number | null
}

interface WeeklySummary {
  weekStart: string
  weekEnd: string
  totalHours: number
  overtimeHours: number
  days: {
    date: string
    status: string
    totalMinutes: number
  }[]
}

interface AttendanceTabData {
  recentRecords: AttendanceRecord[]
  weeklyHours: number
  monthlyHours: number
  lateCount: number
  absentCount: number
  weekSummary?: WeeklySummary
}

// ─── Helpers ─────────────────────────────────────────────

function fmtTime(t: string | null): string {
  if (!t) return '—'
  return new Date(t).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' })
}

function fmtHours(minutes: number | null): string {
  if (!minutes) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  NORMAL: { label: '정상', color: 'bg-[#D1FAE5] text-[#047857]' },
  LATE: { label: '지각', color: 'bg-[#FEF3C7] text-[#B45309]' },
  EARLY_OUT: { label: '조퇴', color: 'bg-[#FFF7ED] text-[#C2410C]' },
  ABSENT: { label: '결근', color: 'bg-[#FEE2E2] text-[#B91C1C]' },
  HOLIDAY: { label: '휴가', color: 'bg-[#E0E7FF] text-[#4338CA]' },
}

// ─── Mini KPI ────────────────────────────────────────────

function MiniKpi({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${warn ? 'border-[#FECACA] bg-[#FEF2F2]' : 'border-[#E8E8E8] bg-white'}`}>
      <p className="text-xs text-[#888] mb-1">{label}</p>
      <p className={`text-2xl font-bold ${warn ? 'text-[#B91C1C]' : 'text-[#1A1A1A]'}`}>{value}</p>
      {sub && <p className="text-xs text-[#999] mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Component ───────────────────────────────────────────

interface Props {
  employeeId: string
}

export function AttendanceTab({ employeeId }: Props) {
  const [data, setData] = useState<AttendanceTabData | null>(null)
  const [loading, setLoading] = useState(true)
  const [adjustModalOpen, setAdjustModalOpen] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch recent attendance records via existing API
      const res = await apiClient.get<{
        records: AttendanceRecord[]
        pagination: unknown
      }>(`/api/v1/attendance/employees/${employeeId}?limit=10`)

      const records = res.data?.records ?? []

      // Compute mini-stats client-side from recent records
      const weeklyHours = records
        .filter((r) => {
          const d = new Date(r.workDate)
          const now = new Date()
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          return d >= weekAgo
        })
        .reduce((s, r) => s + (r.totalMinutes ?? 0), 0) / 60

      const monthlyHours = records
        .filter((r) => {
          const d = new Date(r.workDate)
          const now = new Date()
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
        })
        .reduce((s, r) => s + (r.totalMinutes ?? 0), 0) / 60

      setData({
        recentRecords: records,
        weeklyHours: Math.round(weeklyHours * 10) / 10,
        monthlyHours: Math.round(monthlyHours * 10) / 10,
        lateCount: records.filter((r) => r.status === 'LATE').length,
        absentCount: records.filter((r) => r.status === 'ABSENT').length,
      })
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [employeeId])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <div className="rounded-xl border border-[#E8E8E8] bg-white p-6">
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#00C853] border-t-transparent" />
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-[#E8E8E8] bg-white p-6">
        <div className="flex flex-col items-center py-12 text-[#999]">
          <Clock className="h-10 w-10 mb-3 text-[#E8E8E8]" />
          <p className="text-sm text-[#666]">근태 데이터를 불러올 수 없습니다.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* KPI 카드 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniKpi
          label="이번 주 근무"
          value={`${data.weeklyHours}h`}
          sub="52시간 상한 기준"
          warn={data.weeklyHours >= 52}
        />
        <MiniKpi
          label="이번 달 근무"
          value={`${data.monthlyHours}h`}
        />
        <MiniKpi
          label="지각 (최근 10일)"
          value={`${data.lateCount}회`}
          warn={data.lateCount > 0}
        />
        <MiniKpi
          label="결근 (최근 10일)"
          value={`${data.absentCount}회`}
          warn={data.absentCount > 0}
        />
      </div>

      {/* 52시간 경고 배너 (Actionable) */}
      {data.weeklyHours >= 44 && (
        <div className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
          data.weeklyHours >= 52
            ? 'border-[#FF808B]/30 bg-[#FF808B]/10'
            : 'border-[#F4BE5E]/40 bg-[#F4BE5E]/10'
        }`}>
          <div className="flex items-center gap-2.5">
            <AlertTriangle className={`h-4 w-4 shrink-0 ${
              data.weeklyHours >= 52 ? 'text-[#E11D48]' : 'text-[#B45309]'
            }`} />
            <div>
              <p className={`text-sm font-semibold ${
                data.weeklyHours >= 52 ? 'text-[#E11D48]' : 'text-[#B45309]'
              }`}>
                {data.weeklyHours >= 52
                  ? `주 52시간 초과 — 현재 ${data.weeklyHours}h (차단 대상)`
                  : data.weeklyHours >= 48
                    ? `주 48시간 초과 — 현재 ${data.weeklyHours}h (경고)`
                    : `주 44시간 초과 — 현재 ${data.weeklyHours}h (주의)`}
              </p>
              <p className="text-xs text-[#8181A5] mt-0.5">
                일정 조정으로 초과근무 위험을 해소하세요.
              </p>
            </div>
          </div>
          <button
            onClick={() => setAdjustModalOpen(true)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              data.weeklyHours >= 52
                ? 'bg-[#E11D48] text-white hover:bg-[#BE1239]'
                : 'bg-[#B45309] text-white hover:bg-[#92400E]'
            }`}
          >
            <CalendarClock className="h-3.5 w-3.5" />
            근무 일정 조정
          </button>
        </div>
      )}

      {/* Schedule Adjustment Modal */}
      <ScheduleAdjustmentModal
        open={adjustModalOpen}
        onClose={() => setAdjustModalOpen(false)}
        weeklyHours={data.weeklyHours}
        employeeId={employeeId}
      />

      {/* 최근 근태 기록 테이블 */}
      <div className="rounded-xl border border-[#E8E8E8] bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-[#E8E8E8]">
          <h3 className="text-sm font-semibold text-[#1A1A1A]">최근 근태 기록</h3>
        </div>
        {data.recentRecords.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-[#999]">
            <MinusCircle className="h-8 w-8 mb-2 text-[#E8E8E8]" />
            <p className="text-sm">근태 기록이 없습니다.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#F5F5F5]">
            {data.recentRecords.map((rec) => {
              const statusCfg = STATUS_CONFIG[rec.status] ?? { label: rec.status, color: 'bg-[#FAFAFA] text-[#555]' }
              return (
                <div key={rec.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    {rec.status === 'NORMAL' ? (
                      <CheckCircle2 className="h-4 w-4 text-[#059669] shrink-0" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-[#F59E0B] shrink-0" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-[#1A1A1A]">{fmtDate(rec.workDate)}</p>
                      <p className="text-xs text-[#888]">
                        {fmtTime(rec.clockIn)} — {fmtTime(rec.clockOut)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[#888]">
                      {fmtHours(rec.totalMinutes)}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.color}`}>
                      {statusCfg.label}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
