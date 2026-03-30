'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, TestTube, Webhook, Check, X } from 'lucide-react'
import { BUTTON_VARIANTS } from '@/lib/styles'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'

const ALL_EVENT_TYPES = [
  { key: 'overtime_blocked_52h', label: '52시간 차단' },
  { key: 'overtime_warning_48h', label: '48시간 경고' },
  { key: 'turnover_risk_critical', label: '이직위험 Critical' },
  { key: 'offer_accepted', label: '입사 수락' },
  { key: 'restructure_applied', label: '조직 개편 적용' },
  { key: 'leave_approved', label: '휴가 승인' },
  { key: 'payslip_issued', label: '급여명세서 발급' },
  { key: 'benefit_approved', label: '복리후생 승인' },
  { key: 'evaluation_deadline', label: '성과평가 마감' },
]

interface WebhookConfig {
  id: string
  channelName: string
  webhookUrl: string
  eventTypes: string[]
  isActive: boolean
}

export function TeamsWebhookSection() {
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
    confirm({ variant: 'destructive', title: '이 Webhook 설정을 삭제할까요?', onConfirm: async () => {
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
            Microsoft Teams Webhook 채널
          </h3>
        </div>
        <button
          onClick={() => setAdding(true)}
          className={`flex items-center gap-1.5 text-sm ${BUTTON_VARIANTS.primary} px-3 py-1.5 rounded-lg font-medium transition-colors`}
        >
          <Plus className="w-3.5 h-3.5" />
          채널 추가
        </button>
      </div>

      {/* Existing webhooks */}
      {webhooks.length === 0 && !adding && (
        <p className="text-sm text-[#999] py-4 text-center">
          등록된 Webhook 채널이 없습니다
        </p>
      )}

      {webhooks.map((wh) => (
        <div key={wh.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{wh.channelName}</p>
              <p className="text-xs text-[#999] mt-0.5 font-mono tabular-nums break-all">{wh.webhookUrl}</p>
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
                      성공
                    </>
                  ) : (
                    <>
                      <X className="w-3 h-3 text-red-500" />
                      실패
                    </>
                  )
                ) : (
                  <>
                    <TestTube className="w-3 h-3" />
                    테스트
                  </>
                )}
              </button>
              <button
                onClick={() => handleDelete(wh.id)}
                className="p-1.5 text-[#999] hover:text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                aria-label="Webhook 삭제"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Event type badges */}
          <div className="flex flex-wrap gap-1.5">
            {wh.eventTypes.length === 0 ? (
              <span className="text-xs text-[#999]">선택된 이벤트 없음</span>
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
        <div className="bg-white rounded-xl border border-primary/30 p-4 space-y-3">
          <input
            type="text"
            placeholder={'채널명 (예: HR-알림)'}
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
            <p className="text-xs font-medium text-[#666] mb-2">전송할 이벤트</p>
            <div className="flex flex-wrap gap-2">
              {ALL_EVENT_TYPES.map((ev) => (
                <button
                  key={ev.key}
                  onClick={() => toggleEventType(ev.key)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    newEvents.includes(ev.key)
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-[#666] border-border hover:border-primary'
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
              저장
            </button>
            <button
              onClick={() => {
                setAdding(false)
                setNewChannel('')
                setNewUrl('')
                setNewEvents([])
              }}
              className="bg-white border border-border hover:bg-muted text-[#333] px-4 py-2 rounded-lg text-sm transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
      <ConfirmDialog {...dialogProps} />
    </>
  )
}
