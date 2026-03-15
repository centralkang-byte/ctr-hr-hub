'use client'

import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
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
  SCHEDULED: { bg: '#E3F2FD', text: '#2196F3' },
  COMPLETED: { bg: '#EDF1FE', text: '#5E81F4' },
  CANCELLED: { bg: '#F5F5F5', text: '#999999' },
  NO_SHOW: { bg: '#FFEBEE', text: '#F44336' },
}

const RECOMMENDATION_KEYS: Record<string, string> = {
  STRONG_YES: 'recSTRONG_YES',
  YES: 'recYES',
  NEUTRAL: 'recNEUTRAL',
  NO: 'recNO',
  STRONG_NO: 'recSTRONG_NO',
}

const RECOMMENDATION_COLORS: Record<string, { bg: string; text: string }> = {
  STRONG_YES: { bg: '#EDF1FE', text: '#5E81F4' },
  YES: { bg: '#EDF1FE', text: '#5E81F4' },
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
      <Label style={{ minWidth: 100, fontSize: 14, color: '#1A1A1A' }}>
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
          <DialogTitle style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A' }}>
            {'면접 평가'}
          </DialogTitle>
          {interview && (
            <p style={{ fontSize: 13, color: '#999', marginTop: 4 }}>
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
                color: '#999',
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
            <Label style={{ fontSize: 14, color: '#1A1A1A' }}>{'강점'}</Label>
            <Textarea
              value={form.strengths}
              onChange={(e) => updateField('strengths', e.target.value)}
              placeholder={'지원자의 강점을 입력하세요'}
              rows={2}
              style={{ marginTop: 6 }}
            />
          </div>

          <div>
            <Label style={{ fontSize: 14, color: '#1A1A1A' }}>{'우려사항'}</Label>
            <Textarea
              value={form.concerns}
              onChange={(e) => updateField('concerns', e.target.value)}
              placeholder={'우려 사항이 있다면 입력하세요'}
              rows={2}
              style={{ marginTop: 6 }}
            />
          </div>

          <div>
            <Label style={{ fontSize: 14, color: '#1A1A1A', marginBottom: 8, display: 'block' }}>
              {'추천'}
            </Label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(
                Object.entries(RECOMMENDATION_KEYS) as [string, string][]
              ).map(([key, tKey]) => {
                const colors = RECOMMENDATION_COLORS[key] ?? {
                  bg: '#F5F5F5',
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
            <Label style={{ fontSize: 14, color: '#1A1A1A' }}>{'코멘트'}</Label>
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

  const handleOpenEval = (row: InterviewRow) => {
    setEvalTarget(row)
    setEvalOpen(true)
  }

  const columns: DataTableColumn<InterviewRow>[] = [
    {
      key: 'applicantName',
      header: '지원자',
      render: (row) => (
        <span style={{ fontWeight: 500, color: '#1A1A1A' }}>
          {row.application.applicant.name}
        </span>
      ),
    },
    {
      key: 'interviewerName',
      header: '면접관',
      render: (row) => (
        <span style={{ color: '#1A1A1A' }}>{row.interviewer.name}</span>
      ),
    },
    {
      key: 'scheduledAt',
      header: '일시',
      sortable: true,
      render: (row) => (
        <span style={{ color: '#1A1A1A', fontSize: 14 }}>
          {format(new Date(row.scheduledAt), 'yyyy-MM-dd HH:mm')}
        </span>
      ),
    },
    {
      key: 'durationMinutes',
      header: '소요시간',
      render: (row) => (
        <span style={{ color: '#666', fontSize: 14 }}>
          {t('durationMinutes', { minutes: row.durationMinutes })}
        </span>
      ),
    },
    {
      key: 'interviewType',
      header: '유형',
      render: (row) => (
        <span style={{ color: '#1A1A1A', fontSize: 14 }}>
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
        <span style={{ color: '#1A1A1A', fontSize: 14 }}>
          {row.round ? ROUND_KEYS[row.round] ? t(ROUND_KEYS[row.round]) : row.round : '-'}
        </span>
      ),
    },
    {
      key: 'status',
      header: '상태',
      render: (row) => {
        const colors = STATUS_COLORS[row.status] ?? {
          bg: '#F5F5F5',
          text: '#999',
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
        if (row.status === 'CANCELLED') return <span style={{ color: '#999', fontSize: 12 }}>&mdash;</span>
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
          <span style={{ color: '#999', fontSize: 12 }}>&mdash;</span>
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
        <Calendar size={16} style={{ color: '#999' }} />
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
          backgroundColor: '#FFFFFF',
          border: '1px solid #E8E8E8',
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

      {/* Evaluation Modal */}
      <EvaluationModal
        open={evalOpen}
        onOpenChange={setEvalOpen}
        interview={evalTarget}
        userId={user.employeeId}
        onSubmitted={fetchInterviews}
      />
    </div>
  )
}
