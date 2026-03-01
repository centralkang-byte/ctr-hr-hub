'use client'

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
  COMPLETED: { bg: '#E8F5E9', text: '#00C853' },
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
  STRONG_YES: { bg: '#E8F5E9', text: '#00C853' },
  YES: { bg: '#E8F5E9', text: '#00C853' },
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
      <Label style={{ minWidth: 100, fontSize: 14, color: '#333' }}>
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
              border: n === value ? '2px solid #00C853' : '1px solid #E8E8E8',
              background: n === value ? '#E8F5E9' : '#FFFFFF',
              color: n === value ? '#00C853' : '#666',
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
          [t('jobCompetency')]: form.jobCompetency,
          [t('communication')]: form.communication,
          [t('cultureFit')]: form.cultureFit,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        style={{ maxWidth: 560, borderRadius: 16, padding: 0 }}
      >
        <DialogHeader style={{ padding: '24px 24px 0' }}>
          <DialogTitle style={{ fontSize: 18, fontWeight: 700, color: '#333' }}>
            {t('evaluationTitle')}
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
            label={t('overallScore')}
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
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 12,
              }}
            >
              {t('competencyScores')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <ScoreSelect
                label={t('jobCompetency')}
                value={form.jobCompetency}
                onChange={(v) => updateField('jobCompetency', v)}
              />
              <ScoreSelect
                label={t('communication')}
                value={form.communication}
                onChange={(v) => updateField('communication', v)}
              />
              <ScoreSelect
                label={t('cultureFit')}
                value={form.cultureFit}
                onChange={(v) => updateField('cultureFit', v)}
              />
            </div>
          </div>

          <div>
            <Label style={{ fontSize: 14, color: '#333' }}>{t('strengthsLabel')}</Label>
            <Textarea
              value={form.strengths}
              onChange={(e) => updateField('strengths', e.target.value)}
              placeholder={t('strengthsPlaceholder')}
              rows={2}
              style={{ marginTop: 6 }}
            />
          </div>

          <div>
            <Label style={{ fontSize: 14, color: '#333' }}>{t('concernsLabel')}</Label>
            <Textarea
              value={form.concerns}
              onChange={(e) => updateField('concerns', e.target.value)}
              placeholder={t('concernsPlaceholder')}
              rows={2}
              style={{ marginTop: 6 }}
            />
          </div>

          <div>
            <Label style={{ fontSize: 14, color: '#333', marginBottom: 8, display: 'block' }}>
              {t('recommendationLabel')}
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
            <Label style={{ fontSize: 14, color: '#333' }}>{t('commentLabel')}</Label>
            <Textarea
              value={form.comment}
              onChange={(e) => updateField('comment', e.target.value)}
              placeholder={t('commentPlaceholder')}
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
            {t('cancelButton')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              borderRadius: 8,
              backgroundColor: '#00C853',
              color: '#FFFFFF',
            }}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('submitEvaluation')}
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
    { value: 'ALL', label: t('allStatus') },
    { value: 'SCHEDULED', label: t('interviewStatusSCHEDULED') },
    { value: 'COMPLETED', label: t('interviewStatusCOMPLETED') },
    { value: 'CANCELLED', label: t('interviewStatusCANCELLED') },
    { value: 'NO_SHOW', label: t('interviewStatusNO_SHOW') },
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
      header: t('applicantColumn'),
      render: (row) => (
        <span style={{ fontWeight: 500, color: '#333' }}>
          {row.application.applicant.name}
        </span>
      ),
    },
    {
      key: 'interviewerName',
      header: t('interviewerColumn'),
      render: (row) => (
        <span style={{ color: '#333' }}>{row.interviewer.name}</span>
      ),
    },
    {
      key: 'scheduledAt',
      header: t('dateTimeColumn'),
      sortable: true,
      render: (row) => (
        <span style={{ color: '#333', fontSize: 14 }}>
          {format(new Date(row.scheduledAt), 'yyyy-MM-dd HH:mm')}
        </span>
      ),
    },
    {
      key: 'durationMinutes',
      header: t('durationColumn'),
      render: (row) => (
        <span style={{ color: '#666', fontSize: 14 }}>
          {t('durationMinutes', { minutes: row.durationMinutes })}
        </span>
      ),
    },
    {
      key: 'interviewType',
      header: t('typeColumn'),
      render: (row) => (
        <span style={{ color: '#333', fontSize: 14 }}>
          {row.interviewType
            ? INTERVIEW_TYPE_KEYS[row.interviewType] ? t(INTERVIEW_TYPE_KEYS[row.interviewType]) : row.interviewType
            : '-'}
        </span>
      ),
    },
    {
      key: 'round',
      header: t('roundColumn'),
      render: (row) => (
        <span style={{ color: '#333', fontSize: 14 }}>
          {row.round ? ROUND_KEYS[row.round] ? t(ROUND_KEYS[row.round]) : row.round : '-'}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('statusCol'),
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
      header: t('calendarColumn'),
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
      header: t('evaluationColumn'),
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
                backgroundColor: evalCount > 0 ? '#E8F5E9' : '#E3F2FD',
                color: evalCount > 0 ? '#00C853' : '#2196F3',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'opacity 0.15s ease',
              }}
            >
              <ClipboardCheck size={14} />
              {evalCount > 0 ? t('evalCount', { count: evalCount }) : t('evaluateButton')}
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
        title={t('interviewListTitle')}
        description={t('interviewListDescription')}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Button
              variant="outline"
              onClick={() => router.push(`/recruitment/${postingId}`)}
              style={{ borderRadius: 8 }}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('backToPosting')}
            </Button>
            <Button
              onClick={() =>
                router.push(`/recruitment/${postingId}/interviews/new`)
              }
              style={{
                borderRadius: 8,
                backgroundColor: '#00C853',
                color: '#FFFFFF',
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t('registerInterviewButton')}
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
            <SelectValue placeholder={t('statusFilter')} />
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
          emptyMessage={t('noInterviews')}
          emptyDescription={t('noInterviewsDescription')}
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
