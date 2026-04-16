'use client'

import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/ui/EmptyState'

import { useState, useEffect, useCallback } from 'react'
import { BookOpen, CheckCircle2, Clock, AlertTriangle, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { apiClient } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import type { SessionUser } from '@/types'
import { CARD_STYLES, TABLE_STYLES } from '@/lib/styles'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/format/date'

// ─── Types ───────────────────────────────────────────────

type CourseRef = {
  id: string
  code?: string | null
  title: string
  category: string
  format?: string
  durationHours?: number | null
  provider?: string | null
}

type EnrollmentItem = {
  enrollmentId: string
  status: string
  source?: string
  expiresAt?: string | null
  enrolledAt?: string
  course: CourseRef
}

type HistoryItem = {
  enrollmentId: string
  completedAt?: string | null
  expiresAt?: string | null
  score?: number | null
  course: {
    id: string
    code?: string | null
    title: string
    category: string
    isMandatory?: boolean
  }
}

type ExpiringSoonItem = {
  enrollmentId: string
  expiresAt?: string | null
  course: { id: string; title: string; code?: string | null }
}

type RecommendedCourse = {
  id: string
  code?: string | null
  title: string
  category: string
  format?: string
  durationHours?: number | null
  provider?: string | null
}

type MyTrainingData = {
  requiredPending: EnrollmentItem[]
  jobRequired: CourseRef[]
  recommended: RecommendedCourse[]
  history: HistoryItem[]
  expiringSoon: ExpiringSoonItem[]
}

const CATEGORY_KEYS: Record<string, string> = {
  COMPLIANCE: 'category.compliance',
  TECHNICAL: 'category.technical',
  LEADERSHIP: 'category.leadership',
  SAFETY_TRAINING: 'category.safety',
  ONBOARDING_TRAINING: 'category.onboarding',
  OTHER: 'category.other',
}

const FORMAT_KEYS: Record<string, string> = {
  online: 'format.online',
  offline: 'format.offline',
  blended: 'format.blended',
  self_paced: 'format.selfPaced',
}

const STATUS_CONFIG: Record<string, { labelKey: string; className: string }> = {
  ENROLLED: { labelKey: 'status.enrolled', className: 'bg-amber-500/15 text-amber-700 border-amber-300' },
  IN_PROGRESS: { labelKey: 'status.inProgress', className: 'bg-emerald-500/15 text-emerald-700 border-emerald-200' },
}

function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

// ─── Component ───────────────────────────────────────────

export default function MyTrainingClient({ user: _user }: { user: SessionUser }) {
  const t = useTranslations('myTraining')
  const tCommon = useTranslations('common')
  const { toast } = useToast()
  const [data, setData] = useState<MyTrainingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [enrollingId, setEnrollingId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<MyTrainingData>('/api/v1/training/my')
      setData(res.data ?? null)
    } catch {
      toast({ title: t('fetchError'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [t, toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleEnroll = async (courseId: string) => {
    setEnrollingId(courseId)
    try {
      await apiClient.post('/api/v1/training/enrollments', {
        courseId,
        source: 'manual',
      })
      toast({ title: tCommon('created') })
      fetchData()
    } catch {
      toast({ title: tCommon('error'), variant: 'destructive' })
    } finally {
      setEnrollingId(null)
    }
  }

  const handleStartCourse = async (enrollmentId: string) => {
    try {
      await apiClient.patch(`/api/v1/training/enrollments/${enrollmentId}`, {
        status: 'IN_PROGRESS',
      })
      toast({ title: tCommon('completed') })
      fetchData()
    } catch {
      toast({ title: tCommon('saveFailed'), variant: 'destructive' })
    }
  }

  const handleComplete = async (enrollmentId: string) => {
    try {
      await apiClient.patch(`/api/v1/training/enrollments/${enrollmentId}`, {
        status: 'ENROLLMENT_COMPLETED',
        completedAt: new Date().toISOString(),
      })
      toast({ title: tCommon('completed') })
      fetchData()
    } catch {
      toast({ title: tCommon('error'), variant: 'destructive' })
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 bg-muted rounded w-48 animate-pulse" />
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const { requiredPending = [], jobRequired = [], recommended = [], history = [], expiringSoon = [] } = data ?? {}

  return (
    <div className="p-6 space-y-6">
      {/* ─── 헤더 ─── */}
      <div>
        <nav className="text-xs text-muted-foreground mb-1">{t('breadcrumb')}</nav>
        <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
      </div>

      {/* ─── 만료 임박 경고 ─── */}
      {expiringSoon.length > 0 && (
        <div className="bg-orange-500/10 border border-orange-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-orange-700" />
            <span className="text-sm font-semibold text-orange-700">{t('expiringSoon', { count: expiringSoon.length })}</span>
          </div>
          <div className="space-y-1.5">
            {expiringSoon.map((item) => {
              const days = daysUntil(item.expiresAt)
              return (
                <div key={item.enrollmentId} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{item.course.title}</span>
                  <span className="text-orange-700 font-medium">
                    {days !== null ? t('expiresInDays', { days }) : '-'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ─── KPI 요약 ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className={`${CARD_STYLES.kpi} text-center`}>
          <p className="text-xs text-muted-foreground mb-1">{t('kpi.requiredPending')}</p>
          <p className="text-3xl font-bold text-red-500">{requiredPending.length}</p>
        </div>
        <div className={`${CARD_STYLES.kpi} text-center`}>
          <p className="text-xs text-muted-foreground mb-1">{t('kpi.enrollmentNeeded')}</p>
          <p className="text-3xl font-bold text-amber-700">{jobRequired.length}</p>
        </div>
        <div className={`${CARD_STYLES.kpi} text-center`}>
          <p className="text-xs text-muted-foreground mb-1">{t('kpi.recommended')}</p>
          <p className="text-3xl font-bold text-primary/90">{recommended.length}</p>
        </div>
        <div className={`${CARD_STYLES.kpi} text-center`}>
          <p className="text-xs text-muted-foreground mb-1">{t('kpi.completed')}</p>
          <p className="text-3xl font-bold text-emerald-700">{history.length}</p>
        </div>
      </div>

      {/* ─── 진행 중인 필수 교육 ─── */}
      {requiredPending.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            {t('section.requiredPending')}
          </h2>
          <div className="space-y-3">
            {requiredPending.map((item) => {
              const statusCfg = STATUS_CONFIG[item.status] ?? { labelKey: '', className: 'bg-background text-muted-foreground border-border' }
              const statusLabel = statusCfg.labelKey ? t(statusCfg.labelKey) : item.status
              return (
                <div key={item.enrollmentId} className={CARD_STYLES.padded}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-foreground text-sm">{item.course.title}</span>
                        <Badge className={`text-[10px] px-1.5 py-0 ${statusCfg.className}`}>{statusLabel}</Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{t('badge.required')}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span>{CATEGORY_KEYS[item.course.category] ? t(CATEGORY_KEYS[item.course.category]) : item.course.category}</span>
                        {item.course.durationHours && <span>{item.course.durationHours}h</span>}
                        {item.course.format && <span>{FORMAT_KEYS[item.course.format] ? t(FORMAT_KEYS[item.course.format]) : item.course.format}</span>}
                        {item.expiresAt && (
                          <span className="text-red-500">{t('deadlineLabel', { date: formatDate(item.expiresAt) })}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {item.status === 'ENROLLED' && (
                        <Button size="sm" onClick={() => handleStartCourse(item.enrollmentId)}>
                          {t('action.startCourse')}
                        </Button>
                      )}
                      {item.status === 'IN_PROGRESS' && (
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleComplete(item.enrollmentId)}>
                          {t('action.completeCourse')}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ─── 미등록 직무 필수 과정 ─── */}
      {jobRequired.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-amber-700" />
            {t('section.enrollmentNeeded')}
          </h2>
          <div className="space-y-3">
            {jobRequired.map((course) => (
              <div key={course.id} className={CARD_STYLES.padded}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-foreground text-sm">{course.title}</span>
                      <Badge className="text-[10px] px-1.5 py-0 bg-destructive/10 text-destructive border-destructive/20">{t('badge.required')}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span>{CATEGORY_KEYS[course.category] ? t(CATEGORY_KEYS[course.category]) : course.category}</span>
                      {course.durationHours && <span>{course.durationHours}h</span>}
                      {course.provider && <span>{course.provider}</span>}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={enrollingId === course.id}
                    onClick={() => handleEnroll(course.id)}
                  >
                    {enrollingId === course.id ? t('action.enrolling') : t('action.enroll')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── AI 추천 과정 ─── */}
      {recommended.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary/90" />
            {t('section.recommended')}
          </h2>
          <div className="space-y-3">
            {recommended.map((course) => (
              <div key={course.id} className={CARD_STYLES.padded}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-foreground text-sm">{course.title}</span>
                      <Badge className="text-[10px] px-1.5 py-0 bg-indigo-500/15 text-primary/90 border-indigo-200">{t('badge.recommended')}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span>{CATEGORY_KEYS[course.category] ? t(CATEGORY_KEYS[course.category]) : course.category}</span>
                      {course.durationHours && <span>{course.durationHours}h</span>}
                      {course.format && <span>{FORMAT_KEYS[course.format] ? t(FORMAT_KEYS[course.format]) : course.format}</span>}
                      {course.provider && <span>{course.provider}</span>}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={enrollingId === course.id}
                    onClick={() => handleEnroll(course.id)}
                  >
                    {enrollingId === course.id ? t('action.enrolling') : t('action.enrollShort')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── 이수 이력 ─── */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-700" />
          {t('section.history')}
          <span className="text-sm font-normal text-muted-foreground">{t('section.historyRecent')}</span>
        </h2>
        {history.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-8 text-center text-sm text-muted-foreground">
            {t('emptyHistory')}
          </div>
        ) : (
          <div className={TABLE_STYLES.wrapper}>
            <table className={TABLE_STYLES.table}>
              <thead>
                <tr className={TABLE_STYLES.header}>
                  <th className={TABLE_STYLES.headerCell}>{t('table.courseName')}</th>
                  <th className={TABLE_STYLES.headerCell}>{t('table.category')}</th>
                  <th className={TABLE_STYLES.headerCell}>{t('table.completedAt')}</th>
                  <th className={TABLE_STYLES.headerCell}>{t('table.validUntil')}</th>
                  <th className={TABLE_STYLES.headerCell}>{t('table.score')}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.enrollmentId} className={TABLE_STYLES.row}>
                    <td className={TABLE_STYLES.cell}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{item.course.title}</span>
                        {item.course.isMandatory && (
                          <Badge className="text-[10px] px-1.5 py-0 bg-destructive/10 text-destructive border-destructive/20">{t('badge.mandatory')}</Badge>
                        )}
                      </div>
                    </td>
                    <td className={cn(TABLE_STYLES.cell, "text-muted-foreground")}>
                      {CATEGORY_KEYS[item.course.category] ? t(CATEGORY_KEYS[item.course.category]) : item.course.category}
                    </td>
                    <td className={cn(TABLE_STYLES.cell, "text-muted-foreground")}>{formatDate(item.completedAt)}</td>
                    <td className={cn(TABLE_STYLES.cell, "text-muted-foreground")}>{formatDate(item.expiresAt)}</td>
                    <td className={cn(TABLE_STYLES.cell, "text-muted-foreground")}>
                      {item.score !== null && item.score !== undefined ? t('scoreValue', { score: item.score }) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ─── 빈 상태 ─── */}
      {requiredPending.length === 0 && jobRequired.length === 0 && recommended.length === 0 && history.length === 0 && (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <Clock className="h-10 w-10 text-border mx-auto mb-3" />
          <EmptyState />
        </div>
      )}
    </div>
  )
}
