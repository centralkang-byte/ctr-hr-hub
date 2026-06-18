'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 1:1 미팅 예약 드로어 (매니저 허브 헤더/팀원 액션)
// POST /api/v1/cfr/one-on-ones — WdDrawer 표준. native 검증 대신 JS 가드
// (WdDrawer primary=onClick 라 <form> submit 미발화 — 검증 회귀 방지).
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { Calendar } from 'lucide-react'
import { WdDrawer, WdField } from '@/components/shared/WdDrawer'
import { apiClient } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'

// ─── Types ──────────────────────────────────────────────────

interface MemberOption {
  id: string
  name: string
}

interface Props {
  open: boolean
  onClose: () => void
  members: MemberOption[]
  defaultEmployeeId?: string
  onScheduled?: () => void
}

// ─── Constants ──────────────────────────────────────────────

const FIELD_CLS =
  'h-9 w-full rounded-lg border border-border-strong bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const TEXTAREA_CLS =
  'w-full rounded-lg border border-border-strong bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

const MEETING_TYPES = [
  { value: 'REGULAR', label: '정기' },
  { value: 'AD_HOC', label: '수시' },
  { value: 'GOAL_REVIEW', label: '목표 점검' },
  { value: 'DEVELOPMENT', label: '성장/커리어' },
]

// ─── Component ──────────────────────────────────────────────

export function OneOnOneScheduleDrawer({
  open,
  onClose,
  members,
  defaultEmployeeId,
  onScheduled,
}: Props) {
  const { toast } = useToast()
  const [employeeId, setEmployeeId] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [meetingType, setMeetingType] = useState('REGULAR')
  const [agenda, setAgenda] = useState('')
  const [saving, setSaving] = useState(false)

  // 열릴 때마다 초기화 + 호출자 prefill 반영
  useEffect(() => {
    if (open) {
      setEmployeeId(defaultEmployeeId ?? '')
      setScheduledAt('')
      setMeetingType('REGULAR')
      setAgenda('')
    }
  }, [open, defaultEmployeeId])

  const handleSubmit = async () => {
    // JS 가드 (native 검증 미발화)
    if (!employeeId) {
      toast({ title: '팀원을 선택하세요.', variant: 'destructive' })
      return
    }
    if (!scheduledAt) {
      toast({ title: '일시를 입력하세요.', variant: 'destructive' })
      return
    }
    const when = new Date(scheduledAt)
    if (Number.isNaN(when.getTime())) {
      toast({ title: '올바른 일시를 입력하세요.', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      await apiClient.post('/api/v1/cfr/one-on-ones', {
        employeeId,
        scheduledAt: when.toISOString(),
        meetingType,
        agenda: agenda.trim() || undefined,
      })
      toast({ title: '1:1 미팅이 예약되었습니다.' })
      onClose()
      onScheduled?.()
    } catch (err) {
      toast({
        title: '예약 실패',
        description: err instanceof Error ? err.message : '다시 시도해 주세요.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <WdDrawer
      open={open}
      onClose={onClose}
      eyebrow="매니저 액션"
      title="1:1 미팅 예약"
      closeDisabled={saving}
      secondary={{ label: '취소', onClick: onClose, disabled: saving }}
      primary={{
        label: saving ? '예약 중…' : '예약',
        onClick: handleSubmit,
        disabled: saving,
        icon: <Calendar className="h-4 w-4" />,
      }}
    >
      <WdField label="팀원" required htmlFor="oo-emp">
        <select
          id="oo-emp"
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          className={FIELD_CLS}
        >
          <option value="">선택하세요</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </WdField>

      <WdField label="일시" required htmlFor="oo-at">
        <input
          id="oo-at"
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          className={FIELD_CLS}
        />
      </WdField>

      <WdField label="유형" htmlFor="oo-type">
        <select
          id="oo-type"
          value={meetingType}
          onChange={(e) => setMeetingType(e.target.value)}
          className={FIELD_CLS}
        >
          {MEETING_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </WdField>

      <WdField label="안건" htmlFor="oo-agenda" hint="선택">
        <textarea
          id="oo-agenda"
          value={agenda}
          onChange={(e) => setAgenda(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="미팅에서 다룰 안건"
          className={TEXTAREA_CLS}
        />
      </WdField>
    </WdDrawer>
  )
}
