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

const STAGE_KEYS: Record<string, string> = {
  APPLIED: 'stageAPPLIED',
  SCREENING: 'stageSCREENING',
  INTERVIEW_1: 'stageINTERVIEW_1',
  INTERVIEW_2: 'stageINTERVIEW_2',
  FINAL: 'stageFINAL',
  OFFER: 'stageOFFER',
  HIRED: 'stageHIRED',
}

const STAGE_ACCENT: Record<string, string> = {
  APPLIED: '#8181A5',
  SCREENING: '#5E81F4',
  INTERVIEW_1: '#5E81F4',
  INTERVIEW_2: '#5E81F4',
  FINAL: '#F4BE5E',
  OFFER: '#5E81F4',
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
    let style = 'bg-destructive/10 text-destructive'
    if (score >= 80) style = 'bg-emerald-500/15 text-emerald-800'
    else if (score >= 50) style = 'bg-amber-500/15 text-amber-700'
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
      <div className="min-h-[400px] flex items-center justify-center bg-muted">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
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
    <div className="min-h-screen bg-muted p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <LayoutGrid className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground" style={{ letterSpacing: '-0.02em' }}>
              {t('kanbanBoard')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('kanbanBoardDesc')}
            </p>
          </div>
        </div>
        <button
          onClick={() => router.push('/recruitment')}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-card border border-border text-foreground rounded-lg hover:bg-muted transition-colors duration-150"
        >
          {t('listView')}
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Column Header Row (sticky) */}
      <div className="sticky top-0 z-10 bg-muted pb-2">
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
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                {t(STAGE_KEYS[stage])}
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
              className="rounded-xl border border-border bg-card overflow-hidden"
            >
              {/* Swimlane Header */}
              <div
                className={`flex items-center gap-3 px-4 py-3 ${
                  idx > 0 ? 'border-t border-border' : ''
                } bg-card`}
              >
                <button
                  onClick={() => router.push(`/recruitment/${posting.id}/pipeline`)}
                  className="flex items-center gap-2 hover:underline"
                >
                  <span className="text-sm font-bold text-foreground" style={{ letterSpacing: '-0.01em' }}>
                    {posting.title}
                  </span>
                </button>
                {posting.department && (
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {posting.department.name}
                  </span>
                )}
                <div className="flex items-center gap-1 ml-auto">
                  <Users className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{totalCount}{tCommon('unit.person')}</span>
                  <span className="text-xs text-muted-foreground/70 mx-1">·</span>
                  <span className="text-xs text-muted-foreground">
                    {t('recruit')} {posting.headcount}{tCommon('unit.person')}
                  </span>
                </div>
              </div>

              {/* Kanban Columns within this swimlane */}
              <div className="flex gap-3 p-3 overflow-x-auto bg-muted">
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
                          ? 'border-primary ring-2 ring-primary/20 bg-primary/10'
                          : 'border-border bg-card'
                      }`}
                      style={{ minHeight: 80 }}
                    >
                      {/* Column count pill */}
                      <div className="flex items-center justify-between px-2.5 pt-2 pb-1">
                        <span
                          className="text-[10px] font-semibold uppercase tracking-wider"
                          style={{ color: STAGE_ACCENT[stage] }}
                        >
                          {t(STAGE_KEYS[stage])}
                        </span>
                        {cards.length > 0 && (
                          <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
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
                            className={`group bg-card border border-border rounded-xl p-2.5 cursor-grab active:cursor-grabbing transition-all duration-150 hover:border-border hover:shadow-sm ${
                              draggingApplicationId === app.id
                                ? 'opacity-40 scale-95'
                                : 'opacity-100'
                            }`}
                          >
                            <div className="flex items-start gap-1.5">
                              <GripVertical className="w-3 h-3 text-muted-foreground/70 mt-0.5 shrink-0 group-hover:text-muted-foreground transition-colors" />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-foreground truncate">
                                  {app.applicant.name}
                                </p>
                                <p className="text-[10px] text-muted-foreground truncate">
                                  {app.applicant.email}
                                </p>
                                <div className="flex items-center gap-1 mt-1">
                                  {getAiScoreBadge(app.aiScreeningScore)}
                                  <span className="text-[9px] text-muted-foreground/70">
                                    {format(new Date(app.appliedAt), 'MM/dd')}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* Empty slot placeholder */}
                        {cards.length === 0 && (
                          <div className="h-10 rounded-xl border border-dashed border-border flex items-center justify-center">
                          <span className="text-[10px] text-muted-foreground/70">{tCommon('empty')}</span>
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
          <div className="relative bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-lg animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-foreground" style={{ letterSpacing: '-0.02em' }}>
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
                className="p-1 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
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
                  placeholder={t('offeredSalaryPlaceholder')}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 placeholder:text-muted-foreground transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
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
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
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
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors"
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
                className="px-4 py-2 text-sm font-medium text-foreground border border-border rounded-lg hover:bg-muted transition-colors"
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
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors disabled:opacity-50"
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
          <div className="relative bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-lg animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-foreground" style={{ letterSpacing: '-0.02em' }}>
                {t('rejectionModal')}
              </h2>
              <button
                onClick={() =>
                  setRejectionModal({ open: false, applicationId: '', postingId: '', reason: '' })
                }
                className="p-1 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <textarea
              value={rejectionModal.reason}
              onChange={(e) =>
                setRejectionModal((prev) => ({ ...prev, reason: e.target.value }))
              }
              placeholder={t('rejectionReasonPlaceholder')}
              rows={4}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg resize-none focus:outline-none focus:border-red-400 transition-colors placeholder:text-muted-foreground"
            />
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() =>
                  setRejectionModal({ open: false, applicationId: '', postingId: '', reason: '' })
                }
                className="px-4 py-2 text-sm font-medium text-foreground border border-border rounded-lg hover:bg-muted transition-colors"
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
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-red-400 hover:bg-rose-600 text-white rounded-lg transition-colors disabled:opacity-50"
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
