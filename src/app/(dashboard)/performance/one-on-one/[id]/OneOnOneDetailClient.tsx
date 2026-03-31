'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquare, ArrowLeft, Plus, Trash2, Sparkles, Calendar, CheckCircle2, Save } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { BUTTON_VARIANTS } from '@/lib/styles'
import type { SessionUser } from '@/types'


// ─── Types ───────────────────────────────────────────────

interface ActionItem {
  item: string
  assignee: 'MANAGER' | 'EMPLOYEE'
  dueDate?: string
  completed: boolean
}

interface MeetingDetail {
  id: string
  employeeId: string
  managerId: string
  scheduledAt: string
  completedAt: string | null
  status: string
  meetingType: string
  agenda: string | null
  notes: string | null
  aiSummary: string | null
  sentimentTag: string | null
  actionItems: ActionItem[] | null
  employee: { id: string; name: string; employeeNo: string; department?: { name: string }; jobGrade?: { name: string } }
  manager: { id: string; name: string }
  previousMeetings: { actionItems: ActionItem[] | null; completedAt: string | null }[]
}

interface AiNotesResult {
  structured_notes: string
  follow_up_items: string[]
  coaching_tip: string
}

const MEETING_TYPE_LABELS: Record<string, string> = {
  REGULAR: '정기',
  AD_HOC: '수시',
  GOAL_REVIEW: '목표 점검',
  DEVELOPMENT: '역량 개발',
}

// ─── Component ───────────────────────────────────────────

export default function OneOnOneDetailClient({ user, id }: { user: SessionUser; id: string }) {
  const tCommon = useTranslations('common')
  const t = useTranslations('performance')
  const router = useRouter()

  const [meeting, setMeeting] = useState<MeetingDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)

  // Editable fields
  const [notes, setNotes] = useState('')
  const [sentimentTag, setSentimentTag] = useState<string | null>(null)
  const [actionItems, setActionItems] = useState<ActionItem[]>([])
  const [prevActions, setPrevActions] = useState<ActionItem[]>([])

  const fetchMeeting = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<MeetingDetail>(`/api/v1/cfr/one-on-ones/${id}`)
      setMeeting(res.data)
      setNotes(res.data.notes ?? '')
      setSentimentTag(res.data.sentimentTag ?? null)
      setActionItems(res.data.actionItems ?? [])

      // Collect previous action items
      const prev: ActionItem[] = []
      for (const pm of res.data.previousMeetings) {
        if (pm.actionItems) prev.push(...pm.actionItems)
      }
      setPrevActions(prev)
    } catch (err) { toast({ title: '미팅 정보 로드 실패', description: err instanceof Error ? err.message : '다시 시도해 주세요.', variant: 'destructive' }) }
    setLoading(false)
  }, [id])

  useEffect(() => { fetchMeeting() }, [fetchMeeting])

  const handleSave = async (complete = false) => {
    setSaving(true)
    try {
      await apiClient.put(`/api/v1/cfr/one-on-ones/${id}`, {
        notes,
        sentimentTag,
        actionItems,
        ...(complete ? { status: 'COMPLETED' } : {}),
      })
      if (complete) {
        router.push('/performance/one-on-one')
      } else {
        fetchMeeting()
      }
    } catch (err) { toast({ title: '미팅 저장 실패', description: err instanceof Error ? err.message : '다시 시도해 주세요.', variant: 'destructive' }) }
    setSaving(false)
  }

  const handleAiNotes = async () => {
    setAiLoading(true)
    try {
      const res = await apiClient.post<AiNotesResult>('/api/v1/ai/one-on-one-notes', {
        meetingId: id,
        currentNotes: notes,
      })
      if (res.data.structured_notes) {
        setNotes(res.data.structured_notes)
      }
      if (res.data.follow_up_items.length > 0) {
        const newItems: ActionItem[] = res.data.follow_up_items.map((text: string) => ({
          item: text,
          assignee: 'EMPLOYEE' as const,
          completed: false,
        }))
        setActionItems([...actionItems, ...newItems])
      }
      // Save AI summary
      await apiClient.put(`/api/v1/cfr/one-on-ones/${id}`, {
        aiSummary: res.data.coaching_tip,
      })
    } catch (err) { toast({ title: 'AI 분석 실패', description: err instanceof Error ? err.message : '다시 시도해 주세요.', variant: 'destructive' }) }
    setAiLoading(false)
  }

  const addActionItem = () => {
    setActionItems([...actionItems, { item: '', assignee: 'EMPLOYEE', completed: false }])
  }

  const removeActionItem = (index: number) => {
    setActionItems(actionItems.filter((_, i) => i !== index))
  }

  const updateActionItem = (index: number, field: keyof ActionItem, value: string | boolean) => {
    const updated = [...actionItems]
    updated[index] = { ...updated[index], [field]: value }
    setActionItems(updated)
  }

  const togglePrevAction = (index: number) => {
    const updated = [...prevActions]
    updated[index] = { ...updated[index], completed: !updated[index].completed }
    setPrevActions(updated)
  }

  if (loading || !meeting) {
    return <div className="p-6 text-center text-muted-foreground">{tCommon('loading')}</div>
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/performance/one-on-one')} className="p-1 hover:bg-muted rounded-lg">
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <MessageSquare className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            1:1 기록 — {meeting.employee.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {new Date(meeting.scheduledAt).toLocaleDateString('ko-KR')} · {MEETING_TYPE_LABELS[meeting.meetingType] ?? meeting.meetingType}
            {meeting.employee.department && ` · ${meeting.employee.department.name}`}
          </p>
        </div>
      </div>

      {/* Previous Action Items */}
      {prevActions.length > 0 && (
        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <h2 className="text-base font-semibold text-foreground mb-3">{t('prev_kec95a1ec_kec9584ec_kecb694ec')}</h2>
          <div className="space-y-2">
            {prevActions.map((a, i) => (
              <div key={i} className="flex items-center gap-3">
                <button
                  onClick={() => togglePrevAction(i)}
                  className={`w-5 h-5 rounded border flex items-center justify-center ${
                    a.completed
                      ? 'bg-primary border-primary text-white'
                      : 'border-border'
                  }`}
                >
                  {a.completed && <CheckCircle2 className="w-3 h-3" />}
                </button>
                <span className={`text-sm ${a.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                  {a.item}
                </span>
                {a.dueDate && (
                  <span className="text-xs text-muted-foreground ml-auto">(기한: {a.dueDate})</span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  a.completed
                    ? 'bg-emerald-500/15 text-emerald-700'
                    : 'bg-amber-500/15 text-amber-700'
                }`}>
                  {a.completed ? '완료' : t('inProgress')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="bg-card rounded-xl shadow-sm border border-border p-6">
        <h2 className="text-base font-semibold text-foreground mb-3">{t('kr_keb85bcec_keb82b4ec_summary')}</h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="미팅 내용을 기록하세요..."
          rows={8}
          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10 placeholder:text-muted-foreground"
        />
      </div>

      {/* 미팅 분위기 */}
      <div className="bg-card rounded-xl shadow-sm border border-border p-6">
        <h2 className="text-base font-semibold text-foreground mb-3">{t('kr_kebafb8ed_kebb684ec')}</h2>
        <div className="flex gap-2">
          {[
            { value: 'positive', label: t('kr_keab88dec'), emoji: '😊' },
            { value: 'neutral', label: t('average'), emoji: '😐' },
            { value: 'negative', label: t('kr_kebb680ec'), emoji: '😞' },
            { value: 'concerned', label: t('kr_kec9ab0eb'), emoji: '😟' },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSentimentTag(sentimentTag === opt.value ? null : opt.value)}
              className={`flex flex-col items-center px-3 py-2 rounded-lg border text-xs transition-colors ${
                sentimentTag === opt.value
                  ? 'border-primary bg-primary/10 text-primary/90'
                  : 'border-border hover:border-border text-muted-foreground'
              }`}
            >
              <span className="text-base mb-0.5">{opt.emoji}</span>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* New Action Items */}
      <div className="bg-card rounded-xl shadow-sm border border-border p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-foreground">{t('kr_kec8388_kec95a1ec_kec9584ec')}</h2>
          <button
            onClick={addActionItem}
            className="flex items-center gap-1 text-sm text-primary hover:text-primary/90 font-medium"
          >
            <Plus className="w-4 h-4" /> {t('kr_ked95adeb_add')}
          </button>
        </div>
        <div className="space-y-3">
          {actionItems.map((a, i) => (
            <div key={i} className="flex items-center gap-3">
              <input
                type="text"
                value={a.item}
                onChange={(e) => updateActionItem(i, 'item', e.target.value)}
                placeholder="액션 아이템 입력"
                className="flex-1 px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10 placeholder:text-muted-foreground"
              />
              <select
                value={a.assignee}
                onChange={(e) => updateActionItem(i, 'assignee', e.target.value)}
                className="px-3 py-2 border border-border rounded-lg text-sm"
              >
                <option value="EMPLOYEE">{t('kr_ked8c80ec')}</option>
                <option value="MANAGER">{t('kr_keba7a4eb')}</option>
              </select>
              <input
                type="date"
                value={a.dueDate ?? ''}
                onChange={(e) => updateActionItem(i, 'dueDate', e.target.value)}
                className="px-3 py-2 border border-border rounded-lg text-sm"
              />
              <button
                onClick={() => removeActionItem(i)}
                className="p-2 text-muted-foreground hover:text-red-500 rounded-lg hover:bg-destructive/10"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {actionItems.length === 0 && (
            <EmptyState />
          )}
        </div>
      </div>

      {/* AI Summary + Coaching Tip */}
      {meeting.aiSummary && (
        <div className="bg-indigo-500/15 rounded-xl border border-indigo-200 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-primary/90" />
            <span className="text-sm font-medium text-primary/90">{t('kr_ai_kecbd94ec_ked8c81')}</span>
          </div>
          <p className="text-sm text-foreground">{meeting.aiSummary}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleAiNotes}
          disabled={aiLoading}
          className="flex items-center gap-2 px-4 py-2 border border-indigo-200 text-primary/90 rounded-lg text-sm font-medium hover:bg-indigo-500/15 disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4" />
          {aiLoading ? t('aiGenerating') : 'AI 요약 생성'}
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/performance/one-on-one')}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-background"
          >
            <Calendar className="w-4 h-4" /> {t('next_1_1_kec9888ec')}
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-background disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {t('kr_kec9e84ec')}
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving}
            className={`flex items-center gap-2 px-4 py-2 ${BUTTON_VARIANTS.primary} rounded-lg text-sm font-medium disabled:opacity-50`}
          >
            <CheckCircle2 className="w-4 h-4" /> {t('complete')}
          </button>
        </div>
      </div>
    </div>
  )
}
