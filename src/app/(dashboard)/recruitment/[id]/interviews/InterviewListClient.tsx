'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Interview List + Evaluation Modal
// 면접 일정 목록 + 평가 모달
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import {
  ArrowLeft,
  Plus,
  Calendar,
  ClipboardCheck,
  Loader2,
} from 'lucide-react'
import { apiClient } from '@/lib/api'
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

const INTERVIEW_TYPE_LABELS: Record<string, string> = {
  PHONE: '전화',
  VIDEO: '화상',
  ONSITE: '대면',
  PANEL: '패널',
}

const ROUND_LABELS: Record<string, string> = {
  FIRST: '1차',
  SECOND: '2차',
  FINAL: '최종',
}

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: '예정',
  COMPLETED: '완료',
  CANCELLED: '취소',
  NO_SHOW: '불참',
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  SCHEDULED: { bg: '#E3F2FD', text: '#2196F3' },
  COMPLETED: { bg: '#E8F5E9', text: '#00C853' },
  CANCELLED: { bg: '#F5F5F5', text: '#999999' },
  NO_SHOW: { bg: '#FFEBEE', text: '#F44336' },
}

const RECOMMENDATION_LABELS: Record<string, string> = {
  STRONG_YES: '강력추천',
  YES: '추천',
  NEUTRAL: '중립',
  NO: '비추천',
  STRONG_NO: '강력비추천',
}

const RECOMMENDATION_COLORS: Record<string, { bg: string; text: string }> = {
  STRONG_YES: { bg: '#E8F5E9', text: '#00C853' },
  YES: { bg: '#E8F5E9', text: '#00C853' },
  NEUTRAL: { bg: '#FFF3E0', text: '#FF9800' },
  NO: { bg: '#FFEBEE', text: '#F44336' },
  STRONG_NO: { bg: '#FFEBEE', text: '#F44336' },
}

const STATUS_OPTIONS = [
  { value: 'ALL', label: '전체 상태' },
  { value: 'SCHEDULED', label: '예정' },
  { value: 'COMPLETED', label: '완료' },
  { value: 'CANCELLED', label: '취소' },
  { value: 'NO_SHOW', label: '불참' },
]

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
          직무역량: form.jobCompetency,
          커뮤니케이션: form.communication,
          문화적합: form.cultureFit,
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
            면접 평가
          </DialogTitle>
          {interview && (
            <p style={{ fontSize: 13, color: '#999', marginTop: 4 }}>
              {interview.application.applicant.name} ·{' '}
              {ROUND_LABELS[interview.round ?? ''] ?? '-'} ·{' '}
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
            label="종합 점수"
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
              역량별 점수
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <ScoreSelect
                label="직무역량"
                value={form.jobCompetency}
                onChange={(v) => updateField('jobCompetency', v)}
              />
              <ScoreSelect
                label="커뮤니케이션"
                value={form.communication}
                onChange={(v) => updateField('communication', v)}
              />
              <ScoreSelect
                label="문화적합"
                value={form.cultureFit}
                onChange={(v) => updateField('cultureFit', v)}
              />
            </div>
          </div>

          <div>
            <Label style={{ fontSize: 14, color: '#333' }}>강점</Label>
            <Textarea
              value={form.strengths}
              onChange={(e) => updateField('strengths', e.target.value)}
              placeholder="지원자의 강점을 입력하세요"
              rows={2}
              style={{ marginTop: 6 }}
            />
          </div>

          <div>
            <Label style={{ fontSize: 14, color: '#333' }}>우려사항</Label>
            <Textarea
              value={form.concerns}
              onChange={(e) => updateField('concerns', e.target.value)}
              placeholder="우려 사항이 있다면 입력하세요"
              rows={2}
              style={{ marginTop: 6 }}
            />
          </div>

          <div>
            <Label style={{ fontSize: 14, color: '#333', marginBottom: 8, display: 'block' }}>
              추천
            </Label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(
                Object.entries(RECOMMENDATION_LABELS) as [string, string][]
              ).map(([key, label]) => {
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
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <Label style={{ fontSize: 14, color: '#333' }}>코멘트</Label>
            <Textarea
              value={form.comment}
              onChange={(e) => updateField('comment', e.target.value)}
              placeholder="추가 코멘트"
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
            취소
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
            평가 제출
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
  const [interviews, setInterviews] = useState<InterviewRow[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | undefined>()
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [page, setPage] = useState(1)

  // Evaluation modal
  const [evalOpen, setEvalOpen] = useState(false)
  const [evalTarget, setEvalTarget] = useState<InterviewRow | null>(null)

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
        <span style={{ fontWeight: 500, color: '#333' }}>
          {row.application.applicant.name}
        </span>
      ),
    },
    {
      key: 'interviewerName',
      header: '면접관',
      render: (row) => (
        <span style={{ color: '#333' }}>{row.interviewer.name}</span>
      ),
    },
    {
      key: 'scheduledAt',
      header: '일시',
      sortable: true,
      render: (row) => (
        <span style={{ color: '#333', fontSize: 14 }}>
          {format(new Date(row.scheduledAt), 'yyyy-MM-dd HH:mm')}
        </span>
      ),
    },
    {
      key: 'durationMinutes',
      header: '소요시간',
      render: (row) => (
        <span style={{ color: '#666', fontSize: 14 }}>
          {row.durationMinutes}분
        </span>
      ),
    },
    {
      key: 'interviewType',
      header: '유형',
      render: (row) => (
        <span style={{ color: '#333', fontSize: 14 }}>
          {row.interviewType
            ? INTERVIEW_TYPE_LABELS[row.interviewType] ?? row.interviewType
            : '-'}
        </span>
      ),
    },
    {
      key: 'round',
      header: '라운드',
      render: (row) => (
        <span style={{ color: '#333', fontSize: 14 }}>
          {row.round ? ROUND_LABELS[row.round] ?? row.round : '-'}
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
            {STATUS_LABELS[row.status] ?? row.status}
          </span>
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
                backgroundColor: evalCount > 0 ? '#E8F5E9' : '#E3F2FD',
                color: evalCount > 0 ? '#00C853' : '#2196F3',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'opacity 0.15s ease',
              }}
            >
              <ClipboardCheck size={14} />
              {evalCount > 0 ? `${evalCount}건` : '평가하기'}
            </button>
          )
        }
        return (
          <span style={{ color: '#999', fontSize: 12 }}>—</span>
        )
      },
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader
        title="면접 일정"
        description="채용 공고별 면접 일정 관리"
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Button
              variant="outline"
              onClick={() => router.push(`/recruitment/${postingId}`)}
              style={{ borderRadius: 8 }}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              공고로 돌아가기
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
              면접 등록
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
            <SelectValue placeholder="상태 필터" />
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
          emptyMessage="등록된 면접 일정이 없습니다"
          emptyDescription="면접 등록 버튼을 눌러 일정을 추가하세요"
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
