'use client'

import { useTranslations } from 'next-intl'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — ATS 스윔레인 칸반 보드 (Client)
// 공고별 가로 스윔레인 + 단계별 세로 컬럼
// DnD: HTML5 네이티브 — 스윔레인 간 이동 엄격 차단
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  X,
  Loader2,
  LayoutGrid,
  ChevronRight,
  Users,
  GripVertical,
} from 'lucide-react'
import { format } from 'date-fns'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import { MODAL_STYLES } from '@/lib/styles'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/hooks/use-toast'

// ─── Constants ──────────────────────────────────────────

const STAGES = [
  'APPLIED',
  'SCREENING',
  'INTERVIEW_1',
  'INTERVIEW_2',
  'FINAL',
  'OFFER',
  'HIRED',
] as const

type StageType = (typeof STAGES)[number]

const STAGE_LABELS: Record<string, string> = {
  APPLIED: '지원',
  SCREENING: '서류검토',
  INTERVIEW_1: '1차 면접',
  INTERVIEW_2: '2차 면접',
  FINAL: '최종 면접',
  OFFER: '오퍼',
  HIRED: '채용 확정',
}

const STAGE_ACCENT: Record<string, string> = {
  APPLIED: '#8181A5',
  SCREENING: '#4F46E5',
  INTERVIEW_1: '#4F46E5',
  INTERVIEW_2: '#4F46E5',
  FINAL: '#F4BE5E',
  OFFER: '#4F46E5',
  HIRED: '#059669',
}

// ─── Types ──────────────────────────────────────────────

interface ApplicantInfo {
  id: string
  name: string
  email: string
  phone: string | null
  source: string
  portfolioUrl: string | null
}

interface ApplicationRecord {
  id: string
  postingId: string
  stage: string
  aiScreeningScore: number | null
  aiScreeningSummary: string | null
  rejectionReason: string | null
  offeredSalary: number | null
  offeredDate: string | null
  expectedStartDate: string | null
  appliedAt: string
  updatedAt: string
  applicant: ApplicantInfo
}

interface PostingWithApplications {
  id: string
  title: string
  headcount: number
  department: { id: string; name: string } | null
  applications: ApplicationRecord[]
}

interface OfferFormData {
  offeredSalary: string
  offeredDate: string
  expectedStartDate: string
}

interface Props {
  user: SessionUser
}

// ─── Component ──────────────────────────────────────────

export default function BoardClient({ user }: Props) {
  const tCommon = useTranslations('common')
  const t = useTranslations('recruitment')
  const router = useRouter()
  const [postings, setPostings] = useState<PostingWithApplications[]>([])
  const [loading, setLoading] = useState(true)

  // DnD state — carries the source posting ID to enforce swimlane scoping
  const [draggingApplicationId, setDraggingApplicationId] = useState<string | null>(null)
  const [draggingPostingId, setDraggingPostingId] = useState<string | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null) // `${postingId}:${stage}`

  // Modals
  const [rejectionModal, setRejectionModal] = useState<{
    open: boolean
    applicationId: string
    postingId: string
    reason: string
  }>({ open: false, applicationId: '', postingId: '', reason: '' })

  const [offerModal, setOfferModal] = useState<{
    open: boolean
    applicationId: string
    postingId: string
    form: OfferFormData
  }>({
    open: false,
    applicationId: '',
    postingId: '',
    form: { offeredSalary: '', offeredDate: '', expectedStartDate: '' },
  })

  const [modalSubmitting, setModalSubmitting] = useState(false)

  void user

  // ─── Fetch data ────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<{ postings: PostingWithApplications[] }>(
        '/api/v1/recruitment/board',
      )
      setPostings(res.data.postings ?? [])
    } catch {
      // silently handled
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ─── Helpers ────────────────────────────────────────

  const getApplicationsByStage = (
    applications: ApplicationRecord[],
    stage: string,
  ) => applications.filter((a) => a.stage === stage)

  const getAiScoreBadge = (score: number | null) => {
    if (score === null) return null
    let style = 'bg-[#FEE2E2] text-[#B91C1C]'
    if (score >= 80) style = 'bg-[#D1FAE5] text-[#065F46]'
    else if (score >= 50) style = 'bg-[#FEF3C7] text-[#B45309]'
    return (
      <span className={`inline-block px-1.5 py-0.5 text-[10px] font-semibold rounded ${style}`}>
        AI {score}
      </span>
    )
  }

  // ─── DnD Handlers ───────────────────────────────────
  // CRITICAL: draggingPostingId is set on dragStart and verified on drop.
  // Columns only accept drops from the SAME swimlane (same postingId).

  const handleDragStart = (
    e: React.DragEvent,
    applicationId: string,
    postingId: string,
  ) => {
    // Store both IDs in dataTransfer for cross-event access
    e.dataTransfer.setData('application-id', applicationId)
    e.dataTransfer.setData('posting-id', postingId)
    e.dataTransfer.effectAllowed = 'move'
    setDraggingApplicationId(applicationId)
    setDraggingPostingId(postingId)
  }

  const handleDragEnd = () => {
    setDraggingApplicationId(null)
    setDraggingPostingId(null)
    setDragOverKey(null)
  }

  const handleDragOver = (
    e: React.DragEvent,
    postingId: string,
    stage: string,
  ) => {
    // Only allow drop if from the same swimlane
    if (draggingPostingId !== postingId) {
      e.dataTransfer.dropEffect = 'none'
      return
    }
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverKey(`${postingId}:${stage}`)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    const related = e.relatedTarget as HTMLElement | null
    const current = e.currentTarget as HTMLElement
    if (!related || !current.contains(related)) {
      setDragOverKey(null)
    }
  }

  const handleDrop = async (
    e: React.DragEvent,
    targetPostingId: string,
    targetStage: StageType,
  ) => {
    e.preventDefault()
    setDragOverKey(null)
    setDraggingApplicationId(null)
    setDraggingPostingId(null)

    const applicationId = e.dataTransfer.getData('application-id')
    const sourcePostingId = e.dataTransfer.getData('posting-id')

    if (!applicationId || !sourcePostingId) return

    // SWIMLANE GUARD: strictly reject cross-lane drops
    if (sourcePostingId !== targetPostingId) return

    const posting = postings.find((p) => p.id === targetPostingId)
    const app = posting?.applications.find((a) => a.id === applicationId)
    if (!app || app.stage === targetStage) return

    if (targetStage === 'OFFER') {
      setOfferModal({
        open: true,
        applicationId,
        postingId: targetPostingId,
        form: { offeredSalary: '', offeredDate: '', expectedStartDate: '' },
      })
      return
    }

    await changeStage(applicationId, targetPostingId, targetStage)
  }

  // ─── Stage change ───────────────────────────────────

  const changeStage = async (
    applicationId: string,
    postingId: string,
    stage: string,
    rejectionReason?: string,
  ) => {
    // Optimistic update within nested state
    setPostings((prev) =>
      prev.map((p) =>
        p.id !== postingId
          ? p
          : {
              ...p,
              applications: p.applications.map((a) =>
                a.id !== applicationId ? a : { ...a, stage },
              ),
            },
      ),
    )

    try {
      await apiClient.put(
        `/api/v1/recruitment/applications/${applicationId}/stage`,
        { stage, rejectionReason: rejectionReason ?? null },
      )
    } catch {
      fetchData() // revert on failure
    }
  }

  const submitOffer = async (applicationId: string, postingId: string, form: OfferFormData) => {
    const salary = Number(form.offeredSalary)
    if (isNaN(salary) || salary <= 0) return

    setPostings((prev) =>
      prev.map((p) =>
        p.id !== postingId
          ? p
          : {
              ...p,
              applications: p.applications.map((a) =>
                a.id !== applicationId
                  ? a
                  : {
                      ...a,
                      stage: 'OFFER',
                      offeredSalary: salary,
                      offeredDate: form.offeredDate,
                      expectedStartDate: form.expectedStartDate,
                    },
              ),
            },
      ),
    )

    try {
      await apiClient.post(
        `/api/v1/recruitment/applications/${applicationId}/offer`,
        {
          offeredSalary: salary,
          offeredDate: form.offeredDate,
          expectedStartDate: form.expectedStartDate,
        },
      )
    } catch {
      fetchData()
    }
  }

  // ─── Modal handlers ─────────────────────────────────

  const handleOfferSubmit = async () => {
    const { offeredSalary, offeredDate, expectedStartDate } = offerModal.form
    if (!offeredSalary || !offeredDate || !expectedStartDate) return
    setModalSubmitting(true)
    await submitOffer(offerModal.applicationId, offerModal.postingId, offerModal.form)
    setModalSubmitting(false)
    setOfferModal({
      open: false,
      applicationId: '',
      postingId: '',
      form: { offeredSalary: '', offeredDate: '', expectedStartDate: '' },
    })
  }

  // ─── Render ─────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center bg-[#F5F5FA]">
        <div className="flex items-center gap-2 text-sm text-[#8181A5]">
          <Loader2 className="w-4 h-4 animate-spin" />
          {tCommon('loading')}
        </div>
      </div>
    )
  }

  if (postings.length === 0) {
    return (
      <EmptyState
        icon={LayoutGrid}
        title={t('emptyBoard')}
        description={t('emptyBoardDesc')}
        action={{ label: t('newPosting'), onClick: () => router.push('/recruitment/new') }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F5FA] p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#EEF2FF] rounded-xl flex items-center justify-center">
            <LayoutGrid className="w-5 h-5 text-[#4F46E5]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#1C1D21]" style={{ letterSpacing: '-0.02em' }}>
              {t('kanbanBoard')}
            </h1>
            <p className="text-sm text-[#8181A5]">
              {t('kanbanBoardDesc')}
            </p>
          </div>
        </div>
        <button
          onClick={() => router.push('/recruitment')}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-white border border-[#F0F0F3] text-[#1C1D21] rounded-lg hover:bg-[#F5F5FA] transition-colors duration-150"
        >
          {t('listView')}
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Column Header Row (sticky) */}
      <div className="sticky top-0 z-10 bg-[#F5F5FA] pb-2">
        <div className="flex gap-3 overflow-x-auto">
          {/* Lane label spacer */}
          <div className="shrink-0 w-56" />
          {STAGES.map((stage) => (
            <div
              key={stage}
              className="flex-1 min-w-[160px] flex items-center gap-2 px-3 py-2"
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: STAGE_ACCENT[stage] }}
              />
              <span className="text-xs font-bold text-[#8181A5] uppercase tracking-wider whitespace-nowrap">
                {STAGE_LABELS[stage]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Swimlane Rows */}
      <div className="flex flex-col gap-4">
        {postings.map((posting, idx) => {
          const totalCount = posting.applications.length

          return (
            <div
              key={posting.id}
              className="rounded-xl border border-[#F0F0F3] bg-white overflow-hidden"
            >
              {/* Swimlane Header */}
              <div
                className={`flex items-center gap-3 px-4 py-3 ${
                  idx > 0 ? 'border-t border-[#F0F0F3]' : ''
                } bg-white`}
              >
                <button
                  onClick={() => router.push(`/recruitment/${posting.id}/pipeline`)}
                  className="flex items-center gap-2 hover:underline"
                >
                  <span className="text-sm font-bold text-[#1C1D21]" style={{ letterSpacing: '-0.01em' }}>
                    {posting.title}
                  </span>
                </button>
                {posting.department && (
                  <span className="text-xs text-[#8181A5] bg-[#F5F5FA] px-2 py-0.5 rounded-full">
                    {posting.department.name}
                  </span>
                )}
                <div className="flex items-center gap-1 ml-auto">
                  <Users className="w-3.5 h-3.5 text-[#8181A5]" />
                  <span className="text-xs text-[#8181A5]">{totalCount}{tCommon('unit.person')}</span>
                  <span className="text-xs text-[#C5C5D0] mx-1">·</span>
                  <span className="text-xs text-[#8181A5]">
                    {t('recruit')} {posting.headcount}{tCommon('unit.person')}
                  </span>
                </div>
              </div>

              {/* Kanban Columns within this swimlane */}
              <div className="flex gap-3 p-3 overflow-x-auto bg-[#F5F5FA]">
                {STAGES.map((stage) => {
                  const cards = getApplicationsByStage(posting.applications, stage)
                  const overKey = `${posting.id}:${stage}`
                  const isOver = dragOverKey === overKey

                  // Disallow highlight if dragging from different swimlane
                  const canReceive = draggingPostingId === posting.id || draggingPostingId === null

                  return (
                    <div
                      key={stage}
                      onDragOver={(e) => handleDragOver(e, posting.id, stage)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, posting.id, stage as StageType)}
                      className={`flex-1 min-w-[160px] flex flex-col rounded-lg border transition-all duration-150 ${
                        isOver && canReceive
                          ? 'border-[#4F46E5] ring-2 ring-[#4F46E5]/20 bg-[#EEF2FF]'
                          : 'border-[#F0F0F3] bg-white'
                      }`}
                      style={{ minHeight: 80 }}
                    >
                      {/* Column count pill */}
                      <div className="flex items-center justify-between px-2.5 pt-2 pb-1">
                        <span
                          className="text-[10px] font-semibold uppercase tracking-wider"
                          style={{ color: STAGE_ACCENT[stage] }}
                        >
                          {STAGE_LABELS[stage]}
                        </span>
                        {cards.length > 0 && (
                          <span className="text-[10px] font-bold text-[#8181A5] bg-[#F5F5FA] px-1.5 py-0.5 rounded-full">
                            {cards.length}
                          </span>
                        )}
                      </div>

                      {/* Cards */}
                      <div className="flex flex-col gap-1.5 px-2 pb-2">
                        {cards.map((app) => (
                          <div
                            key={app.id}
                            draggable
                            onDragStart={(e) =>
                              handleDragStart(e, app.id, posting.id)
                            }
                            onDragEnd={handleDragEnd}
                            className={`group bg-white border border-[#F0F0F3] rounded-xl p-2.5 cursor-grab active:cursor-grabbing transition-all duration-150 hover:border-[#C5C5D0] hover:shadow-sm ${
                              draggingApplicationId === app.id
                                ? 'opacity-40 scale-95'
                                : 'opacity-100'
                            }`}
                          >
                            <div className="flex items-start gap-1.5">
                              <GripVertical className="w-3 h-3 text-[#C5C5D0] mt-0.5 shrink-0 group-hover:text-[#8181A5] transition-colors" />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-[#1C1D21] truncate">
                                  {app.applicant.name}
                                </p>
                                <p className="text-[10px] text-[#8181A5] truncate">
                                  {app.applicant.email}
                                </p>
                                <div className="flex items-center gap-1 mt-1">
                                  {getAiScoreBadge(app.aiScreeningScore)}
                                  <span className="text-[9px] text-[#C5C5D0]">
                                    {format(new Date(app.appliedAt), 'MM/dd')}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* Empty slot placeholder */}
                        {cards.length === 0 && (
                          <div className="h-10 rounded-xl border border-dashed border-[#E8E8EF] flex items-center justify-center">
                          <span className="text-[10px] text-[#C5C5D0]">{tCommon('empty')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Offer Modal */}
      {offerModal.open && (
        <div className={MODAL_STYLES.container}>
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() =>
              setOfferModal({
                open: false,
                applicationId: '',
                postingId: '',
                form: { offeredSalary: '', offeredDate: '', expectedStartDate: '' },
              })
            }
          />
          <div className="relative bg-white border border-[#F0F0F3] rounded-2xl p-6 w-full max-w-md shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-[#1C1D21]" style={{ letterSpacing: '-0.02em' }}>
                {t('offerModal')}
              </h2>
              <button
                onClick={() =>
                  setOfferModal({
                    open: false,
                    applicationId: '',
                    postingId: '',
                    form: { offeredSalary: '', offeredDate: '', expectedStartDate: '' },
                  })
                }
                className="p-1 rounded-lg hover:bg-[#F5F5FA] transition-colors"
              >
                <X className="w-4 h-4 text-[#8181A5]" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1C1D21] mb-1">
                  {t('offeredSalary')}
                </label>
                <input
                  type="number"
                  value={offerModal.form.offeredSalary}
                  onChange={(e) =>
                    setOfferModal((prev) => ({
                      ...prev,
                      form: { ...prev.form, offeredSalary: e.target.value },
                    }))
                  }
                  placeholder="예: 60000000"
                  className="w-full px-3 py-2 text-sm border border-[#F0F0F3] rounded-lg bg-white focus:outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/10 placeholder:text-[#8181A5] transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1C1D21] mb-1">
                  {t('offeredDate')}
                </label>
                <input
                  type="date"
                  value={offerModal.form.offeredDate}
                  onChange={(e) =>
                    setOfferModal((prev) => ({
                      ...prev,
                      form: { ...prev.form, offeredDate: e.target.value },
                    }))
                  }
                  className="w-full px-3 py-2 text-sm border border-[#F0F0F3] rounded-lg bg-white focus:outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/10 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1C1D21] mb-1">
                  {t('expectedStartDate')}
                </label>
                <input
                  type="date"
                  value={offerModal.form.expectedStartDate}
                  onChange={(e) =>
                    setOfferModal((prev) => ({
                      ...prev,
                      form: { ...prev.form, expectedStartDate: e.target.value },
                    }))
                  }
                  className="w-full px-3 py-2 text-sm border border-[#F0F0F3] rounded-lg bg-white focus:outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/10 transition-colors"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                onClick={() =>
                  setOfferModal({
                    open: false,
                    applicationId: '',
                    postingId: '',
                    form: { offeredSalary: '', offeredDate: '', expectedStartDate: '' },
                  })
                }
                className="px-4 py-2 text-sm font-medium text-[#1C1D21] border border-[#F0F0F3] rounded-lg hover:bg-[#F5F5FA] transition-colors"
              >
                {tCommon('cancel')}
              </button>
              <button
                onClick={handleOfferSubmit}
                disabled={
                  !offerModal.form.offeredSalary ||
                  !offerModal.form.offeredDate ||
                  !offerModal.form.expectedStartDate ||
                  modalSubmitting
                }
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#4F46E5] hover:bg-[#4B6FE0] text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {modalSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {modalSubmitting ? tCommon('loading') : t('confirmOffer')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal (triggered from per-posting pipeline link only) */}
      {rejectionModal.open && (
        <div className={MODAL_STYLES.container}>
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() =>
              setRejectionModal({ open: false, applicationId: '', postingId: '', reason: '' })
            }
          />
          <div className="relative bg-white border border-[#F0F0F3] rounded-2xl p-6 w-full max-w-md shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-[#1C1D21]" style={{ letterSpacing: '-0.02em' }}>
                {t('rejectionModal')}
              </h2>
              <button
                onClick={() =>
                  setRejectionModal({ open: false, applicationId: '', postingId: '', reason: '' })
                }
                className="p-1 rounded-lg hover:bg-[#F5F5FA] transition-colors"
              >
                <X className="w-4 h-4 text-[#8181A5]" />
              </button>
            </div>
            <textarea
              value={rejectionModal.reason}
              onChange={(e) =>
                setRejectionModal((prev) => ({ ...prev, reason: e.target.value }))
              }
              placeholder="불합격 사유를 입력해주세요."
              rows={4}
              className="w-full px-3 py-2 text-sm border border-[#F0F0F3] rounded-lg resize-none focus:outline-none focus:border-[#FF808B] transition-colors placeholder:text-[#8181A5]"
            />
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() =>
                  setRejectionModal({ open: false, applicationId: '', postingId: '', reason: '' })
                }
                className="px-4 py-2 text-sm font-medium text-[#1C1D21] border border-[#F0F0F3] rounded-lg hover:bg-[#F5F5FA] transition-colors"
              >
                {tCommon('cancel')}
              </button>
              <button
                onClick={async () => {
                  if (!rejectionModal.reason.trim()) return
                  setModalSubmitting(true)
                  await changeStage(
                    rejectionModal.applicationId,
                    rejectionModal.postingId,
                    'REJECTED',
                    rejectionModal.reason.trim(),
                  )
                  setModalSubmitting(false)
                  setRejectionModal({ open: false, applicationId: '', postingId: '', reason: '' })
                }}
                disabled={!rejectionModal.reason.trim() || modalSubmitting}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#FF808B] hover:bg-[#E11D48] text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {modalSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {modalSubmitting ? tCommon('loading') : t('confirmRejection')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
