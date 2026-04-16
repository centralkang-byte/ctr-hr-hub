'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Bell, Moon, Save, Check } from 'lucide-react'
import { CARD_STYLES, BUTTON_VARIANTS } from '@/lib/styles'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'

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
    labelKey: 'group.attendanceLeave',
    events: [
      { key: 'leave_approved', labelKey: 'event.leaveApproved' },
      { key: 'leave_rejected', labelKey: 'event.leaveRejected' },
      { key: 'overtime_warning_48h', labelKey: 'event.overtimeWarning48h' },
      { key: 'overtime_blocked_52h', labelKey: 'event.overtimeBlocked52h' },
      { key: 'leave_expiry_30d', labelKey: 'event.leaveExpiry30d' },
    ],
  },
  {
    labelKey: 'group.payroll',
    events: [
      { key: 'payslip_issued', labelKey: 'event.payslipIssued' },
      { key: 'year_end_deadline', labelKey: 'event.yearEndDeadline' },
    ],
  },
  {
    labelKey: 'group.trainingBenefits',
    events: [
      { key: 'mandatory_training_due', labelKey: 'event.mandatoryTrainingDue' },
      { key: 'benefit_approved', labelKey: 'event.benefitApproved' },
    ],
  },
  {
    labelKey: 'group.performanceAnalytics',
    events: [
      { key: 'evaluation_deadline', labelKey: 'event.evaluationDeadline' },
      { key: 'turnover_risk_critical', labelKey: 'event.turnoverRiskCritical' },
    ],
  },
]

const DEFAULT_PREF: EventPref = { in_app: true, email: false, teams: false }

export function NotificationPreferenceClient() {
  const t = useTranslations('notificationPrefs')
  const [preferences, setPreferences] = useState<Preferences>({})
  const [quietStart, setQuietStart] = useState('22:00')
  const [quietEnd, setQuietEnd] = useState('08:00')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadPrefs = useCallback(async () => {
    try {
      const res = await apiClient.get<{ preferences: Preferences; quietHoursStart: string; quietHoursEnd: string }>('/api/v1/notifications/preferences')
      if (res.data) {
        setPreferences(res.data.preferences ?? {})
        setQuietStart(res.data.quietHoursStart ?? '22:00')
        setQuietEnd(res.data.quietHoursEnd ?? '08:00')
      }
    } catch (err) {
      toast({ title: t('fetchError'), description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [t])

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
      await apiClient.put('/api/v1/notifications/preferences', {
        preferences,
        quietHoursStart: quietStart,
        quietHoursEnd: quietEnd,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      toast({ title: t('saveError'), description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
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
        <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
      </div>

      {/* Channel toggles */}
      <div className="bg-card rounded-xl border border-border overflow-hidden mb-6">
        {/* Header row */}
        <div className="grid grid-cols-[1fr_80px_80px_80px] gap-4 px-5 py-3 bg-background border-b border-border">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {t('channel.event')}
          </span>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">
            {t('channel.inApp')}
          </span>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">
            {t('channel.email')}
          </span>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">
            {t('channel.teams')}
          </span>
        </div>

        {EVENT_GROUPS.map((group) => (
          <div key={group.labelKey}>
            {/* Group header */}
            <div className="px-5 py-2 bg-muted border-b border-border">
              <span className="text-xs font-semibold text-muted-foreground">{t(group.labelKey)}</span>
            </div>

            {/* Event rows */}
            {group.events.map((ev) => {
              const pref = getEventPref(ev.key)
              return (
                <div
                  key={ev.key}
                  className="grid grid-cols-[1fr_80px_80px_80px] gap-4 px-5 py-3.5 border-b border-border last:border-0 items-center"
                >
                  <span className="text-sm text-foreground">{t(ev.labelKey)}</span>
                  {(['in_app', 'email', 'teams'] as Channel[]).map((ch) => (
                    <div key={ch} className="flex justify-center">
                      <button
                        onClick={() => toggleChannel(ev.key, ch)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          pref[ch]
                            ? 'bg-primary border-primary'
                            : 'bg-card border-border hover:border-primary'
                        }`}
                        aria-label={`${t(ev.labelKey)} ${ch} ${pref[ch] ? t('toggleOff') : t('toggleOn')}`}
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
          <Moon className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">{t('quietHours.title')}</h2>
          <span className="text-xs text-muted-foreground">({t('quietHours.excludeUrgent')})</span>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="time"
            value={quietStart}
            onChange={(e) => setQuietStart(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 focus:outline-none"
          />
          <span className="text-sm text-muted-foreground">~</span>
          <input
            type="time"
            value={quietEnd}
            onChange={(e) => setQuietEnd(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 focus:outline-none"
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {t('quietHours.description')}
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
            {t('saved')}
          </>
        ) : (
          <>
            <Save className="w-4 h-4" />
            {saving ? t('saving') : t('save')}
          </>
        )}
      </button>
    </div>
  )
}
