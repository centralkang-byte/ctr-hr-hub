'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Schedule Adjustment Modal (Phase 2 - Session 2)
// 52시간 초과 위험 시 근무 일정 조정 요청 모달
// ═══════════════════════════════════════════════════════════

import { useState } from 'react'
import { AlertTriangle, X, Clock, CheckCircle2, CalendarDays, ChevronDown } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────

type AlertLevel = 'caution' | 'warning' | 'danger'

interface ScheduleAdjustmentModalProps {
  open: boolean
  onClose: () => void
  weeklyHours: number
  employeeId?: string
}

type AdjustmentType =
  | 'half_day_off'
  | 'shorten_shift'
  | 'remote_work'
  | 'postpone_overtime'

interface AdjustmentOption {
  value: AdjustmentType
  label: string
  description: string
  savingsHours: number
}

// ─── Constants ───────────────────────────────────────────

const ADJUSTMENT_OPTIONS: AdjustmentOption[] = [
  {
    value: 'half_day_off',
    label: '반차 사용',
    description: '금요일 오후 반차 처리 (4시간 단축)',
    savingsHours: 4,
  },
  {
    value: 'shorten_shift',
    label: '근무 시간 단축',
    description: '목요일 근무 2시간 단축',
    savingsHours: 2,
  },
  {
    value: 'remote_work',
    label: '재택근무 전환',
    description: '잔여 일정 재택 전환 (이동 시간 제외)',
    savingsHours: 1,
  },
  {
    value: 'postpone_overtime',
    label: '초과근무 보류',
    description: '이번 주 잔여 초과근무 취소',
    savingsHours: 3,
  },
]

const TARGET_HOURS = 52
const DAY_OPTIONS = ['월요일', '화요일', '수요일', '목요일', '금요일']

// ─── Helpers ─────────────────────────────────────────────

function getAlertLevel(hours: number): AlertLevel {
  if (hours >= 52) return 'danger'
  if (hours >= 48) return 'warning'
  return 'caution'
}

function getAlertTokens(level: AlertLevel) {
  switch (level) {
    case 'danger':
      return {
        banner: 'bg-red-400/10 border-red-400/30',
        icon: 'text-rose-600',
        text: 'text-rose-600',
        label: '52시간 초과 — 즉시 조정 필요',
      }
    case 'warning':
      return {
        banner: 'bg-amber-400/10 border-amber-400/40',
        icon: 'text-amber-700',
        text: 'text-amber-700',
        label: '48시간 초과 — 조정 권고',
      }
    default:
      return {
        banner: 'bg-amber-400/10 border-amber-400/40',
        icon: 'text-amber-700',
        text: 'text-amber-700',
        label: '44시간 초과 — 주의',
      }
  }
}

// ─── Progress Bar ─────────────────────────────────────────

function HoursProgressBar({ current, target }: { current: number; target: number }) {
  const pct = Math.min((current / target) * 100, 100)
  const isOver = current >= target
  const isNear = current >= 48

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">이번 주 누적</span>
        <span className={`font-semibold ${isOver ? 'text-rose-600' : isNear ? 'text-amber-700' : 'text-foreground'}`}>
          {current}h / {target}h
        </span>
      </div>
      <div className="h-2 rounded-full bg-border overflow-hidden">
        <div
          className={`h-full rounded-full transition-[width] duration-600 ${
            isOver
              ? 'bg-rose-600'
              : isNear
                ? 'bg-amber-400'
                : 'bg-primary'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ─── Component ───────────────────────────────────────────

export function ScheduleAdjustmentModal({
  open,
  onClose,
  weeklyHours,
}: ScheduleAdjustmentModalProps) {
  const [selectedType, setSelectedType] = useState<AdjustmentType | null>(null)
  const [selectedDay, setSelectedDay] = useState<string>('금요일')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  if (!open) return null

  const level = getAlertLevel(weeklyHours)
  const tokens = getAlertTokens(level)
  const overflow = Math.max(0, weeklyHours - TARGET_HOURS)
  const selectedOption = ADJUSTMENT_OPTIONS.find((o) => o.value === selectedType)
  const projectedHours = selectedOption
    ? Math.max(0, weeklyHours - selectedOption.savingsHours)
    : weeklyHours

  const handleSubmit = async () => {
    if (!selectedType) return
    setLoading(true)
    try {
      // Mock API call — replace with real endpoint in production
      await new Promise((resolve) => setTimeout(resolve, 1200))
      setSuccess(true)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setSelectedType(null)
    setSelectedDay('금요일')
    setNote('')
    setSuccess(false)
    onClose()
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="relative w-full max-w-lg rounded-xl bg-card shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div className="flex items-center gap-2.5">
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${tokens.banner} border`}>
                <Clock className={`h-4 w-4 ${tokens.icon}`} />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">근무 일정 조정</h2>
                <p className="text-xs text-muted-foreground">주 52시간 초과 위험 해소</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="max-h-[calc(100vh-200px)] overflow-y-auto px-6 py-5 space-y-5">

            {success ? (
              /* Success State */
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                </div>
                <div>
                  <p className="text-base font-bold text-foreground">조정 요청이 제출되었습니다</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    담당 매니저가 확인 후 승인할 예정입니다.
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  className="mt-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary/80 transition-colors"
                >
                  확인
                </button>
              </div>
            ) : (
              <>
                {/* Alert Banner */}
                <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${tokens.banner}`}>
                  <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${tokens.icon}`} />
                  <div className="space-y-0.5">
                    <p className={`text-sm font-semibold ${tokens.text}`}>{tokens.label}</p>
                    <p className="text-xs text-muted-foreground">
                      현재 {weeklyHours}시간 근무 중
                      {overflow > 0 && ` — ${overflow}시간 초과`}
                    </p>
                  </div>
                </div>

                {/* Hours Progress */}
                <div className="rounded-xl border border-border bg-muted px-4 py-3.5">
                  <HoursProgressBar current={weeklyHours} target={TARGET_HOURS} />
                  {selectedOption && (
                    <div className="mt-3 border-t border-border pt-3">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">조정 후 예상</span>
                        <span className={`font-semibold ${projectedHours < 52 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {projectedHours}h / {TARGET_HOURS}h
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Adjustment Type */}
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">조정 방법 선택</p>
                  <div className="space-y-2">
                    {ADJUSTMENT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setSelectedType(opt.value)}
                        className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
                          selectedType === opt.value
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-border hover:bg-muted'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <p className={`text-sm font-semibold ${selectedType === opt.value ? 'text-primary' : 'text-foreground'}`}>
                            {opt.label}
                          </p>
                          <p className="text-xs text-muted-foreground">{opt.description}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                          selectedType === opt.value
                            ? 'bg-primary/10 text-primary'
                            : 'bg-border text-muted-foreground'
                        }`}>
                          -{opt.savingsHours}h
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Target Day */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      적용 요일
                    </span>
                  </label>
                  <div className="relative">
                    <select
                      value={selectedDay}
                      onChange={(e) => setSelectedDay(e.target.value)}
                      className="w-full appearance-none rounded-xl border border-border bg-card px-4 py-2.5 pr-10 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
                    >
                      {DAY_OPTIONS.map((day) => (
                        <option key={day} value={day}>{day}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>

                {/* Note */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">사유 (선택)</label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={'조정 사유를 간략히 입력하세요...'}
                    rows={3}
                    className="w-full resize-none rounded-xl border border-border px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
                  />
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          {!success && (
            <div className="flex justify-end gap-2.5 border-t border-border px-6 py-4">
              <button
                onClick={handleClose}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={!selectedType || loading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    제출 중...
                  </>
                ) : (
                  '조정 요청 제출'
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
