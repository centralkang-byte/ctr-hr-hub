'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

import { useState, useEffect, useCallback } from 'react'
import { Bell, Moon, Save, Check } from 'lucide-react'
import { CARD_STYLES, BUTTON_VARIANTS } from '@/lib/styles'

type Channel = 'in_app' | 'email' | 'teams'

interface EventPref {
  in_app: boolean
  email: boolean
  teams: boolean
}

interface Preferences {
  [eventType: string]: EventPref
}

const EVENT_GROUPS = [
  {
    label: '근태 / 휴가',
    events: [
      { key: 'leave_approved', label: '휴가 승인' },
      { key: 'leave_rejected', label: '휴가 반려' },
      { key: 'overtime_warning_48h', label: '주 48시간 경고' },
      { key: 'overtime_blocked_52h', label: '주 52시간 차단' },
      { key: 'leave_expiry_30d', label: '연차 소멸 30일 전' },
    ],
  },
  {
    label: '급여',
    events: [
      { key: 'payslip_issued', label: '급여명세서 발급' },
      { key: 'year_end_deadline', label: '연말정산 마감' },
    ],
  },
  {
    label: '교육 / 복리후생',
    events: [
      { key: 'mandatory_training_due', label: '법정교육 마감 30일 전' },
      { key: 'benefit_approved', label: '복리후생 승인' },
    ],
  },
  {
    label: '성과 / 분석',
    events: [
      { key: 'evaluation_deadline', label: '성과평가 마감' },
      { key: 'turnover_risk_critical', label: '이직위험 Critical' },
    ],
  },
]

const DEFAULT_PREF: EventPref = { in_app: true, email: false, teams: false }

export function NotificationPreferenceClient() {
  const [preferences, setPreferences] = useState<Preferences>({})
  const [quietStart, setQuietStart] = useState('22:00')
  const [quietEnd, setQuietEnd] = useState('08:00')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadPrefs = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/notifications/preferences')
      const data = await res.json()
      if (data.data) {
        setPreferences((data.data.preferences as Preferences) ?? {})
        setQuietStart(data.data.quietHoursStart ?? '22:00')
        setQuietEnd(data.data.quietHoursEnd ?? '08:00')
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPrefs()
  }, [loadPrefs])

  const getEventPref = (key: string): EventPref =>
    preferences[key] ?? DEFAULT_PREF

  const toggleChannel = (eventKey: string, channel: Channel) => {
    setPreferences((prev) => ({
      ...prev,
      [eventKey]: {
        ...getEventPref(eventKey),
        [channel]: !getEventPref(eventKey)[channel],
      },
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch('/api/v1/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferences,
          quietHoursStart: quietStart,
          quietHoursEnd: quietEnd,
        }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="h-64 bg-muted rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Bell className="w-5 h-5 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">{'알림 설정'}</h1>
      </div>

      {/* Channel toggles */}
      <div className="bg-white rounded-xl border border-border overflow-hidden mb-6">
        {/* Header row */}
        <div className="grid grid-cols-[1fr_80px_80px_80px] gap-4 px-5 py-3 bg-background border-b border-border">
          <span className="text-xs font-semibold text-[#999] uppercase tracking-wider">
            이벤트
          </span>
          <span className="text-xs font-semibold text-[#999] uppercase tracking-wider text-center">
            인앱
          </span>
          <span className="text-xs font-semibold text-[#999] uppercase tracking-wider text-center">
            이메일
          </span>
          <span className="text-xs font-semibold text-[#999] uppercase tracking-wider text-center">
            Teams
          </span>
        </div>

        {EVENT_GROUPS.map((group) => (
          <div key={group.label}>
            {/* Group header */}
            <div className="px-5 py-2 bg-muted border-b border-border">
              <span className="text-xs font-semibold text-[#666]">{group.label}</span>
            </div>

            {/* Event rows */}
            {group.events.map((ev) => {
              const pref = getEventPref(ev.key)
              return (
                <div
                  key={ev.key}
                  className="grid grid-cols-[1fr_80px_80px_80px] gap-4 px-5 py-3.5 border-b border-border last:border-0 items-center"
                >
                  <span className="text-sm text-[#333]">{ev.label}</span>
                  {(['in_app', 'email', 'teams'] as Channel[]).map((ch) => (
                    <div key={ch} className="flex justify-center">
                      <button
                        onClick={() => toggleChannel(ev.key, ch)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          pref[ch]
                            ? 'bg-primary border-primary'
                            : 'bg-white border-border hover:border-primary'
                        }`}
                        aria-label={`${ev.label} ${ch} 알림 ${pref[ch] ? '끄기' : '켜기'}`}
                      >
                        {pref[ch] && <Check className="w-3 h-3 text-white" />}
                      </button>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Quiet Hours */}
      <div className={`${CARD_STYLES.kpi} mb-6`}>
        <div className="flex items-center gap-2 mb-4">
          <Moon className="w-4 h-4 text-[#666]" />
          <h2 className="text-base font-semibold text-foreground">방해금지 시간</h2>
          <span className="text-xs text-[#999]">(urgent 알림 제외)</span>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="time"
            value={quietStart}
            onChange={(e) => setQuietStart(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 focus:outline-none"
          />
          <span className="text-sm text-[#666]">~</span>
          <input
            type="time"
            value={quietEnd}
            onChange={(e) => setQuietEnd(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 focus:outline-none"
          />
        </div>
        <p className="text-xs text-[#999] mt-2">
          설정된 시간 동안 긴급(urgent) 외 알림은 조용히 처리됩니다
        </p>
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className={`flex items-center gap-2 ${BUTTON_VARIANTS.primary} px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50`}
      >
        {saved ? (
          <>
            <Check className="w-4 h-4" />
            저장됨
          </>
        ) : (
          <>
            <Save className="w-4 h-4" />
            {saving ? '저장 중...' : '저장'}
          </>
        )}
      </button>
    </div>
  )
}
