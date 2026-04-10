'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import type { SessionUser } from '@/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, ArrowLeft, Save, Send, RotateCcw } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { StatusBadge } from '@/components/ui/StatusBadge'
import GoalProgressSection from '@/components/performance/quarterly-review/GoalProgressSection'
import SentimentSelector from '@/components/performance/quarterly-review/SentimentSelector'
import ActionItemsEditor from '@/components/performance/quarterly-review/ActionItemsEditor'

// ─── Types ──────────────────────────────────────────────────

interface GoalProgressItem {
  id: string
  goalId: string
  snapshotTitle: string
  snapshotWeight: number
  snapshotTarget: string | null
  progressPct: number
  employeeComment: string | null
  managerComment: string | null
  trackingStatus: string | null
  goal: { id: string; title: string; status: string }
}

interface ActionItem {
  description: string
  dueDate?: string | null
  assignee?: 'EMPLOYEE' | 'MANAGER'
  completed?: boolean
}

interface ReviewDetail {
  id: string
  year: number
  quarter: string
  status: string
  goalHighlights: string | null
  challenges: string | null
  developmentNeeds: string | null
  employeeComments: string | null
  employeeSubmittedAt: string | null
  managerFeedback: string | null
  coachingNotes: string | null
  developmentPlan: string | null
  overallSentiment: string | null
  managerSubmittedAt: string | null
  actionItems: ActionItem[] | null
  employee: {
    id: string
    name: string
    employeeNo: string
    assignments: Array<{
      department: { name: string } | null
      jobGrade: { name: string; code: string } | null
    }>
  }
  manager: { id: string; name: string } | null
  goalProgress: GoalProgressItem[]
  cycle: { id: string; name: string; year: number; half: string; status: string } | null
}

interface Props {
  user: SessionUser
  reviewId: string
}

// ─── Component ──────────────────────────────────────────────

export default function QuarterlyReviewDetailClient({ user, reviewId }: Props) {
  const t = useTranslations('performance.quarterlyReview')
  const tc = useTranslations('common')
  const router = useRouter()

  const [review, setReview] = useState<ReviewDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // ── Form state ──
  const [goalHighlights, setGoalHighlights] = useState('')
  const [challenges, setChallenges] = useState('')
  const [developmentNeeds, setDevelopmentNeeds] = useState('')
  const [employeeComments, setEmployeeComments] = useState('')
  const [managerFeedback, setManagerFeedback] = useState('')
  const [coachingNotes, setCoachingNotes] = useState('')
  const [developmentPlan, setDevelopmentPlan] = useState('')
  const [overallSentiment, setOverallSentiment] = useState<'POSITIVE' | 'NEUTRAL' | 'CONCERN' | null>(null)
  const [actionItems, setActionItems] = useState<ActionItem[]>([])
  const [goalProgressUpdates, setGoalProgressUpdates] = useState<Record<string, Record<string, string | number>>>({})

  // ── Derived role flags ──
  const isEmployee = user.employeeId === review?.employee.id
  const isManager = user.employeeId === review?.manager?.id
  const isHrOrSuper = user.role === 'HR_ADMIN' || user.role === 'SUPER_ADMIN'
  const canEditEmployee = isEmployee && ['DRAFT', 'IN_PROGRESS'].includes(review?.status ?? '')
  const canEditManager = isManager && review?.status === 'EMPLOYEE_DONE'
  const canSubmitEmployee = isEmployee && review?.status === 'IN_PROGRESS'
  const canSubmitManager = isManager && review?.status === 'EMPLOYEE_DONE'
  const canReopen = isHrOrSuper && review?.status === 'COMPLETED'

  const showEmployeeSection = review?.goalHighlights !== null || review?.challenges !== null || canEditEmployee
  const showManagerSection = review?.managerFeedback !== null || review?.coachingNotes !== null || canEditManager

  // ActionItems 3-mode
  const actionItemsMode = canEditManager ? 'edit' as const
    : review?.status === 'COMPLETED' ? 'interactive' as const
    : 'readonly' as const

  // ── Fetch ──
  const fetchReview = useCallback(async () => {
    try {
      setLoading(true)
      const res = await apiClient.get<ReviewDetail>(`/api/v1/performance/quarterly-reviews/${reviewId}`)
      const r = res.data
      setReview(r)
      // Hydrate form
      setGoalHighlights(r.goalHighlights ?? '')
      setChallenges(r.challenges ?? '')
      setDevelopmentNeeds(r.developmentNeeds ?? '')
      setEmployeeComments(r.employeeComments ?? '')
      setManagerFeedback(r.managerFeedback ?? '')
      setCoachingNotes(r.coachingNotes ?? '')
      setDevelopmentPlan(r.developmentPlan ?? '')
      setOverallSentiment(r.overallSentiment as 'POSITIVE' | 'NEUTRAL' | 'CONCERN' | null)
      setActionItems((r.actionItems ?? []) as ActionItem[])
    } catch (err) {
      toast({
        title: t('toast.loadFailed'),
        description: err instanceof Error ? err.message : tc('retry'),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [reviewId, t, tc])

  useEffect(() => { fetchReview() }, [fetchReview])

  // ── Goal progress change handler ──
  const handleGoalProgressChange = useCallback((goalProgressId: string, field: string, value: string | number) => {
    setGoalProgressUpdates((prev) => ({
      ...prev,
      [goalProgressId]: { ...(prev[goalProgressId] ?? {}), [field]: value },
    }))
    // Also update local display
    setReview((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        goalProgress: prev.goalProgress.map((gp) =>
          gp.id === goalProgressId ? { ...gp, [field]: value } : gp,
        ),
      }
    })
  }, [])

  // ── Save ──
  const handleSave = useCallback(async () => {
    if (!review) return
    setSaving(true)
    try {
      const body: Record<string, unknown> = {}

      if (canEditEmployee) {
        body.goalHighlights = goalHighlights
        body.challenges = challenges
        body.developmentNeeds = developmentNeeds
        body.employeeComments = employeeComments
        // Goal progress (employee fields)
        const gpUpdates = Object.entries(goalProgressUpdates).map(([id, fields]) => ({
          goalProgressId: id,
          progressPct: fields.progressPct !== undefined ? Number(fields.progressPct) : undefined,
          employeeComment: fields.employeeComment as string | undefined,
        })).filter((u) => u.progressPct !== undefined || u.employeeComment !== undefined)
        if (gpUpdates.length > 0) body.goalProgress = gpUpdates
      }

      if (canEditManager) {
        body.managerFeedback = managerFeedback
        body.coachingNotes = coachingNotes
        body.developmentPlan = developmentPlan
        body.overallSentiment = overallSentiment
        body.actionItems = actionItems.filter((a) => a.description.trim())
        // Goal progress (manager fields)
        const gpUpdates = Object.entries(goalProgressUpdates).map(([id, fields]) => ({
          goalProgressId: id,
          managerComment: fields.managerComment as string | undefined,
          trackingStatus: fields.trackingStatus as string | undefined,
        })).filter((u) => u.managerComment !== undefined || u.trackingStatus !== undefined)
        if (gpUpdates.length > 0) body.goalProgress = gpUpdates
      }

      await apiClient.put(`/api/v1/performance/quarterly-reviews/${reviewId}`, body)
      toast({ title: t('toast.saveSuccess') })
      setGoalProgressUpdates({})
    } catch (err) {
      toast({
        title: t('toast.saveFailed'),
        description: err instanceof Error ? err.message : tc('retry'),
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }, [review, canEditEmployee, canEditManager, goalHighlights, challenges, developmentNeeds, employeeComments, managerFeedback, coachingNotes, developmentPlan, overallSentiment, actionItems, goalProgressUpdates, reviewId, t, tc])

  // ── Submit ──
  const handleSubmit = useCallback(async () => {
    // Save first, then submit
    await handleSave()
    try {
      await apiClient.put(`/api/v1/performance/quarterly-reviews/${reviewId}/submit`, {})
      toast({ title: t('toast.submitSuccess') })
      fetchReview()
    } catch (err) {
      toast({
        title: t('toast.submitFailed'),
        description: err instanceof Error ? err.message : tc('retry'),
        variant: 'destructive',
      })
    }
  }, [handleSave, reviewId, t, tc, fetchReview])

  // ── Reopen ──
  const handleReopen = useCallback(async () => {
    try {
      await apiClient.put(`/api/v1/performance/quarterly-reviews/${reviewId}/reopen`, {})
      toast({ title: t('toast.reopenSuccess') })
      fetchReview()
    } catch (err) {
      toast({
        title: t('toast.submitFailed'),
        description: err instanceof Error ? err.message : tc('retry'),
        variant: 'destructive',
      })
    }
  }, [reviewId, t, tc, fetchReview])

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!review) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">{t('toast.loadFailed')}</p>
      </Card>
    )
  }

  const dept = review.employee.assignments?.[0]?.department?.name ?? ''

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t('action.backToList')}
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {review.year} {t(`quarter.${review.quarter}`)} — {review.employee.name}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {dept && `${dept} · `}{review.manager?.name && `${t('table.manager')}: ${review.manager.name}`}
          </p>
        </div>
        <StatusBadge status={review.status}>{t(`status.${review.status}`)}</StatusBadge>
      </div>

      {/* Goal Progress Section */}
      {review.goalProgress.length > 0 && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">{t('section.goalProgress')}</h2>
          <GoalProgressSection
            items={review.goalProgress}
            canEditEmployee={canEditEmployee}
            canEditManager={canEditManager}
            onChange={handleGoalProgressChange}
          />
        </Card>
      )}

      {/* Employee Reflection Section */}
      {showEmployeeSection && (
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">{t('section.employeeReflection')}</h2>

          {([
            ['goalHighlights', goalHighlights, setGoalHighlights],
            ['challenges', challenges, setChallenges],
            ['developmentNeeds', developmentNeeds, setDevelopmentNeeds],
            ['employeeComments', employeeComments, setEmployeeComments],
          ] as const).map(([key, value, setter]) => (
            <div key={key} className="space-y-1.5">
              <label className="text-sm font-medium">{t(`field.${key}`)}</label>
              {canEditEmployee ? (
                <Textarea
                  value={value}
                  onChange={(e) => (setter as (v: string) => void)(e.target.value)}
                  placeholder={t(`field.${key}Placeholder`)}
                  className="min-h-[80px]"
                />
              ) : (
                <div className="bg-muted/30 rounded-xl p-4 text-sm whitespace-pre-wrap">
                  {value || <span className="text-muted-foreground">—</span>}
                </div>
              )}
            </div>
          ))}
        </Card>
      )}

      {/* Manager Feedback Section */}
      {showManagerSection && (
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">{t('section.managerFeedback')}</h2>

          {([
            ['managerFeedback', managerFeedback, setManagerFeedback],
            ['coachingNotes', coachingNotes, setCoachingNotes],
            ['developmentPlan', developmentPlan, setDevelopmentPlan],
          ] as const).map(([key, value, setter]) => (
            <div key={key} className="space-y-1.5">
              <label className="text-sm font-medium">{t(`field.${key}`)}</label>
              {canEditManager ? (
                <Textarea
                  value={value}
                  onChange={(e) => (setter as (v: string) => void)(e.target.value)}
                  placeholder={t(`field.${key}Placeholder`)}
                  className="min-h-[80px]"
                />
              ) : (
                <div className="bg-muted/30 rounded-xl p-4 text-sm whitespace-pre-wrap">
                  {value || <span className="text-muted-foreground">—</span>}
                </div>
              )}
            </div>
          ))}

          {/* Sentiment */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('table.sentiment')}</label>
            <SentimentSelector
              value={overallSentiment}
              onChange={setOverallSentiment}
              disabled={!canEditManager}
            />
          </div>

          {/* Action Items */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('section.actionItems')}</label>
            <ActionItemsEditor
              items={actionItems}
              mode={actionItemsMode}
              onChange={setActionItems}
            />
          </div>
        </Card>
      )}

      {/* Action Footer */}
      {(canEditEmployee || canEditManager || canReopen) && (
        <div className="flex items-center gap-3 justify-end sticky bottom-4 bg-card/80 backdrop-blur-sm rounded-2xl p-4 shadow-md">
          {(canEditEmployee || canEditManager) && (
            <>
              <Button variant="outline" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                {t('action.save')}
              </Button>

              {(canSubmitEmployee || canSubmitManager) && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button disabled={saving}>
                      <Send className="h-4 w-4 mr-1" />
                      {canSubmitEmployee ? t('action.submitEmployee') : t('action.submitManager')}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('confirm.submitTitle')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {canSubmitEmployee ? t('confirm.submitEmployeeDesc') : t('confirm.submitManagerDesc')}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
                      <AlertDialogAction onClick={handleSubmit}>{tc('confirm')}</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </>
          )}

          {canReopen && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline">
                  <RotateCcw className="h-4 w-4 mr-1" />
                  {t('action.reopen')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('confirm.reopenTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>{t('confirm.reopenDesc')}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleReopen}>{tc('confirm')}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      )}
    </div>
  )
}
