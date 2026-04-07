'use client'

import { useTranslations } from 'next-intl'
import { toast } from '@/hooks/use-toast'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Users, Send, CheckCircle2 } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { BUTTON_VARIANTS } from '@/lib/styles'
import type { SessionUser } from '@/types'

// ─── Peer Review Questions ──────────────────────────────

const PEER_QUESTIONS = [
  { key: 'collaboration', labelKey: 'peerQuestion.collaboration.label', descKey: 'peerQuestion.collaboration.desc' },
  { key: 'communication', labelKey: 'peerQuestion.communication.label', descKey: 'peerQuestion.communication.desc' },
  { key: 'reliability', labelKey: 'peerQuestion.reliability.label', descKey: 'peerQuestion.reliability.desc' },
  { key: 'expertise', labelKey: 'peerQuestion.expertise.label', descKey: 'peerQuestion.expertise.desc' },
  { key: 'initiative', labelKey: 'peerQuestion.initiative.label', descKey: 'peerQuestion.initiative.desc' },
  { key: 'respect', labelKey: 'peerQuestion.respect.label', descKey: 'peerQuestion.respect.desc' },
  { key: 'growth', labelKey: 'peerQuestion.growth.label', descKey: 'peerQuestion.growth.desc' },
  { key: 'impact', labelKey: 'peerQuestion.impact.label', descKey: 'peerQuestion.impact.desc' },
]

const SCORE_LABELS = ['score.veryLacking', 'score.lacking', 'score.average', 'score.excellent', 'score.outstanding']

// ─── Component ───────────────────────────────────────────

export default function PeerEvalFormClient({ user: _user, nominationId }: { user: SessionUser; nominationId: string }) {
  const t = useTranslations('performance')
  const router = useRouter()

  const [scores, setScores] = useState<Record<string, number>>({})
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const setScore = (key: string, value: number) => {
    setScores((prev) => ({ ...prev, [key]: value }))
  }

  const allScored = PEER_QUESTIONS.every((q) => scores[q.key] != null)
  const avgScore = allScored
    ? Math.round((Object.values(scores).reduce((s, v) => s + v, 0) / PEER_QUESTIONS.length) * 100) / 100
    : 0

  const handleSubmit = async () => {
    if (!allScored || comment.length < 10) return
    setSubmitting(true)
    try {
      await apiClient.post(`/api/v1/peer-review/my-reviews/${nominationId}`, {
        competencyDetail: scores,
        comment,
        competencyScore: avgScore,
      })
      setSubmitted(true)
    } catch (err) { toast({ title: t('peerEvalForm.loadFailed'), description: err instanceof Error ? err.message : t('retryMessage'), variant: 'destructive' }) }
    setSubmitting(false)
  }

  if (submitted) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <CheckCircle2 className="w-16 h-16 text-primary" />
        <h2 className="text-xl font-bold text-foreground">{t('peerReview_keab080_keca09cec')}</h2>
        <p className="text-sm text-muted-foreground">{t('kr_kec868cec_ked94bceb_keab090ec')}</p>
        <button onClick={() => router.push('/performance/peer-review')}
          className={`px-4 py-2 ${BUTTON_VARIANTS.primary} rounded-lg text-sm font-medium`}>
          {t('kr_keb8f8cec')}
        </button>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/performance/peer-review')} className="p-1 hover:bg-muted rounded-lg">
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <Users className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">{t('peerReview_kec9e91ec')}</h1>
      </div>

      <div className="bg-indigo-500/15 rounded-xl border border-indigo-200 p-4 text-sm text-primary/90">
        {t('peerReview_keb8a94_kec9db5eb_keca791ea_kec8694ec_keab1b4ec_ked94bceb_kebb680ed')}
      </div>

      {/* Questions */}
      <div className="space-y-4">
        {PEER_QUESTIONS.map((q) => (
          <div key={q.key} className="bg-card rounded-xl shadow-sm border border-border p-6">
            <h3 className="text-sm font-semibold text-foreground">{t(q.labelKey)}</h3>
            <p className="text-xs text-muted-foreground mt-1 mb-3">{t(q.descKey)}</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((v) => (
                <button key={v} onClick={() => setScore(q.key, v)}
                  className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                    scores[q.key] === v
                      ? 'bg-primary text-white border-primary'
                      : 'bg-card text-muted-foreground border-border hover:bg-background'
                  }`}>
                  <div>{v}</div>
                  <div className="text-xs mt-0.5 opacity-80">{t(SCORE_LABELS[v - 1])}</div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Overall Score Display */}
      {allScored && (
        <div className="bg-primary/10 rounded-xl border border-primary/20 p-4 text-center">
          <p className="text-xs text-muted-foreground">{t('kr_keca285ed_score')}</p>
          <p className="text-3xl font-bold text-primary">{avgScore} <span className="text-sm text-muted-foreground">/ 5.0</span></p>
        </div>
      )}

      {/* Comment */}
      <div className="bg-card rounded-xl shadow-sm border border-border p-6">
        <h3 className="text-sm font-semibold text-foreground mb-2">{t('kr_keca285ed_kecbd94eb')} <span className="text-red-500">*</span></h3>
        <p className="text-xs text-muted-foreground mb-3">{t('kr_keb8f99eb_keab095ec_kebb09cec_')}</p>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t('peerEvalForm.commentPlaceholder')}
          rows={5}
          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10 placeholder:text-muted-foreground"
        />
        <p className="text-xs text-muted-foreground mt-1 text-right">{t('peerEvalForm.charCount', { count: comment.length })}</p>
      </div>

      {/* Submit */}
      <div className="flex justify-end">
        <button onClick={handleSubmit} disabled={submitting || !allScored || comment.length < 10}
          className={`flex items-center gap-2 px-6 py-2.5 ${BUTTON_VARIANTS.primary} rounded-lg text-sm font-medium disabled:opacity-50`}>
          <Send className="w-4 h-4" />
          {submitting ? t('peerEvalForm.submitting') : t('peerEvalForm.submit')}
        </button>
      </div>
    </div>
  )
}
