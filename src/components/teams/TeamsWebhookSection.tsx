'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Trash2, TestTube, Webhook, Check, X } from 'lucide-react'
import { BUTTON_VARIANTS } from '@/lib/styles'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'

const EVENT_TYPE_KEYS = [
  { key: 'overtime_blocked_52h', i18n: 'overtime52h' },
  { key: 'overtime_warning_48h', i18n: 'overtime48h' },
  { key: 'turnover_risk_critical', i18n: 'turnoverRisk' },
  { key: 'offer_accepted', i18n: 'offerAccepted' },
  { key: 'restructure_applied', i18n: 'restructure' },
  { key: 'leave_approved', i18n: 'leaveApproved' },
  { key: 'payslip_issued', i18n: 'payslipIssued' },
  { key: 'benefit_approved', i18n: 'benefitApproved' },
  { key: 'evaluation_deadline', i18n: 'evalDeadline' },
] as const

interface WebhookConfig {
  id: string
  channelName: string
  webhookUrl: string
  eventTypes: string[]
  isActive: boolean
}

export function TeamsWebhookSection() {
  const t = useTranslations('teams')
  const ALL_EVENT_TYPES = EVENT_TYPE_KEYS.map((e) => ({
    key: e.key,
    label: t(`ui.webhook.events.${e.i18n}`),
  }))
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([])
  const [adding, setAdding] = useState(false)
  const [newChannel, setNewChannel] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [newEvents, setNewEvents] = useState<string[]>([])
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<Record<string, boolean>>({})

  const { confirm, dialogProps } = useConfirmDialog()

  const loadWebhooks = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/settings/teams-webhooks')
      const data = await res.json()
      if (Array.isArray(data.data)) setWebhooks(data.data)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    loadWebhooks()
  }, [loadWebhooks])

  const handleAdd = async () => {
    if (!newChannel.trim() || !newUrl.trim()) return
    try {
      const res = await fetch('/api/v1/settings/teams-webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelName: newChannel,
          webhookUrl: newUrl,
          eventTypes: newEvents,
        }),
      })
      if (res.ok) {
        setAdding(false)
        setNewChannel('')
        setNewUrl('')
        setNewEvents([])
        loadWebhooks()
      }
    } catch {
      // ignore
    }
  }

  const handleDelete = async (id: string) => {
    confirm({ variant: 'destructive', title: t('ui.webhook.deleteConfirm'), onConfirm: async () => {
      try {
        await fetch(`/api/v1/settings/teams-webhooks/${id}`, { method: 'DELETE' })
        loadWebhooks()
      } catch {
        // ignore
      }
    }})
  }

  const handleTest = async (id: string, url: string) => {
    setTestingId(id)
    try {
      // Use raw URL for testing (not masked)
      const res = await fetch('/api/v1/settings/teams-webhooks/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: url }),
      })
      const data = await res.json()
      const success = data.data?.success ?? false
      setTestResult((prev) => ({ ...prev, [id]: success }))
      setTimeout(() => {
        setTestResult((prev) => {
          const n = { ...prev }
          delete n[id]
          return n
        })
      }, 3000)
    } catch {
      setTestResult((prev) => ({ ...prev, [id]: false }))
    } finally {
      setTestingId(null)
    }
  }

  const toggleEventType = (key: string) => {
    setNewEvents((prev) =>
      prev.includes(key) ? prev.filter((e) => e !== key) : [...prev, key],
    )
  }

  return (
    <>
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Webhook className="w-4 h-4 text-primary" />
          <h3 className="text-base font-semibold text-foreground">
            {t('ui.webhook.sectionTitle')}
          </h3>
        </div>
        <button
          onClick={() => setAdding(true)}
          className={`flex items-center gap-1.5 text-sm ${BUTTON_VARIANTS.primary} px-3 py-1.5 rounded-lg font-medium transition-colors`}
        >
          <Plus className="w-3.5 h-3.5" />
          {t('ui.webhook.addChannel')}
        </button>
      </div>

      {/* Existing webhooks */}
      {webhooks.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground py-4 text-center">
          {t('ui.webhook.noWebhooks')}
        </p>
      )}

      {webhooks.map((wh) => (
        <div key={wh.id} className="bg-card rounded-xl shadow-sm border border-border p-6">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{wh.channelName}</p>
              <p className="text-xs text-muted-foreground mt-0.5 font-mono tabular-nums break-all">{wh.webhookUrl}</p>
            </div>
            <div className="flex items-center gap-2 ml-4 flex-shrink-0">
              <button
                onClick={() => handleTest(wh.id, wh.webhookUrl)}
                disabled={testingId === wh.id}
                className="flex items-center gap-1 text-xs border border-border hover:bg-muted px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {testResult[wh.id] !== undefined ? (
                  testResult[wh.id] ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      {t('ui.webhook.testSuccess')}
                    </>
                  ) : (
                    <>
                      <X className="w-3 h-3 text-red-500" />
                      {t('ui.webhook.testFail')}
                    </>
                  )
                ) : (
                  <>
                    <TestTube className="w-3 h-3" />
                    {t('ui.webhook.test')}
                  </>
                )}
              </button>
              <button
                onClick={() => handleDelete(wh.id)}
                className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-destructive/10 rounded-lg transition-colors"
                aria-label={t('ui.webhook.deleteAriaLabel')}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Event type badges */}
          <div className="flex flex-wrap gap-1.5">
            {wh.eventTypes.length === 0 ? (
              <span className="text-xs text-muted-foreground">{t('ui.webhook.noEvents')}</span>
            ) : (
              wh.eventTypes.map((et) => {
                const ev = ALL_EVENT_TYPES.find((e) => e.key === et)
                return (
                  <span
                    key={et}
                    className="text-xs px-2 py-0.5 bg-primary/10 text-primary/90 rounded-full border border-primary/20"
                  >
                    {ev?.label ?? et}
                  </span>
                )
              })
            )}
          </div>
        </div>
      ))}

      {/* Add new webhook form */}
      {adding && (
        <div className="bg-card rounded-xl border border-primary/30 p-4 space-y-3">
          <input
            type="text"
            placeholder={t('ui.webhook.channelNamePlaceholder')}
            value={newChannel}
            onChange={(e) => setNewChannel(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 focus:outline-none"
          />
          <input
            type="url"
            placeholder="Webhook URL (https://outlook.office.com/...)"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm font-mono tabular-nums focus:border-primary focus:ring-2 focus:ring-primary/10 focus:outline-none"
          />
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">{t('ui.webhook.eventsToSend')}</p>
            <div className="flex flex-wrap gap-2">
              {ALL_EVENT_TYPES.map((ev) => (
                <button
                  key={ev.key}
                  onClick={() => toggleEventType(ev.key)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    newEvents.includes(ev.key)
                      ? 'bg-primary text-white border-primary'
                      : 'bg-card text-muted-foreground border-border hover:border-primary'
                  }`}
                >
                  {ev.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={!newChannel.trim() || !newUrl.trim()}
              className={`${BUTTON_VARIANTS.primary} px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50`}
            >
              {t('ui.settings.save')}
            </button>
            <button
              onClick={() => {
                setAdding(false)
                setNewChannel('')
                setNewUrl('')
                setNewEvents([])
              }}
              className="bg-card border border-border hover:bg-muted text-foreground px-4 py-2 rounded-lg text-sm transition-colors"
            >
              {t('ui.webhook.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
      <ConfirmDialog {...dialogProps} />
    </>
  )
}
