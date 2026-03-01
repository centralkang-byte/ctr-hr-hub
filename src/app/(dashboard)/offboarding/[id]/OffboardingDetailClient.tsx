'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Offboarding Detail Client
// 퇴직 처리 상세: 태스크 목록, 인수인계, 퇴직 면담
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  ClipboardList,
  FileText,
  MessageSquare,
  Star,
  Upload,
  User,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'

// ─── Types ──────────────────────────────────────────────────

interface OffboardingTaskRow {
  id: string
  status: string
  completedAt: string | null
  completedBy: string | null
  note: string | null
  task: {
    isRequired: boolean
    title: string
    description: string | null
    assigneeType: string
    dueDaysBefore: number
    sortOrder: number
  }
}

interface OffboardingDetail {
  id: string
  employeeId: string
  resignType: string
  lastWorkingDate: string
  resignReasonCode: string | null
  resignReasonDetail: string | null
  handoverToId: string | null
  status: string
  exitInterviewCompleted: boolean
  startedAt: string
  completedAt: string | null
  employee: { id: string; name: string; companyId: string }
  checklist: { id: string; name: string }
  handoverTo: { id: string; name: string } | null
  offboardingTasks: OffboardingTaskRow[]
}

interface ExitInterviewData {
  id: string
  interviewDate: string
  primaryReason: string
  satisfactionScore: number
  wouldRecommend: boolean | null
  feedbackText: string
  aiSummary: string | null
  interviewer: { id: string; name: string }
}

interface AiSummaryResult {
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'
  key_issues: string[]
  retention_insight: string
  action_needed: string | null
}

interface OffboardingDetailClientProps {
  user: SessionUser
  offboardingId: string
}

// ─── Constants ──────────────────────────────────────────────

const ASSIGNEE_COLORS: Record<string, string> = {
  EMPLOYEE: 'bg-gray-100 text-gray-700',
  MANAGER: 'bg-blue-100 text-blue-700',
  HR: 'bg-green-100 text-green-700',
  IT: 'bg-purple-100 text-purple-700',
  FINANCE: 'bg-orange-100 text-orange-700',
}

// ─── Component ──────────────────────────────────────────────

export function OffboardingDetailClient({
  user,
  offboardingId,
}: OffboardingDetailClientProps) {
  const router = useRouter()
  const t = useTranslations('offboarding')
  const tCommon = useTranslations('common')

  const RESIGN_TYPE_LABELS: Record<string, string> = {
    VOLUNTARY: t('resignVoluntary'),
    INVOLUNTARY: t('resignInvoluntary'),
    RETIREMENT: t('resignRetirement'),
    CONTRACT_END: t('resignContractEnd'),
    MUTUAL_AGREEMENT: t('resignMutualAgreement'),
  }

  const ASSIGNEE_LABELS: Record<string, string> = {
    EMPLOYEE: t('assigneeEmployee'),
    MANAGER: t('assigneeManager'),
    HR: t('assigneeHr'),
    IT: t('assigneeIt'),
    FINANCE: t('assigneeFinance'),
  }

  const TASK_STATUS_LABELS: Record<string, string> = {
    PENDING: t('taskStatusPending'),
    DONE: t('taskStatusDone'),
    SKIPPED: t('taskStatusSkipped'),
    BLOCKED: t('taskStatusBlocked'),
  }

  const EXIT_REASON_LABELS: Record<string, string> = {
    COMPENSATION: t('reasonCompensation'),
    CAREER_GROWTH: t('reasonCareerGrowth'),
    WORK_LIFE_BALANCE: t('reasonWorkLifeBalance'),
    MANAGEMENT: t('reasonManagement'),
    CULTURE: t('reasonCulture'),
    RELOCATION: t('reasonRelocation'),
    PERSONAL: t('reasonPersonal'),
    OTHER: t('reasonOther'),
  }

  const EXIT_REASONS = Object.entries(EXIT_REASON_LABELS) as [string, string][]

  const SENTIMENT_BADGE: Record<string, { label: string; className: string }> = {
    POSITIVE: { label: t('sentimentPositive'), className: 'bg-green-100 text-green-800' },
    NEUTRAL: { label: t('sentimentNeutral'), className: 'bg-gray-100 text-gray-800' },
    NEGATIVE: { label: t('sentimentNegative'), className: 'bg-red-100 text-red-800' },
  }

  // ─── State ───
  const [detail, setDetail] = useState<OffboardingDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [taskLoading, setTaskLoading] = useState<string | null>(null)

  // Exit interview state
  const [interview, setInterview] = useState<ExitInterviewData | null>(null)
  const [interviewLoading, setInterviewLoading] = useState(true)

  // Exit interview form state
  const [formDate, setFormDate] = useState(
    new Date().toISOString().slice(0, 10),
  )
  const [formReason, setFormReason] = useState('')
  const [formScore, setFormScore] = useState(0)
  const [formRecommend, setFormRecommend] = useState(false)
  const [formFeedback, setFormFeedback] = useState('')
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  // AI summary state
  const [aiSummary, setAiSummary] = useState<AiSummaryResult | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  // ─── Fetch offboarding detail ───
  const fetchDetail = useCallback(() => {
    setLoading(true)
    apiClient
      .get<OffboardingDetail>(`/api/v1/offboarding/dashboard/${offboardingId}`)
      .then((res) => {
        setDetail(res.data)
      })
      .catch(() => {
        apiClient
          .getList<OffboardingDetail>('/api/v1/offboarding/dashboard', {
            limit: 250,
          })
          .then((res) => {
            const found = res.data.find((d) => d.id === offboardingId)
            if (found) setDetail(found)
          })
          .catch(() => setDetail(null))
      })
      .finally(() => setLoading(false))
  }, [offboardingId])

  // ─── Fetch exit interview ───
  const fetchInterview = useCallback(() => {
    setInterviewLoading(true)
    apiClient
      .get<ExitInterviewData | null>(
        `/api/v1/offboarding/${offboardingId}/exit-interview`,
      )
      .then((res) => {
        setInterview(res.data)
        if (res.data?.aiSummary) {
          try {
            setAiSummary(JSON.parse(res.data.aiSummary) as AiSummaryResult)
          } catch {
            // Ignore parse error
          }
        }
      })
      .catch(() => setInterview(null))
      .finally(() => setInterviewLoading(false))
  }, [offboardingId])

  useEffect(() => {
    fetchDetail()
    fetchInterview()
  }, [fetchDetail, fetchInterview])

  // ─── Task complete handler ───
  const handleTaskComplete = useCallback(
    async (taskId: string) => {
      setTaskLoading(taskId)
      try {
        await apiClient.put(
          `/api/v1/offboarding/${offboardingId}/tasks/${taskId}/complete`,
        )
        fetchDetail()
      } catch {
        // Error handled by apiClient
      } finally {
        setTaskLoading(null)
      }
    },
    [offboardingId, fetchDetail],
  )

  // ─── Exit interview submit handler ───
  const handleInterviewSubmit = useCallback(async () => {
    if (!formReason || formScore === 0 || !formFeedback.trim()) {
      setFormError(t('requiredFields'))
      return
    }
    setFormError('')
    setFormSubmitting(true)
    try {
      const body = {
        interviewDate: new Date(formDate).toISOString(),
        primaryReason: formReason,
        satisfactionScore: formScore,
        wouldRecommend: formRecommend,
        feedbackText: formFeedback,
      }
      await apiClient.post(
        `/api/v1/offboarding/${offboardingId}/exit-interview`,
        body,
      )
      fetchInterview()
    } catch {
      setFormError(t('interviewFailed'))
    } finally {
      setFormSubmitting(false)
    }
  }, [
    offboardingId,
    formDate,
    formReason,
    formScore,
    formRecommend,
    formFeedback,
    fetchInterview,
    t,
  ])

  // ─── AI summary handler ───
  const handleAiSummary = useCallback(async () => {
    setAiLoading(true)
    try {
      const res = await apiClient.post<{ summary: AiSummaryResult }>(
        `/api/v1/offboarding/${offboardingId}/exit-interview/ai-summary`,
      )
      setAiSummary(res.data.summary)
    } catch {
      // Error handled by apiClient
    } finally {
      setAiLoading(false)
    }
  }, [offboardingId])

  // ─── Loading state ───
  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="p-6">
        <EmptyState
          title={t('notFound')}
          description={t('notFoundDesc')}
          action={{ label: t('backToList'), onClick: () => router.push('/offboarding') }}
        />
      </div>
    )
  }

  const sortedTasks = [...detail.offboardingTasks].sort(
    (a, b) => a.task.sortOrder - b.task.sortOrder,
  )
  const completedCount = sortedTasks.filter((tsk) => tsk.status === 'DONE').length
  const totalCount = sortedTasks.length
  const isInProgress = detail.status === 'IN_PROGRESS'

  return (
    <div className="space-y-6 p-6">
      {/* ─── Header ─── */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/offboarding')}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          {t('backToListShort')}
        </Button>
        <PageHeader
          title={`${detail.employee.name} — ${t('offboardingProcess')}`}
          description={`${RESIGN_TYPE_LABELS[detail.resignType] ?? detail.resignType} | ${t('lastWorkingDateLabel')}: ${new Date(detail.lastWorkingDate).toLocaleDateString('ko-KR')} | ${t('checklist')}: ${detail.checklist.name}`}
        />
      </div>

      {/* ─── Progress bar ─── */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              {t('progressCount', { completed: completedCount, total: totalCount })}
            </span>
            <Badge variant={isInProgress ? 'default' : 'secondary'}>
              {isInProgress ? t('inProgress') : detail.status === 'COMPLETED' ? t('completed') : t('cancelled')}
            </Badge>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-ctr-primary h-2.5 rounded-full transition-all"
              style={{
                width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%`,
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* ─── Tabs ─── */}
      <Tabs defaultValue="tasks">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="tasks" className="flex items-center gap-1.5">
            <ClipboardList className="h-4 w-4" />
            {t('taskListTitle')}
          </TabsTrigger>
          <TabsTrigger value="handover" className="flex items-center gap-1.5">
            <FileText className="h-4 w-4" />
            {t('handoverTab')}
          </TabsTrigger>
          <TabsTrigger value="interview" className="flex items-center gap-1.5">
            <MessageSquare className="h-4 w-4" />
            {t('interviewTab')}
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Task List */}
        <TabsContent value="tasks" className="mt-4">
          {sortedTasks.length === 0 ? (
            <EmptyState
              title={t('noTasks')}
              description={t('noTasksDesc')}
            />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('taskLabel')}</TableHead>
                    <TableHead className="w-20">{t('assigneeLabel')}</TableHead>
                    <TableHead className="w-16">{t('requiredLabel')}</TableHead>
                    <TableHead className="w-20">{t('statusLabel')}</TableHead>
                    {isInProgress && <TableHead className="w-24" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTasks.map((tsk) => (
                    <TableRow key={tsk.id}>
                      <TableCell>
                        <div>
                          <span className="text-sm font-medium">
                            {tsk.task.title}
                          </span>
                          {tsk.task.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {tsk.task.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ASSIGNEE_COLORS[tsk.task.assigneeType] ?? 'bg-gray-100 text-gray-700'}`}
                        >
                          {ASSIGNEE_LABELS[tsk.task.assigneeType] ??
                            tsk.task.assigneeType}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={tsk.task.isRequired ? 'destructive' : 'outline'}
                          className="text-xs"
                        >
                          {tsk.task.isRequired ? t('requiredTask') : t('optionalTask')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {tsk.status === 'DONE' ? (
                          <Badge variant="secondary">
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            {TASK_STATUS_LABELS[tsk.status]}
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            {TASK_STATUS_LABELS[tsk.status] ?? tsk.status}
                          </Badge>
                        )}
                      </TableCell>
                      {isInProgress && (
                        <TableCell>
                          {tsk.status === 'PENDING' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs"
                              disabled={taskLoading === tsk.id}
                              onClick={() => handleTaskComplete(tsk.id)}
                            >
                              {taskLoading === tsk.id ? t('processing') : t('completeBtn')}
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Tab 2: Handover */}
        <TabsContent value="handover" className="mt-4">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('handoverPerson')}</CardTitle>
              </CardHeader>
              <CardContent>
                {detail.handoverTo ? (
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ctr-primary/10">
                      <User className="h-5 w-5 text-ctr-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{detail.handoverTo.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('handoverAssigned')}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t('noHandoverPerson')}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('handoverDocuments')}</CardTitle>
                <CardDescription>
                  {t('handoverDocumentsDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
                  <Upload className="h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {t('fileUploadPending')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('fileUploadNote')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 3: Exit Interview */}
        <TabsContent value="interview" className="mt-4">
          {interviewLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-48 w-full" />
            </div>
          ) : interview ? (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('interviewResult')}</CardTitle>
                  <CardDescription>
                    {new Date(interview.interviewDate).toLocaleDateString(
                      'ko-KR',
                    )}{' '}
                    | {t('interviewer')}: {interview.interviewer.name}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      {t('primaryReason')}
                    </Label>
                    <p className="font-medium">
                      {EXIT_REASON_LABELS[interview.primaryReason] ??
                        interview.primaryReason}
                    </p>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">
                      {t('satisfactionScore')}
                    </Label>
                    <div className="flex items-center gap-1 mt-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          className={`h-5 w-5 ${
                            n <= interview.satisfactionScore
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                      <span className="ml-2 text-sm text-muted-foreground">
                        ({interview.satisfactionScore}/5)
                      </span>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">
                      {t('wouldRecommend')}
                    </Label>
                    <p className="font-medium">
                      {interview.wouldRecommend === null
                        ? t('wouldRecommendNa')
                        : interview.wouldRecommend
                          ? t('wouldRecommendYes')
                          : t('wouldRecommendNo')}
                    </p>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">
                      {t('feedbackText')}
                    </Label>
                    <p className="mt-1 text-sm whitespace-pre-wrap rounded-md bg-gray-50 p-3">
                      {interview.feedbackText}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* AI Summary section */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Bot className="h-4 w-4" />
                      {t('aiAnalysis')}
                    </CardTitle>
                    {!aiSummary && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleAiSummary}
                        disabled={aiLoading}
                      >
                        {aiLoading ? t('aiAnalyzing') : t('startAiAnalysis')}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {aiLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  ) : aiSummary ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{t('sentimentAnalysis')}</span>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            SENTIMENT_BADGE[aiSummary.sentiment]?.className ??
                            'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {SENTIMENT_BADGE[aiSummary.sentiment]?.label ??
                            aiSummary.sentiment}
                        </span>
                      </div>

                      {aiSummary.key_issues.length > 0 && (
                        <div>
                          <Label className="text-xs text-muted-foreground">
                            {t('keyIssues')}
                          </Label>
                          <ul className="mt-1 space-y-1">
                            {aiSummary.key_issues.map((issue, idx) => (
                              <li
                                key={idx}
                                className="text-sm flex items-start gap-2"
                              >
                                <span className="text-ctr-accent mt-0.5">
                                  &bull;
                                </span>
                                {issue}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div>
                        <Label className="text-xs text-muted-foreground">
                          {t('retentionInsight')}
                        </Label>
                        <p className="mt-1 text-sm">
                          {aiSummary.retention_insight}
                        </p>
                      </div>

                      {aiSummary.action_needed && (
                        <div>
                          <Label className="text-xs text-muted-foreground">
                            {t('actionNeeded')}
                          </Label>
                          <p className="mt-1 text-sm font-medium text-ctr-accent">
                            {aiSummary.action_needed}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t('aiAnalysisDesc')}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('interviewForm')}</CardTitle>
                <CardDescription>
                  {t('interviewFormDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {formError && (
                  <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                    {formError}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="interview-date">{t('interviewDate')} *</Label>
                  <Input
                    id="interview-date"
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>{t('interviewer')}</Label>
                  <Input value={user.name} disabled />
                </div>

                <div className="space-y-1.5">
                  <Label>{t('primaryReason')} *</Label>
                  <Select value={formReason} onValueChange={setFormReason}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('selectReason')} />
                    </SelectTrigger>
                    <SelectContent>
                      {EXIT_REASONS.map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>{t('satisfactionScore')} *</Label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setFormScore(n)}
                        className="p-0.5 rounded hover:bg-gray-100 transition-colors"
                      >
                        <Star
                          className={`h-7 w-7 ${
                            n <= formScore
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-300'
                          }`}
                        />
                      </button>
                    ))}
                    {formScore > 0 && (
                      <span className="ml-2 text-sm text-muted-foreground">
                        ({formScore}/5)
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="recommend-switch">{t('wouldRecommend')}</Label>
                  <Switch
                    id="recommend-switch"
                    checked={formRecommend}
                    onCheckedChange={setFormRecommend}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="feedback-text">{t('feedbackText')} *</Label>
                  <Textarea
                    id="feedback-text"
                    placeholder={t('interviewFormDesc')}
                    rows={5}
                    value={formFeedback}
                    onChange={(e) => setFormFeedback(e.target.value)}
                  />
                </div>

                <Button
                  className="w-full bg-ctr-primary hover:bg-ctr-primary/90"
                  disabled={formSubmitting}
                  onClick={handleInterviewSubmit}
                >
                  {formSubmitting ? t('submittingInterview') : t('submitInterview')}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
