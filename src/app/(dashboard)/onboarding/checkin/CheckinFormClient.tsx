'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Onboarding Check-in Form Client
// 주간 체크인 제출: Mood, Energy, Belonging, Comment
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/PageHeader'
import { apiClient } from '@/lib/api'
import type { SessionUser, OnboardingCheckin } from '@/types'

// ─── Types ──────────────────────────────────────────────────

interface CheckinFormClientProps {
  user: SessionUser
}

interface MoodOption {
  value: string
  emoji: string
  label: string
}

// ─── Constants ──────────────────────────────────────────────

const MOODS: MoodOption[] = [
  { value: 'GREAT', emoji: '\u{1F603}', label: '최고예요' },
  { value: 'GOOD', emoji: '\u{1F642}', label: '좋아요' },
  { value: 'NEUTRAL', emoji: '\u{1F610}', label: '보통이에요' },
  { value: 'STRUGGLING', emoji: '\u{1F61F}', label: '힘들어요' },
  { value: 'BAD', emoji: '\u{1F622}', label: '매우 힘들어요' },
]

const SLIDER_LABELS = ['1', '2', '3', '4', '5']

// ─── Component ──────────────────────────────────────────────

export function CheckinFormClient({ user }: CheckinFormClientProps) {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [pastCheckins, setPastCheckins] = useState<OnboardingCheckin[]>([])

  // Form state
  const [checkinWeek, setCheckinWeek] = useState(1)
  const [mood, setMood] = useState<string>('')
  const [energy, setEnergy] = useState(3)
  const [belonging, setBelonging] = useState(3)
  const [comment, setComment] = useState('')

  // ─── Fetch past checkins to auto-calculate week ───
  const fetchCheckins = useCallback(() => {
    setLoading(true)
    apiClient
      .get<OnboardingCheckin[]>(`/api/v1/onboarding/checkins/${user.employeeId}`)
      .then((res) => {
        const data = res.data ?? []
        setPastCheckins(data)
        // Auto-calculate next week
        if (data.length > 0) {
          const maxWeek = Math.max(...data.map((c) => c.checkinWeek))
          setCheckinWeek(Math.min(maxWeek + 1, 52))
        }
      })
      .catch(() => setPastCheckins([]))
      .finally(() => setLoading(false))
  }, [user.employeeId])

  useEffect(() => {
    fetchCheckins()
  }, [fetchCheckins])

  // ─── Submit handler ───
  const handleSubmit = useCallback(async () => {
    if (!mood) return
    setSubmitting(true)
    try {
      await apiClient.post('/api/v1/onboarding/checkin', {
        checkinWeek,
        mood,
        energy,
        belonging,
        comment: comment.trim() || undefined,
      })
      setSubmitted(true)
    } catch {
      // Error handled by apiClient
    } finally {
      setSubmitting(false)
    }
  }, [checkinWeek, mood, energy, belonging, comment])

  // ─── Loading state ───
  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-60 w-full" />
      </div>
    )
  }

  // ─── Success state ───
  if (submitted) {
    return (
      <div className="space-y-6 p-6">
        <PageHeader title="주간 체크인" description="이번 주 체크인을 완료했습니다." />
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <div className="text-5xl">{'\u{2705}'}</div>
            <h2 className="text-xl font-semibold text-ctr-primary">체크인 완료!</h2>
            <p className="text-sm text-muted-foreground">
              {checkinWeek}주차 체크인이 제출되었습니다. 감사합니다, {user.name}님!
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setSubmitted(false)
                setMood('')
                setEnergy(3)
                setBelonging(3)
                setComment('')
                fetchCheckins()
              }}
            >
              다시 제출하기
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="주간 체크인"
        description={`${user.name}님, 이번 주 온보딩 경험을 공유해주세요.`}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {checkinWeek}주차 체크인
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* ─── Week selector ─── */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              체크인 주차
            </label>
            <select
              className="w-32 rounded-md border px-3 py-2 text-sm"
              value={checkinWeek}
              onChange={(e) => setCheckinWeek(Number(e.target.value))}
            >
              {Array.from({ length: 52 }, (_, i) => i + 1).map((w) => {
                const alreadyDone = pastCheckins.some((c) => c.checkinWeek === w)
                return (
                  <option key={w} value={w} disabled={alreadyDone}>
                    {w}주차{alreadyDone ? ' (제출 완료)' : ''}
                  </option>
                )
              })}
            </select>
          </div>

          {/* ─── Mood selector ─── */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-3">
              이번 주 기분은 어떠셨나요?
            </label>
            <div className="flex gap-3 flex-wrap">
              {MOODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMood(m.value)}
                  className={`flex flex-col items-center gap-1 rounded-lg border-2 px-4 py-3 transition-all ${
                    mood === m.value
                      ? 'border-ctr-primary bg-ctr-light shadow-sm'
                      : 'border-transparent hover:border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-3xl">{m.emoji}</span>
                  <span className="text-xs font-medium text-muted-foreground">{m.label}</span>
                </button>
              ))}
            </div>
            {!mood && (
              <p className="mt-1 text-xs text-muted-foreground">기분을 선택해주세요.</p>
            )}
          </div>

          {/* ─── Energy slider ─── */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              에너지 수준 <span className="text-ctr-primary font-semibold">{energy}/5</span>
            </label>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={energy}
              onChange={(e) => setEnergy(Number(e.target.value))}
              className="w-full max-w-xs accent-ctr-primary"
            />
            <div className="flex justify-between max-w-xs text-xs text-muted-foreground mt-1">
              {SLIDER_LABELS.map((l) => (
                <span key={l}>{l}</span>
              ))}
            </div>
          </div>

          {/* ─── Belonging slider ─── */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              소속감 <span className="text-ctr-primary font-semibold">{belonging}/5</span>
            </label>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={belonging}
              onChange={(e) => setBelonging(Number(e.target.value))}
              className="w-full max-w-xs accent-ctr-primary"
            />
            <div className="flex justify-between max-w-xs text-xs text-muted-foreground mt-1">
              {SLIDER_LABELS.map((l) => (
                <span key={l}>{l}</span>
              ))}
            </div>
          </div>

          {/* ─── Comment ─── */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              추가 의견 <span className="text-xs text-muted-foreground">(선택)</span>
            </label>
            <textarea
              className="w-full rounded-md border px-3 py-2 text-sm placeholder:text-muted-foreground min-h-[80px] resize-y"
              placeholder="이번 주에 특별히 좋았던 점이나 어려웠던 점이 있다면 알려주세요."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={1000}
            />
          </div>

          {/* ─── Submit ─── */}
          <div className="flex justify-end pt-2">
            <Button
              onClick={handleSubmit}
              disabled={!mood || submitting}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              {submitting ? '제출 중...' : '체크인 제출'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
