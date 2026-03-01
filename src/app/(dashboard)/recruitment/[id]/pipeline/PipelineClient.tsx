'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 채용 파이프라인 칸반 (Client)
// HTML5 Drag & Drop API — 외부 라이브러리 미사용
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  ChevronLeft,
  GitBranch,
  X,
  Loader2,
} from 'lucide-react'
import { format } from 'date-fns'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'

// ─── Constants ──────────────────────────────────────────

const STAGES = [
  'APPLIED',
  'SCREENING',
  'INTERVIEW_1',
  'INTERVIEW_2',
  'FINAL',
  'OFFER',
  'HIRED',
  'REJECTED',
] as const

type StageType = typeof STAGES[number]

const STAGE_KEYS: Record<string, string> = {
  APPLIED: 'stageAPPLIED',
  SCREENING: 'stageSCREENING',
  INTERVIEW_1: 'stageINTERVIEW_1',
  INTERVIEW_2: 'stageINTERVIEW_2',
  FINAL: 'stageFINAL',
  OFFER: 'stageOFFER',
  HIRED: 'stageHIRED',
  REJECTED: 'stageREJECTED',
}

const STAGE_BORDER_COLORS: Record<string, string> = {
  APPLIED: '#999',
  SCREENING: '#2196F3',
  INTERVIEW_1: '#2196F3',
  INTERVIEW_2: '#2196F3',
  FINAL: '#FF9800',
  OFFER: '#00C853',
  HIRED: '#00C853',
  REJECTED: '#F44336',
}

const STAGE_HEADER_BG: Record<string, string> = {
  APPLIED: 'bg-[#F5F5F5]',
  SCREENING: 'bg-[#E3F2FD]',
  INTERVIEW_1: 'bg-[#E3F2FD]',
  INTERVIEW_2: 'bg-[#E3F2FD]',
  FINAL: 'bg-[#FFF3E0]',
  OFFER: 'bg-[#E8F5E9]',
  HIRED: 'bg-[#E8F5E9]',
  REJECTED: 'bg-[#FFEBEE]',
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
  applicantId: string
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

interface Props {
  user: SessionUser
  postingId: string
}

interface OfferFormData {
  offeredSalary: string
  offeredDate: string
  expectedStartDate: string
}

// ─── Component ──────────────────────────────────────────

export default function PipelineClient({ user, postingId }: Props) {
  const router = useRouter()
  const t = useTranslations('recruitment')
  const [applications, setApplications] = useState<ApplicationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [dragOverStage, setDragOverStage] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  // Modal states
  const [rejectionModal, setRejectionModal] = useState<{
    open: boolean
    applicationId: string
    reason: string
  }>({ open: false, applicationId: '', reason: '' })

  const [offerModal, setOfferModal] = useState<{
    open: boolean
    applicationId: string
    form: OfferFormData
  }>({
    open: false,
    applicationId: '',
    form: { offeredSalary: '', offeredDate: '', expectedStartDate: '' },
  })

  const [modalSubmitting, setModalSubmitting] = useState(false)

  void user

  // ─── Fetch data ──────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.getList<ApplicationRecord>(
        `/api/v1/recruitment/postings/${postingId}/applicants`,
        { limit: 200 },
      )
      setApplications(res.data)
    } catch {
      /* silently handle */
    } finally {
      setLoading(false)
    }
  }, [postingId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ─── Group by stage ──────────────────────────────────

  const grouped: Record<string, ApplicationRecord[]> = {}
  for (const stage of STAGES) {
    grouped[stage] = []
  }
  for (const app of applications) {
    if (grouped[app.stage]) {
      grouped[app.stage].push(app)
    }
  }

  // ─── Drag & Drop handlers ────────────────────────────

  const handleDragStart = (e: React.DragEvent, applicationId: string) => {
    e.dataTransfer.setData('text/plain', applicationId)
    e.dataTransfer.effectAllowed = 'move'
    setDraggingId(applicationId)
  }

  const handleDragEnd = () => {
    setDraggingId(null)
    setDragOverStage(null)
  }

  const handleDragOver = (e: React.DragEvent, stage: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverStage(stage)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if leaving the column container, not entering a child
    const relatedTarget = e.relatedTarget as HTMLElement | null
    const currentTarget = e.currentTarget as HTMLElement
    if (!relatedTarget || !currentTarget.contains(relatedTarget)) {
      setDragOverStage(null)
    }
  }

  const handleDrop = async (e: React.DragEvent, targetStage: StageType) => {
    e.preventDefault()
    setDragOverStage(null)
    setDraggingId(null)

    const applicationId = e.dataTransfer.getData('text/plain')
    if (!applicationId) return

    const app = applications.find((a) => a.id === applicationId)
    if (!app || app.stage === targetStage) return

    // If REJECTED → show rejection modal
    if (targetStage === 'REJECTED') {
      setRejectionModal({ open: true, applicationId, reason: '' })
      return
    }

    // If OFFER → show offer modal
    if (targetStage === 'OFFER') {
      setOfferModal({
        open: true,
        applicationId,
        form: { offeredSalary: '', offeredDate: '', expectedStartDate: '' },
      })
      return
    }

    // Normal stage change
    await changeStage(applicationId, targetStage)
  }

  // ─── API calls ───────────────────────────────────────

  const changeStage = async (
    applicationId: string,
    stage: string,
    rejectionReason?: string,
  ) => {
    // Optimistic update
    setApplications((prev) =>
      prev.map((a) => (a.id === applicationId ? { ...a, stage } : a)),
    )

    try {
      await apiClient.put(`/api/v1/recruitment/applications/${applicationId}/stage`, {
        stage,
        rejectionReason: rejectionReason ?? null,
      })
    } catch {
      // Revert on failure
      fetchData()
    }
  }

  const submitOffer = async (applicationId: string, form: OfferFormData) => {
    const salary = Number(form.offeredSalary)
    if (isNaN(salary) || salary <= 0) return

    // Optimistic update
    setApplications((prev) =>
      prev.map((a) =>
        a.id === applicationId
          ? {
              ...a,
              stage: 'OFFER',
              offeredSalary: salary,
              offeredDate: form.offeredDate,
              expectedStartDate: form.expectedStartDate,
            }
          : a,
      ),
    )

    try {
      await apiClient.post(`/api/v1/recruitment/applications/${applicationId}/offer`, {
        offeredSalary: salary,
        offeredDate: form.offeredDate,
        expectedStartDate: form.expectedStartDate,
      })
    } catch {
      // Revert on failure
      fetchData()
    }
  }

  // ─── Modal handlers ──────────────────────────────────

  const handleRejectionSubmit = async () => {
    if (!rejectionModal.reason.trim()) return
    setModalSubmitting(true)
    await changeStage(
      rejectionModal.applicationId,
      'REJECTED',
      rejectionModal.reason.trim(),
    )
    setModalSubmitting(false)
    setRejectionModal({ open: false, applicationId: '', reason: '' })
  }

  const handleOfferSubmit = async () => {
    const { offeredSalary, offeredDate, expectedStartDate } = offerModal.form
    if (!offeredSalary || !offeredDate || !expectedStartDate) return
    setModalSubmitting(true)
    await submitOffer(offerModal.applicationId, offerModal.form)
    setModalSubmitting(false)
    setOfferModal({
      open: false,
      applicationId: '',
      form: { offeredSalary: '', offeredDate: '', expectedStartDate: '' },
    })
  }

  // ─── AI Score badge ──────────────────────────────────

  const getAiScoreBadge = (score: number | null) => {
    if (score === null || score === undefined) {
      return (
        <span className="inline-block px-2 py-0.5 text-xs bg-[#F5F5F5] text-[#999] rounded">
          -
        </span>
      )
    }
    let bgClass = 'bg-[#FFEBEE] text-[#C62828]'
    if (score >= 80) bgClass = 'bg-[#E8F5E9] text-[#1B5E20]'
    else if (score >= 50) bgClass = 'bg-[#FFF3E0] text-[#E65100]'
    return (
      <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${bgClass}`}>
        AI {score}
      </span>
    )
  }

  // ─── Render ──────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-[#999]">
          <div className="w-4 h-4 border-2 border-[#E8E8E8] border-t-[#00C853] rounded-full animate-spin" />
          {t('loadingData')}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push(`/recruitment/${postingId}`)}
          className="p-2 rounded-lg border border-[#E8E8E8] hover:bg-white transition-colors duration-150"
        >
          <ChevronLeft className="w-4 h-4 text-[#666]" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#E3F2FD] rounded-lg flex items-center justify-center">
            <GitBranch className="w-5 h-5 text-[#2196F3]" />
          </div>
          <div>
            <h1
              className="text-xl font-bold text-[#333]"
              style={{ letterSpacing: '-0.02em' }}
            >
              {t('pipelineTitle')}
            </h1>
            <p className="text-sm text-[#999]">
              {t('pipelineDescription')}
            </p>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4" style={{ minWidth: STAGES.length * 220 }}>
          {STAGES.map((stage) => {
            const items = grouped[stage]
            const borderColor = STAGE_BORDER_COLORS[stage]
            const isOver = dragOverStage === stage

            return (
              <div
                key={stage}
                onDragOver={(e) => handleDragOver(e, stage)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, stage)}
                className={`flex-1 min-w-[200px] bg-[#FAFAFA] border border-[#E8E8E8] rounded-xl flex flex-col transition-all duration-150 ${
                  isOver ? 'ring-2 ring-[#2196F3] bg-[#F0F7FF]' : ''
                }`}
                style={{ borderTopWidth: 3, borderTopColor: borderColor }}
              >
                {/* Column Header */}
                <div className={`px-3 py-3 ${STAGE_HEADER_BG[stage]} rounded-t-xl`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#333]">
                      {STAGE_KEYS[stage] ? t(STAGE_KEYS[stage]) : stage}
                    </span>
                    <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold bg-white text-[#666] rounded-full">
                      {items.length}
                    </span>
                  </div>
                </div>

                {/* Cards Container */}
                <div className="flex-1 p-2 space-y-2 min-h-[120px]">
                  {items.map((app) => (
                    <div
                      key={app.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, app.id)}
                      onDragEnd={handleDragEnd}
                      className={`bg-white border border-[#E8E8E8] rounded-lg p-3 cursor-grab active:cursor-grabbing transition-opacity duration-150 ${
                        draggingId === app.id ? 'opacity-50' : 'opacity-100'
                      } hover:border-[#CCC]`}
                    >
                      <p className="text-sm font-medium text-[#333] mb-1">
                        {app.applicant.name}
                      </p>
                      <div className="flex items-center gap-2 mb-1">
                        {getAiScoreBadge(app.aiScreeningScore)}
                      </div>
                      <p className="text-xs text-[#999]">
                        {format(new Date(app.appliedAt), 'yyyy-MM-dd')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Rejection Modal */}
      {rejectionModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() =>
              setRejectionModal({ open: false, applicationId: '', reason: '' })
            }
          />
          <div className="relative bg-white border border-[#E8E8E8] rounded-2xl p-6 w-full max-w-md shadow-lg animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h2
                className="text-lg font-bold text-[#333]"
                style={{ letterSpacing: '-0.02em' }}
              >
                {t('rejectionReason')}
              </h2>
              <button
                onClick={() =>
                  setRejectionModal({ open: false, applicationId: '', reason: '' })
                }
                className="p-1 rounded-lg hover:bg-[#F5F5F5] transition-colors duration-150"
              >
                <X className="w-5 h-5 text-[#999]" />
              </button>
            </div>
            <textarea
              value={rejectionModal.reason}
              onChange={(e) =>
                setRejectionModal((prev) => ({ ...prev, reason: e.target.value }))
              }
              placeholder={t('rejectionReasonPlaceholder')}
              rows={4}
              className="w-full px-4 py-3 text-sm border border-[#E8E8E8] rounded-lg resize-none focus:outline-none focus:border-[#F44336] transition-colors duration-150"
            />
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() =>
                  setRejectionModal({ open: false, applicationId: '', reason: '' })
                }
                className="px-4 py-2 text-sm font-medium text-[#666] border border-[#E8E8E8] rounded-lg hover:bg-[#FAFAFA] transition-colors duration-150"
              >
                {t('cancelButton')}
              </button>
              <button
                onClick={handleRejectionSubmit}
                disabled={!rejectionModal.reason.trim() || modalSubmitting}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#F44336] hover:bg-[#D32F2F] text-white rounded-lg transition-colors duration-150 disabled:opacity-50"
              >
                {modalSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('confirmButton')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Offer Modal */}
      {offerModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() =>
              setOfferModal({
                open: false,
                applicationId: '',
                form: { offeredSalary: '', offeredDate: '', expectedStartDate: '' },
              })
            }
          />
          <div className="relative bg-white border border-[#E8E8E8] rounded-2xl p-6 w-full max-w-md shadow-lg animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h2
                className="text-lg font-bold text-[#333]"
                style={{ letterSpacing: '-0.02em' }}
              >
                {t('offerInfo')}
              </h2>
              <button
                onClick={() =>
                  setOfferModal({
                    open: false,
                    applicationId: '',
                    form: { offeredSalary: '', offeredDate: '', expectedStartDate: '' },
                  })
                }
                className="p-1 rounded-lg hover:bg-[#F5F5F5] transition-colors duration-150"
              >
                <X className="w-5 h-5 text-[#999]" />
              </button>
            </div>
            <div className="space-y-4">
              {/* 제안 연봉 */}
              <div>
                <label className="block text-sm font-medium text-[#333] mb-1">
                  {t('offeredSalaryLabel')}
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
                  className="w-full px-4 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-[#00C853] transition-colors duration-150"
                />
              </div>
              {/* 제안일 */}
              <div>
                <label className="block text-sm font-medium text-[#333] mb-1">
                  {t('offeredDateLabel')}
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
                  className="w-full px-4 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-[#00C853] transition-colors duration-150"
                />
              </div>
              {/* 입사 예정일 */}
              <div>
                <label className="block text-sm font-medium text-[#333] mb-1">
                  {t('expectedStartDateLabel')}
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
                  className="w-full px-4 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-[#00C853] transition-colors duration-150"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                onClick={() =>
                  setOfferModal({
                    open: false,
                    applicationId: '',
                    form: { offeredSalary: '', offeredDate: '', expectedStartDate: '' },
                  })
                }
                className="px-4 py-2 text-sm font-medium text-[#666] border border-[#E8E8E8] rounded-lg hover:bg-[#FAFAFA] transition-colors duration-150"
              >
                {t('cancelButton')}
              </button>
              <button
                onClick={handleOfferSubmit}
                disabled={
                  !offerModal.form.offeredSalary ||
                  !offerModal.form.offeredDate ||
                  !offerModal.form.expectedStartDate ||
                  modalSubmitting
                }
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#00C853] hover:bg-[#00A844] text-white rounded-lg transition-colors duration-150 disabled:opacity-50"
              >
                {modalSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('confirmButton')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
