'use client'

import { toast } from '@/hooks/use-toast'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Interview List + Evaluation Modal
// 면접 일정 목록 + 평가 모달
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { format } from 'date-fns'
import {
  ArrowLeft,
  Plus,
  Calendar,
  ClipboardCheck,
  Loader2,
} from 'lucide-react'
import { apiClient } from '@/lib/api'
import { InterviewCalendarScheduler } from '@/components/recruitment/InterviewCalendarScheduler'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import type { DataTableColumn } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { SessionUser, PaginationInfo } from '@/types'
import { STATUS_BG, STATUS_FG } from '@/lib/styles/status'
import { useSubmitGuard } from '@/hooks/useSubmitGuard'

// ─── Types ──────────────────────────────────────────────────

interface InterviewRow {
  id: string
  scheduledAt: string
  durationMinutes: number
  interviewType: string | null
  round: string | null
  status: string
  location: string | null
  meetingLink: string | null
  calendarEventId: string | null
  teamsAutoScheduled: boolean
  application: {
    id: string
    applicant: {
      id: string
      name: string
    }
  }
  interviewer: {
    id: string
    name: string
  }
  interviewEvaluations: EvaluationRow[]
}

interface EvaluationRow {
  id: string
  overallScore: number
  recommendation: string
}

interface EvalDetailItem {
  id: string
  overallScore: number
  competencyScores: Record<string, number>
  strengths: string | null
  concerns: string | null
  recommendation: string
  comment: string | null
  submittedAt: string
  evaluator: { id: string; name: string }
}

interface EvalDetailData {
  interviewerName: string
  applicantName: string
  scheduledAt: string
  evaluations: EvalDetailItem[]
}

// ─── Constants ──────────────────────────────────────────────

const INTERVIEW_TYPE_KEYS: Record<string, string> = {
  PHONE: 'typePHONE',
  VIDEO: 'typeVIDEO',
  ONSITE: 'typeONSITE',
  PANEL: 'typePANEL',
}

const ROUND_KEYS: Record<string, string> = {
  FIRST: 'roundFIRST',
  SECOND: 'roundSECOND',
  FINAL: 'roundFINAL',
}

const STATUS_KEYS: Record<string, string> = {
  SCHEDULED: 'interviewStatusSCHEDULED',
  COMPLETED: 'interviewStatusCOMPLETED',
  CANCELLED: 'interviewStatusCANCELLED',
  NO_SHOW: 'interviewStatusNO_SHOW',
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  SCHEDULED: { bg: STATUS_BG.info, text: STATUS_FG.info },
  COMPLETED: { bg: STATUS_BG.success, text: STATUS_FG.success },
  CANCELLED: { bg: STATUS_BG.error, text: STATUS_FG.error },
  NO_SHOW: { bg: STATUS_BG.warning, text: STATUS_FG.warning },
}

const RECOMMENDATION_KEYS: Record<string, string> = {
  STRONG_YES: 'recSTRONG_YES',
  YES: 'recYES',
  NEUTRAL: 'recNEUTRAL',
  NO: 'recNO',
  STRONG_NO: 'recSTRONG_NO',
}

const RECOMMENDATION_COLORS: Record<string, { bg: string; text: string }> = {
  STRONG_YES: { bg: 'hsl(var(--primary) / 0.08)', text: '#5E81F4' },
  YES: { bg: 'hsl(var(--primary) / 0.08)', text: '#5E81F4' },
  NEUTRAL: { bg: '#FFF3E0', text: '#FF9800' },
  NO: { bg: '#FFEBEE', text: '#F44336' },
  STRONG_NO: { bg: '#FFEBEE', text: '#F44336' },
}

// ─── Evaluation Modal ───────────────────────────────────────

interface EvalFormState {
  overallScore: number
  jobCompetency: number
  communication: number
  cultureFit: number
  strengths: string
  concerns: string
  recommendation: string
  comment: string
}

const INITIAL_EVAL: EvalFormState = {
  overallScore: 3,
  jobCompetency: 3,
  communication: 3,
  cultureFit: 3,
  strengths: '',
  concerns: '',
  recommendation: 'NEUTRAL',
  comment: '',
}

function ScoreSelect({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <Label style={{ minWidth: 100, fontSize: 14, color: 'hsl(var(--foreground))' }}>
        {label}
      </Label>
      <div style={{ display: 'flex', gap: 4 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              border: n === value ? '2px solid #5E81F4' : '1px solid #E8E8E8',
              background: n === value ? '#EDF1FE' : '#FFFFFF',
              color: n === value ? '#5E81F4' : '#666',
              fontWeight: n === value ? 700 : 400,
              fontSize: 14,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

function EvaluationModal({
  open,
  onOpenChange,
  interview,
  userId,
  onSubmitted,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  interview: InterviewRow | null
  userId: string
  onSubmitted: () => void
}) {
  const t = useTranslations('recruitment')
  const [form, setForm] = useState<EvalFormState>(INITIAL_EVAL)
  const [submitting, setSubmitting] = useState(false)

  const updateField = <K extends keyof EvalFormState>(
    key: K,
    value: EvalFormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async () => {
    if (!interview) return
    setSubmitting(true)
    try {
      await apiClient.post(`/api/v1/recruitment/interviews/${interview.id}/evaluate`, {
        evaluatorId: userId,
        overallScore: form.overallScore,
        competencyScores: {
          ['직무역량']: form.jobCompetency,
          ['커뮤니케이션']: form.communication,
          ['문화적합']: form.cultureFit,
        },
        strengths: form.strengths || null,
        concerns: form.concerns || null,
        recommendation: form.recommendation,
        comment: form.comment || null,
      })
      setForm(INITIAL_EVAL)
      onOpenChange(false)
      onSubmitted()
    } catch {
      // Error handled by apiClient
    } finally {
      setSubmitting(false)
    }
  }

  const { guardedSubmit } = useSubmitGuard(handleSubmit)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        style={{ maxWidth: 560, borderRadius: 16, padding: 0 }}
      >
        <DialogHeader style={{ padding: '24px 24px 0' }}>
          <DialogTitle style={{ fontSize: 18, fontWeight: 700, color: 'hsl(var(--foreground))' }}>
            {'면접 평가'}
          </DialogTitle>
          {interview && (
            <p style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))', marginTop: 4 }}>
              {interview.application.applicant.name} ·{' '}
              {ROUND_KEYS[interview.round ?? ''] ? t(ROUND_KEYS[interview.round ?? '']) : '-'} ·{' '}
              {format(new Date(interview.scheduledAt), 'yyyy-MM-dd HH:mm')}
            </p>
          )}
        </DialogHeader>

        <div
          style={{
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            maxHeight: 480,
            overflowY: 'auto',
          }}
        >
          <ScoreSelect
            label={'종합 점수'}
            value={form.overallScore}
            onChange={(v) => updateField('overallScore', v)}
          />

          <div
            style={{
              borderTop: '1px solid #E8E8E8',
              paddingTop: 16,
            }}
          >
            <p
              style={{
                fontSize: 12,
                color: 'hsl(var(--muted-foreground))',
                fontWeight: 600,
                marginBottom: 12,
              }}
            >
              {'역량별 점수'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <ScoreSelect
                label={'직무역량'}
                value={form.jobCompetency}
                onChange={(v) => updateField('jobCompetency', v)}
              />
              <ScoreSelect
                label={'커뮤니케이션'}
                value={form.communication}
                onChange={(v) => updateField('communication', v)}
              />
              <ScoreSelect
                label={'문화적합'}
                value={form.cultureFit}
                onChange={(v) => updateField('cultureFit', v)}
              />
            </div>
          </div>

          <div>
            <Label style={{ fontSize: 14, color: 'hsl(var(--foreground))' }}>{'강점'}</Label>
            <Textarea
              value={form.strengths}
              onChange={(e) => updateField('strengths', e.target.value)}
              placeholder={'지원자의 강점을 입력하세요'}
              rows={2}
              style={{ marginTop: 6 }}
            />
          </div>

          <div>
            <Label style={{ fontSize: 14, color: 'hsl(var(--foreground))' }}>{'우려사항'}</Label>
            <Textarea
              value={form.concerns}
              onChange={(e) => updateField('concerns', e.target.value)}
              placeholder={'우려 사항이 있다면 입력하세요'}
              rows={2}
              style={{ marginTop: 6 }}
            />
          </div>

          <div>
            <Label style={{ fontSize: 14, color: 'hsl(var(--foreground))', marginBottom: 8, display: 'block' }}>
              {'추천'}
            </Label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(
                Object.entries(RECOMMENDATION_KEYS) as [string, string][]
              ).map(([key, tKey]) => {
                const colors = RECOMMENDATION_COLORS[key] ?? {
                  bg: 'hsl(var(--muted))',
                  text: '#999',
                }
                const isActive = form.recommendation === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => updateField('recommendation', key)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 4,
                      border: isActive
                        ? `2px solid ${colors.text}`
                        : '1px solid #E8E8E8',
                      background: isActive ? colors.bg : '#FFFFFF',
                      color: isActive ? colors.text : '#666',
                      fontSize: 13,
                      fontWeight: isActive ? 600 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {t(tKey)}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <Label style={{ fontSize: 14, color: 'hsl(var(--foreground))' }}>{'코멘트'}</Label>
            <Textarea
              value={form.comment}
              onChange={(e) => updateField('comment', e.target.value)}
              placeholder={'추가 코멘트'}
              rows={2}
              style={{ marginTop: 6 }}
            />
          </div>
        </div>

        <DialogFooter style={{ padding: '16px 24px', borderTop: '1px solid #E8E8E8' }}>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            style={{ borderRadius: 8 }}
          >
            {'취소'}
          </Button>
          <Button
            onClick={guardedSubmit}
            disabled={submitting}
            style={{
              borderRadius: 8,
              backgroundColor: '#5E81F4',
              color: '#FFFFFF',
            }}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {'평가 제출'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Component ─────────────────────────────────────────

export function InterviewListClient({
  user,
  postingId,
}: {
  user: SessionUser
  postingId: string
}) {
  const router = useRouter()
  const t = useTranslations('recruitment')
  const [interviews, setInterviews] = useState<InterviewRow[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | undefined>()
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [page, setPage] = useState(1)

  // Evaluation modal
  const [evalOpen, setEvalOpen] = useState(false)
  const [evalTarget, setEvalTarget] = useState<InterviewRow | null>(null)

  // Evaluation read-only detail view
  const [evalDetailOpen, setEvalDetailOpen] = useState(false)
  const [evalDetailData, setEvalDetailData] = useState<EvalDetailData | null>(null)
  const [evalDetailLoading, setEvalDetailLoading] = useState(false)

  // ─── Options (use t() for labels) ─────────────────────
  const STATUS_OPTIONS = [
    { value: 'ALL', label: '전체 상태' },
    { value: 'SCHEDULED', label: '예정' },
    { value: 'COMPLETED', label: '완료' },
    { value: 'CANCELLED', label: '취소' },
    { value: 'NO_SHOW', label: '불참' },
  ]

  const fetchInterviews = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number | undefined> = {
        postingId,
        page,
        limit: 20,
      }
      if (statusFilter !== 'ALL') {
        params.status = statusFilter
      }
      const res = await apiClient.getList<InterviewRow>(
        '/api/v1/recruitment/interviews',
        params,
      )
      setInterviews(res.data)
      setPagination(res.pagination)
    } catch {
      // Error handled by apiClient
    } finally {
      setLoading(false)
    }
  }, [postingId, page, statusFilter])

  useEffect(() => {
    void fetchInterviews()
  }, [fetchInterviews])

  const handleOpenEval = async (row: InterviewRow) => {
    const evalCount = row.interviewEvaluations?.length ?? 0
    if (evalCount > 0) {
      // 평가가 있으면 읽기 전용 뷰
      setEvalDetailLoading(true)
      setEvalDetailOpen(true)
      try {
        const res = await apiClient.get<{
          interviewer: { name: string }
          application: { applicant: { name: string } }
          scheduledAt: string
          interviewEvaluations: EvalDetailItem[]
        }>(`/api/v1/recruitment/interviews/${row.id}`)
        setEvalDetailData({
          interviewerName: res.data.interviewer.name,
          applicantName: res.data.application.applicant.name,
          scheduledAt: res.data.scheduledAt,
          evaluations: res.data.interviewEvaluations,
        })
      } catch (err) {
        toast({ title: '평가 조회 실패', description: err instanceof Error ? err.message : '다시 시도해 주세요.', variant: 'destructive' })
        setEvalDetailOpen(false)
      } finally {
        setEvalDetailLoading(false)
      }
    } else {
      // 평가가 없으면 작성 모달
      setEvalTarget(row)
      setEvalOpen(true)
    }
  }

  const columns: DataTableColumn<InterviewRow>[] = [
    {
      key: 'applicantName',
      header: '지원자',
      render: (row) => (
        <span style={{ fontWeight: 500, color: 'hsl(var(--foreground))' }}>
          {row.application.applicant.name}
        </span>
      ),
    },
    {
      key: 'interviewerName',
      header: '면접관',
      render: (row) => (
        <span className="text-foreground">{row.interviewer.name}</span>
      ),
    },
    {
      key: 'scheduledAt',
      header: '일시',
      sortable: true,
      render: (row) => (
        <span className="text-foreground text-sm">
          {format(new Date(row.scheduledAt), 'yyyy-MM-dd HH:mm')}
        </span>
      ),
    },
    {
      key: 'durationMinutes',
      header: '소요시간',
      render: (row) => (
        <span className="text-muted-foreground text-sm">
          {t('durationMinutes', { minutes: row.durationMinutes })}
        </span>
      ),
    },
    {
      key: 'interviewType',
      header: '유형',
      render: (row) => (
        <span className="text-foreground text-sm">
          {row.interviewType
            ? INTERVIEW_TYPE_KEYS[row.interviewType] ? t(INTERVIEW_TYPE_KEYS[row.interviewType]) : row.interviewType
            : '-'}
        </span>
      ),
    },
    {
      key: 'round',
      header: '라운드',
      render: (row) => (
        <span className="text-foreground text-sm">
          {row.round ? ROUND_KEYS[row.round] ? t(ROUND_KEYS[row.round]) : row.round : '-'}
        </span>
      ),
    },
    {
      key: 'status',
      header: '상태',
      render: (row) => {
        const colors = STATUS_COLORS[row.status] ?? {
          bg: STATUS_BG.neutral,
          text: STATUS_FG.neutral,
        }
        return (
          <span
            style={{
              display: 'inline-block',
              padding: '2px 10px',
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 600,
              backgroundColor: colors.bg,
              color: colors.text,
            }}
          >
            {STATUS_KEYS[row.status] ? t(STATUS_KEYS[row.status]) : row.status}
          </span>
        )
      },
    },
    {
      key: 'calendar',
      header: '캘린더',
      render: (row) => {
        if (row.status === 'CANCELLED') return <span className="text-muted-foreground/60 text-xs">&mdash;</span>
        return (
          <InterviewCalendarScheduler
            interviewId={row.id}
            scheduledAt={row.scheduledAt}
            calendarEventId={row.calendarEventId}
            meetingLink={row.meetingLink}
            durationMinutes={row.durationMinutes}
            onScheduled={fetchInterviews}
          />
        )
      },
    },
    {
      key: 'evaluation',
      header: '평가',
      render: (row) => {
        const evalCount = row.interviewEvaluations?.length ?? 0
        if (row.status === 'COMPLETED') {
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleOpenEval(row)
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 10px',
                borderRadius: 4,
                border: 'none',
                backgroundColor: evalCount > 0 ? '#EDF1FE' : '#E3F2FD',
                color: evalCount > 0 ? '#5E81F4' : '#2196F3',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'opacity 0.15s ease',
              }}
            >
              <ClipboardCheck size={14} />
              {evalCount > 0 ? t('evalCount', { count: evalCount }) : '평가하기'}
            </button>
          )
        }
        return (
          <span className="text-muted-foreground/60 text-xs">&mdash;</span>
        )
      },
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader
        title={'면접 일정'}
        description={'채용 공고별 면접 일정 관리'}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Button
              variant="outline"
              onClick={() => router.push(`/recruitment/${postingId}`)}
              style={{ borderRadius: 8 }}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {'공고로 돌아가기'}
            </Button>
            <Button
              onClick={() =>
                router.push(`/recruitment/${postingId}/interviews/new`)
              }
              style={{
                borderRadius: 8,
                backgroundColor: '#5E81F4',
                color: '#FFFFFF',
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              {'면접 등록'}
            </Button>
          </div>
        }
      />

      {/* Filter */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Calendar size={16} className="text-muted-foreground/60" />
        <Select
          value={statusFilter}
          onValueChange={(val) => {
            setStatusFilter(val)
            setPage(1)
          }}
        >
          <SelectTrigger style={{ width: 160, borderRadius: 8 }}>
            <SelectValue placeholder={'상태 필터'} />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div
        style={{
          backgroundColor: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <DataTable
          columns={
            columns as unknown as DataTableColumn<Record<string, unknown>>[]
          }
          data={
            interviews as unknown as Record<string, unknown>[]
          }
          pagination={pagination}
          onPageChange={setPage}
          loading={loading}
          emptyMessage={'등록된 면접 일정이 없습니다'}
          emptyDescription={'면접 등록 버튼을 눌러 일정을 추가하세요'}
          rowKey={(row) => (row as unknown as InterviewRow).id}
        />
      </div>

      {/* Evaluation Modal (write) */}
      <EvaluationModal
        open={evalOpen}
        onOpenChange={setEvalOpen}
        interview={evalTarget}
        userId={user.employeeId}
        onSubmitted={fetchInterviews}
      />

      {/* Evaluation Detail Dialog (read-only) */}
      <Dialog open={evalDetailOpen} onOpenChange={setEvalDetailOpen}>
        <DialogContent style={{ maxWidth: 560, borderRadius: 16, padding: 0 }}>
          <DialogHeader style={{ padding: '24px 24px 0' }}>
            <DialogTitle style={{ fontSize: 18, fontWeight: 700, color: 'hsl(var(--foreground))' }}>
              {t('evalDetailTitle')}
            </DialogTitle>
            {evalDetailData && (
              <p style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))', marginTop: 4 }}>
                {evalDetailData.applicantName} · {evalDetailData.interviewerName} ·{' '}
                {format(new Date(evalDetailData.scheduledAt), 'yyyy-MM-dd HH:mm')}
              </p>
            )}
          </DialogHeader>
          <div style={{ padding: '20px 24px', maxHeight: 480, overflowY: 'auto' }}>
            {evalDetailLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : evalDetailData?.evaluations.map((ev) => (
              <div key={ev.id} className="mb-4 last:mb-0 p-4 rounded-xl bg-muted/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{ev.evaluator.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(ev.submittedAt), 'yyyy-MM-dd HH:mm')}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-sm">
                    <span className="text-muted-foreground">{t('evalOverallScore')}: </span>
                    <span className="font-bold text-foreground">{ev.overallScore}/5</span>
                  </div>
                  {ev.recommendation && (
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 10px',
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 600,
                        backgroundColor: RECOMMENDATION_COLORS[ev.recommendation]?.bg ?? '#F5F5F5',
                        color: RECOMMENDATION_COLORS[ev.recommendation]?.text ?? '#666',
                      }}
                    >
                      {RECOMMENDATION_KEYS[ev.recommendation] ? t(RECOMMENDATION_KEYS[ev.recommendation]) : ev.recommendation}
                    </span>
                  )}
                </div>
                {ev.competencyScores && Object.keys(ev.competencyScores).length > 0 && (
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(ev.competencyScores).map(([key, score]) => (
                      <span key={key} className="text-xs text-muted-foreground">
                        {key}: <span className="font-medium text-foreground">{score}/5</span>
                      </span>
                    ))}
                  </div>
                )}
                {ev.strengths && (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">{t('evalStrengths')}</span>
                    <p className="text-sm text-foreground mt-1">{ev.strengths}</p>
                  </div>
                )}
                {ev.concerns && (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">{t('evalConcerns')}</span>
                    <p className="text-sm text-foreground mt-1">{ev.concerns}</p>
                  </div>
                )}
                {ev.comment && (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">{t('evalComment')}</span>
                    <p className="text-sm text-foreground mt-1">{ev.comment}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
          <DialogFooter style={{ padding: '0 24px 24px' }}>
            <Button variant="outline" onClick={() => setEvalDetailOpen(false)} style={{ borderRadius: 8 }}>
              {t('closeButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
