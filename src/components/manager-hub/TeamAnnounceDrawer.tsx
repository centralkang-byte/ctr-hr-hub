'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 팀 공지 드로어 (매니저 허브 헤더 액션)
// POST /api/v1/manager-hub/announce — 직속부하 전체에 알림 발송.
// WdDrawer primary=onClick 라 JS 가드로 빈 입력 차단 (검증 회귀 방지).
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { Mail } from 'lucide-react'
import { WdDrawer, WdField } from '@/components/shared/WdDrawer'
import { apiClient } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'

// ─── Types ──────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  teamCount: number
  onSent?: () => void
}

// ─── Constants ──────────────────────────────────────────────

const FIELD_CLS =
  'h-9 w-full rounded-lg border border-border-strong bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const TEXTAREA_CLS =
  'w-full rounded-lg border border-border-strong bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

// ─── Component ──────────────────────────────────────────────

export function TeamAnnounceDrawer({ open, onClose, teamCount, onSent }: Props) {
  const { toast } = useToast()
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setTitle('')
      setMessage('')
    }
  }, [open])

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({ title: '제목을 입력하세요.', variant: 'destructive' })
      return
    }
    if (!message.trim()) {
      toast({ title: '내용을 입력하세요.', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      const res = await apiClient.post<{ sent: number }>('/api/v1/manager-hub/announce', {
        title: title.trim(),
        body: message.trim(),
      })
      toast({ title: `팀 공지를 ${res.data?.sent ?? teamCount}명에게 발송했습니다.` })
      onClose()
      onSent?.()
    } catch (err) {
      toast({
        title: '발송 실패',
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
      title="팀 공지"
      closeDisabled={saving}
      footLeft={
        <span className="text-[12px] text-muted-foreground">
          직속 팀원 {teamCount}명에게 발송
        </span>
      }
      secondary={{ label: '취소', onClick: onClose, disabled: saving }}
      primary={{
        label: saving ? '발송 중…' : '발송',
        onClick: handleSubmit,
        disabled: saving,
        icon: <Mail className="h-4 w-4" />,
      }}
    >
      <WdField label="제목" required htmlFor="ann-title">
        <input
          id="ann-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="예: 이번 주 팀 회의 안내"
          className={FIELD_CLS}
        />
      </WdField>

      <WdField label="내용" required htmlFor="ann-body">
        <textarea
          id="ann-body"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          maxLength={2000}
          placeholder="팀원 전체에게 전달할 내용을 입력하세요."
          className={TEXTAREA_CLS}
        />
      </WdField>
    </WdDrawer>
  )
}
