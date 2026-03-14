'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { MessageSquare, ArrowLeft, Plus, Trash2, Sparkles, Calendar, CheckCircle2, Save } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { BUTTON_VARIANTS } from '@/lib/styles'


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

export default function OneOnOneDetailClient() {
  const tCommon = useTranslations('common')
  const t = useTranslations('performance')

  const { id } = useParams<{ id: string }>()
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
    } catch { /* ignore */ }
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
    } catch { /* ignore */ }
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
    } catch { /* ignore */ }
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
    return <div className="p-6 text-center text-[#999]">{tCommon('loading')}</div>
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/performance/one-on-one')} className="p-1 hover:bg-[#F5F5F5] rounded-lg">
          <ArrowLeft className="w-5 h-5 text-[#666]" />
        </button>
        <MessageSquare className="w-6 h-6 text-[#5E81F4]" />
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">
            1:1 기록 — {meeting.employee.name}
          </h1>
          <p className="text-sm text-[#666]">
            {new Date(meeting.scheduledAt).toLocaleDateString('ko-KR')} · {MEETING_TYPE_LABELS[meeting.meetingType] ?? meeting.meetingType}
            {meeting.employee.department && ` · ${meeting.employee.department.name}`}
          </p>
        </div>
      </div>

      {/* Previous Action Items */}
      {prevActions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-[#1A1A1A] mb-3">이전 액션 아이템 추적</h2>
          <div className="space-y-2">
            {prevActions.map((a, i) => (
              <div key={i} className="flex items-center gap-3">
                <button
                  onClick={() => togglePrevAction(i)}
                  className={`w-5 h-5 rounded border flex items-center justify-center ${
                    a.completed
                      ? 'bg-[#5E81F4] border-[#5E81F4] text-white'
                      : 'border-[#D4D4D4]'
                  }`}
                >
                  {a.completed && <CheckCircle2 className="w-3 h-3" />}
                </button>
                <span className={`text-sm ${a.completed ? 'line-through text-[#999]' : 'text-[#1A1A1A]'}`}>
                  {a.item}
                </span>
                {a.dueDate && (
                  <span className="text-xs text-[#999] ml-auto">(기한: {a.dueDate})</span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  a.completed
                    ? 'bg-[#D1FAE5] text-[#047857]'
                    : 'bg-[#FEF3C7] text-[#B45309]'
                }`}>
                  {a.completed ? '완료' : '진행중'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-base font-semibold text-[#1A1A1A] mb-3">논의 내용 요약</h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="미팅 내용을 기록하세요..."
          rows={8}
          className="w-full px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#5E81F4]/10 placeholder:text-[#999]"
        />
      </div>

      {/* 미팅 분위기 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-base font-semibold text-[#1A1A1A] mb-3">미팅 분위기</h2>
        <div className="flex gap-2">
          {[
            { value: 'positive', label: '긍정적', emoji: '😊' },
            { value: 'neutral', label: '보통', emoji: '😐' },
            { value: 'negative', label: '부정적', emoji: '😞' },
            { value: 'concerned', label: '우려됨', emoji: '😟' },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSentimentTag(sentimentTag === opt.value ? null : opt.value)}
              className={`flex flex-col items-center px-3 py-2 rounded-lg border text-xs transition-colors ${
                sentimentTag === opt.value
                  ? 'border-[#5E81F4] bg-[#EDF1FE] text-[#4B6DE0]'
                  : 'border-[#E8E8E8] hover:border-[#D4D4D4] text-[#666]'
              }`}
            >
              <span className="text-base mb-0.5">{opt.emoji}</span>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* New Action Items */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-[#1A1A1A]">새 액션 아이템</h2>
          <button
            onClick={addActionItem}
            className="flex items-center gap-1 text-sm text-[#5E81F4] hover:text-[#4B6DE0] font-medium"
          >
            <Plus className="w-4 h-4" /> 항목 추가
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
                className="flex-1 px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#5E81F4]/10 placeholder:text-[#999]"
              />
              <select
                value={a.assignee}
                onChange={(e) => updateActionItem(i, 'assignee', e.target.value)}
                className="px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm"
              >
                <option value="EMPLOYEE">팀원</option>
                <option value="MANAGER">매니저</option>
              </select>
              <input
                type="date"
                value={a.dueDate ?? ''}
                onChange={(e) => updateActionItem(i, 'dueDate', e.target.value)}
                className="px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm"
              />
              <button
                onClick={() => removeActionItem(i)}
                className="p-2 text-[#999] hover:text-[#EF4444] rounded-lg hover:bg-[#FEE2E2]"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {actionItems.length === 0 && (
            <EmptyState title="데이터가 없습니다" description="조건을 변경하거나 새로운 데이터를 추가해보세요." />
          )}
        </div>
      </div>

      {/* AI Summary + Coaching Tip */}
      {meeting.aiSummary && (
        <div className="bg-[#E0E7FF] rounded-xl border border-[#C7D2FE] p-5">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-[#4B6DE0]" />
            <span className="text-sm font-medium text-[#4B6DE0]">AI 코칭 팁</span>
          </div>
          <p className="text-sm text-[#333]">{meeting.aiSummary}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleAiNotes}
          disabled={aiLoading}
          className="flex items-center gap-2 px-4 py-2 border border-[#C7D2FE] text-[#4B6DE0] rounded-lg text-sm font-medium hover:bg-[#E0E7FF] disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4" />
          {aiLoading ? 'AI 생성 중...' : 'AI 요약 생성'}
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/performance/one-on-one')}
            className="flex items-center gap-2 px-4 py-2 border border-[#D4D4D4] rounded-lg text-sm text-[#333] hover:bg-[#FAFAFA]"
          >
            <Calendar className="w-4 h-4" /> 다음 1:1 예약
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 border border-[#D4D4D4] rounded-lg text-sm text-[#333] hover:bg-[#FAFAFA] disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> 임시저장
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving}
            className={`flex items-center gap-2 px-4 py-2 ${BUTTON_VARIANTS.primary} rounded-lg text-sm font-medium disabled:opacity-50`}
          >
            <CheckCircle2 className="w-4 h-4" /> 완료
          </button>
        </div>
      </div>
    </div>
  )
}
