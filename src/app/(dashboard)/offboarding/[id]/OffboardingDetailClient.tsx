'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Offboarding Detail Client
// 퇴직 처리 상세: 태스크 목록, 인수인계, 퇴직 면담
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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

const RESIGN_TYPE_LABELS: Record<string, string> = {
  VOLUNTARY: '자발적퇴사',
  INVOLUNTARY: '비자발적퇴사',
  RETIREMENT: '정년퇴직',
  CONTRACT_END: '계약만료',
  MUTUAL_AGREEMENT: '합의퇴사',
}

const ASSIGNEE_COLORS: Record<string, string> = {
  EMPLOYEE: 'bg-gray-100 text-gray-700',
  MANAGER: 'bg-blue-100 text-blue-700',
  HR: 'bg-green-100 text-green-700',
  IT: 'bg-purple-100 text-purple-700',
  FINANCE: 'bg-orange-100 text-orange-700',
}

const ASSIGNEE_LABELS: Record<string, string> = {
  EMPLOYEE: '직원',
  MANAGER: '매니저',
  HR: 'HR',
  IT: 'IT',
  FINANCE: '재무',
}

const TASK_STATUS_LABELS: Record<string, string> = {
  PENDING: '대기',
  DONE: '완료',
  SKIPPED: '건너뜀',
  BLOCKED: '차단',
}

const EXIT_REASON_LABELS: Record<string, string> = {
  COMPENSATION: '보상',
  CAREER_GROWTH: '경력발전',
  WORK_LIFE_BALANCE: '워라밸',
  MANAGEMENT: '관리자',
  CULTURE: '조직문화',
  RELOCATION: '이직',
  PERSONAL: '개인사유',
  OTHER: '기타',
}

const EXIT_REASONS = Object.entries(EXIT_REASON_LABELS) as [string, string][]

const SENTIMENT_BADGE: Record<string, { label: string; className: string }> = {
  POSITIVE: { label: '긍정적', className: 'bg-green-100 text-green-800' },
  NEUTRAL: { label: '중립', className: 'bg-gray-100 text-gray-800' },
  NEGATIVE: { label: '부정적', className: 'bg-red-100 text-red-800' },
}

// ─── Component ──────────────────────────────────────────────

export function OffboardingDetailClient({
  user,
  offboardingId,
}: OffboardingDetailClientProps) {
  const router = useRouter()

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
        // If the dashboard single endpoint doesn't exist, fall back to dashboard list
        setDetail(res.data)
      })
      .catch(() => {
        // Fallback: fetch from list endpoint and find matching
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
        // Parse existing AI summary
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
      setFormError('필수 항목을 모두 입력해주세요.')
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
      setFormError('퇴직 면담 등록에 실패했습니다.')
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
          title="퇴직 처리를 찾을 수 없습니다"
          description="요청한 퇴직 처리 기록이 존재하지 않거나 접근 권한이 없습니다."
          action={{ label: '목록으로', onClick: () => router.push('/offboarding') }}
        />
      </div>
    )
  }

  const sortedTasks = [...detail.offboardingTasks].sort(
    (a, b) => a.task.sortOrder - b.task.sortOrder,
  )
  const completedCount = sortedTasks.filter((t) => t.status === 'DONE').length
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
          목록
        </Button>
        <PageHeader
          title={`${detail.employee.name} — 퇴직 처리`}
          description={`${RESIGN_TYPE_LABELS[detail.resignType] ?? detail.resignType} | 최종근무일: ${new Date(detail.lastWorkingDate).toLocaleDateString('ko-KR')} | 체크리스트: ${detail.checklist.name}`}
        />
      </div>

      {/* ─── Progress bar ─── */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              진행률 {completedCount}/{totalCount}
            </span>
            <Badge variant={isInProgress ? 'default' : 'secondary'}>
              {isInProgress ? '진행 중' : detail.status === 'COMPLETED' ? '완료' : '취소'}
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
            태스크 목록
          </TabsTrigger>
          <TabsTrigger value="handover" className="flex items-center gap-1.5">
            <FileText className="h-4 w-4" />
            인수인계
          </TabsTrigger>
          <TabsTrigger value="interview" className="flex items-center gap-1.5">
            <MessageSquare className="h-4 w-4" />
            퇴직 면담
          </TabsTrigger>
        </TabsList>

        {/* ═══ Tab 1: 태스크 목록 ═══ */}
        <TabsContent value="tasks" className="mt-4">
          {sortedTasks.length === 0 ? (
            <EmptyState
              title="태스크가 없습니다"
              description="이 퇴직 처리에 등록된 태스크가 없습니다."
            />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>태스크</TableHead>
                    <TableHead className="w-20">담당</TableHead>
                    <TableHead className="w-16">필수</TableHead>
                    <TableHead className="w-20">상태</TableHead>
                    {isInProgress && <TableHead className="w-24" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTasks.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <div>
                          <span className="text-sm font-medium">
                            {t.task.title}
                          </span>
                          {t.task.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {t.task.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ASSIGNEE_COLORS[t.task.assigneeType] ?? 'bg-gray-100 text-gray-700'}`}
                        >
                          {ASSIGNEE_LABELS[t.task.assigneeType] ??
                            t.task.assigneeType}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={t.task.isRequired ? 'destructive' : 'outline'}
                          className="text-xs"
                        >
                          {t.task.isRequired ? '필수' : '선택'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {t.status === 'DONE' ? (
                          <Badge variant="secondary">
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            {TASK_STATUS_LABELS[t.status]}
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            {TASK_STATUS_LABELS[t.status] ?? t.status}
                          </Badge>
                        )}
                      </TableCell>
                      {isInProgress && (
                        <TableCell>
                          {t.status === 'PENDING' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs"
                              disabled={taskLoading === t.id}
                              onClick={() => handleTaskComplete(t.id)}
                            >
                              {taskLoading === t.id ? '처리 중...' : '완료'}
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

        {/* ═══ Tab 2: 인수인계 ═══ */}
        <TabsContent value="handover" className="mt-4">
          <div className="space-y-4">
            {/* Handover To info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">인수인계 담당자</CardTitle>
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
                        인수인계 담당으로 지정됨
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    인수인계 담당자가 지정되지 않았습니다.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* File upload placeholder */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">인수인계 문서</CardTitle>
                <CardDescription>
                  인수인계 관련 문서를 업로드합니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
                  <Upload className="h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    파일 업로드 기능은 추후 업데이트 예정입니다.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    (Task 12에서 S3 presigned URL 연동)
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══ Tab 3: 퇴직 면담 ═══ */}
        <TabsContent value="interview" className="mt-4">
          {interviewLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-48 w-full" />
            </div>
          ) : interview ? (
            /* ─── Interview results (read-only) ─── */
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">퇴직 면담 결과</CardTitle>
                  <CardDescription>
                    {new Date(interview.interviewDate).toLocaleDateString(
                      'ko-KR',
                    )}{' '}
                    | 면담자: {interview.interviewer.name}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Primary reason */}
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      주요 퇴사 사유
                    </Label>
                    <p className="font-medium">
                      {EXIT_REASON_LABELS[interview.primaryReason] ??
                        interview.primaryReason}
                    </p>
                  </div>

                  {/* Satisfaction score */}
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      만족도
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

                  {/* Would recommend */}
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      추천 의향
                    </Label>
                    <p className="font-medium">
                      {interview.wouldRecommend === null
                        ? '미응답'
                        : interview.wouldRecommend
                          ? '있음'
                          : '없음'}
                    </p>
                  </div>

                  {/* Feedback text */}
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      의견
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
                      AI 분석
                    </CardTitle>
                    {!aiSummary && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleAiSummary}
                        disabled={aiLoading}
                      >
                        {aiLoading ? '분석 중...' : 'AI 분석 시작'}
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
                      {/* Sentiment badge */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">감정 분석:</span>
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

                      {/* Key issues */}
                      {aiSummary.key_issues.length > 0 && (
                        <div>
                          <Label className="text-xs text-muted-foreground">
                            핵심 이슈
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

                      {/* Retention insight */}
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          리텐션 인사이트
                        </Label>
                        <p className="mt-1 text-sm">
                          {aiSummary.retention_insight}
                        </p>
                      </div>

                      {/* Action needed */}
                      {aiSummary.action_needed && (
                        <div>
                          <Label className="text-xs text-muted-foreground">
                            필요 조치
                          </Label>
                          <p className="mt-1 text-sm font-medium text-ctr-accent">
                            {aiSummary.action_needed}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      AI 분석을 실행하면 퇴직 면담 결과를 자동으로 요약합니다.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            /* ─── Interview form (create) ─── */
            <Card>
              <CardHeader>
                <CardTitle className="text-base">퇴직 면담 등록</CardTitle>
                <CardDescription>
                  퇴직 면담 내용을 기록합니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {formError && (
                  <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                    {formError}
                  </div>
                )}

                {/* 면담 일자 */}
                <div className="space-y-1.5">
                  <Label htmlFor="interview-date">면담 일자 *</Label>
                  <Input
                    id="interview-date"
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                  />
                </div>

                {/* 면담자 */}
                <div className="space-y-1.5">
                  <Label>면담자</Label>
                  <Input value={user.name} disabled />
                </div>

                {/* 주요 퇴사 사유 */}
                <div className="space-y-1.5">
                  <Label>주요 퇴사 사유 *</Label>
                  <Select value={formReason} onValueChange={setFormReason}>
                    <SelectTrigger>
                      <SelectValue placeholder="사유를 선택하세요" />
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

                {/* 만족도 */}
                <div className="space-y-1.5">
                  <Label>만족도 *</Label>
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

                {/* 추천 의향 */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="recommend-switch">추천 의향</Label>
                  <Switch
                    id="recommend-switch"
                    checked={formRecommend}
                    onCheckedChange={setFormRecommend}
                  />
                </div>

                {/* 의견 */}
                <div className="space-y-1.5">
                  <Label htmlFor="feedback-text">의견 *</Label>
                  <Textarea
                    id="feedback-text"
                    placeholder="퇴직 면담 내용을 상세히 기록해주세요."
                    rows={5}
                    value={formFeedback}
                    onChange={(e) => setFormFeedback(e.target.value)}
                  />
                </div>

                {/* Submit */}
                <Button
                  className="w-full bg-ctr-primary hover:bg-ctr-primary/90"
                  disabled={formSubmitting}
                  onClick={handleInterviewSubmit}
                >
                  {formSubmitting ? '등록 중...' : '퇴직 면담 등록'}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
