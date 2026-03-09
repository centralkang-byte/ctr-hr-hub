'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 지원자 등록 폼 (Client)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ChevronLeft, UserPlus, Save, Loader2, AlertTriangle } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { useAutoSave } from '@/hooks/useAutoSave'
import DuplicateWarningModal from '@/components/recruitment/DuplicateWarningModal'
import type { SessionUser } from '@/types'

interface DuplicateMatch {
  applicantId: string
  name: string
  email: string
  phone: string | null
  matchType: 'email' | 'phone' | 'name_dob'
  matchScore: number
  applicationCount: number
  lastApplicationAt: string | null
}

// ─── Types ──────────────────────────────────────────────

interface FormData {
  name: string
  email: string
  phone: string
  source: string
  portfolioUrl: string
  memo: string
  resumeKey: string
}

interface Props {
  user: SessionUser
  postingId: string
}

// ─── Component ──────────────────────────────────────────

export default function ApplicantFormClient({ user, postingId }: Props) {
  const router = useRouter()
  const t = useTranslations('recruitment')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([])
  const [pendingSubmit, setPendingSubmit] = useState(false)
  const [emailWarning, setEmailWarning] = useState<string | null>(null)
  const [phoneWarning, setPhoneWarning] = useState<string | null>(null)
  const FORM_KEY = `applicant-form-${postingId}`
  const [form, setForm] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    source: 'DIRECT',
    portfolioUrl: '',
    memo: '',
    resumeKey: '',
  })

  const { loadSaved, clearSaved, savedAt } = useAutoSave(FORM_KEY, form)

  // 마운트 시 저장된 초안 복원
  useEffect(() => {
    const saved = loadSaved()
    if (saved) setForm(saved)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Options (use t() for labels) ─────────────────────
  const SOURCE_OPTIONS = [
    { value: 'DIRECT', label: t('sourceDIRECT') },
    { value: 'REFERRAL', label: t('sourceREFERRAL') },
    { value: 'AGENCY', label: t('sourceAGENCY') },
    { value: 'JOB_BOARD', label: t('sourceJOB_BOARD') },
    { value: 'INTERNAL', label: t('sourceINTERNAL') },
  ] as const

  void user

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
    if (e.target.name === 'email') setEmailWarning(null)
    if (e.target.name === 'phone') setPhoneWarning(null)
  }

  const checkFieldDuplicate = async (field: 'email' | 'phone', value: string) => {
    if (!value.trim()) return
    try {
      const res = await apiClient.get<{
        exists: boolean
        candidate: { name: string; email: string; appliedJobTitle: string | null } | null
      }>(`/api/v1/recruitment/candidates/check?${field}=${encodeURIComponent(value.trim())}`)
      if (res.data.exists && res.data.candidate) {
        const { name, appliedJobTitle } = res.data.candidate
        const msg = appliedJobTitle
          ? `이미 시스템에 존재하는 후보자입니다 (이름: ${name}, 최근 지원 공고: ${appliedJobTitle})`
          : `이미 시스템에 존재하는 후보자입니다 (이름: ${name})`
        if (field === 'email') setEmailWarning(msg)
        else setPhoneWarning(msg)
      } else {
        if (field === 'email') setEmailWarning(null)
        else setPhoneWarning(null)
      }
    } catch {
      // 체크 실패 시 경고 없이 진행
    }
  }

  const handleEmailBlur = () => {
    checkFieldDuplicate('email', form.email)
  }

  const handlePhoneBlur = () => {
    if (form.phone.trim()) {
      checkFieldDuplicate('phone', form.phone)
    } else {
      setPhoneWarning(null)
    }
  }

  const doSubmit = async () => {
    setSubmitting(true)
    setDuplicates([])
    try {
      await apiClient.post(`/api/v1/recruitment/postings/${postingId}/applicants`, {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        source: form.source,
        portfolioUrl: form.portfolioUrl.trim() || null,
        memo: form.memo.trim() || null,
        resumeKey: form.resumeKey.trim() || null,
      })
      clearSaved()
      router.push(`/recruitment/${postingId}/applicants`)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('applicantRegisterError')
      setError(message)
    } finally {
      setSubmitting(false)
      setPendingSubmit(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!form.name.trim()) {
      setError(t('validationName'))
      return
    }
    if (!form.email.trim()) {
      setError(t('validationEmail'))
      return
    }
    if (!form.source) {
      setError(t('validationSource'))
      return
    }

    // 중복 감지 체크
    try {
      const res = await apiClient.post<{ hasDuplicates: boolean; matches: DuplicateMatch[] }>(
        '/api/v1/recruitment/applicants/check-duplicate',
        {
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
        },
      )
      if (res.data.hasDuplicates && res.data.matches.length > 0) {
        setDuplicates(res.data.matches)
        setPendingSubmit(true)
        return
      }
    } catch {
      // 중복 체크 실패 시 그냥 진행
    }

    await doSubmit()
  }

  return (
    <>
    {pendingSubmit && duplicates.length > 0 && (
      <DuplicateWarningModal
        matches={duplicates}
        onProceed={doSubmit}
        onCancel={() => { setDuplicates([]); setPendingSubmit(false) }}
      />
    )}
    <div className="min-h-screen bg-[#FAFAFA] p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push(`/recruitment/${postingId}/applicants`)}
          className="p-2 rounded-lg border border-[#E8E8E8] hover:bg-white transition-colors duration-150"
        >
          <ChevronLeft className="w-4 h-4 text-[#666]" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#E8F5E9] rounded-lg flex items-center justify-center">
            <UserPlus className="w-5 h-5 text-[#00C853]" />
          </div>
          <div>
            <h1
              className="text-xl font-bold text-[#1A1A1A] tracking-[-0.02em]"
            >
              {t('applicantFormTitle')}
            </h1>
            <p className="text-sm text-[#999]">
              {t('applicantFormDescription')}
            </p>
          </div>
        </div>
      </div>

      {/* Form Card */}
      <form onSubmit={handleSubmit}>
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-6 max-w-2xl">
          {error && (
            <div className="mb-6 px-4 py-3 bg-[#FFEBEE] border border-[#FFCDD2] rounded-lg">
              <p className="text-sm text-[#C62828]">{error}</p>
            </div>
          )}

          <div className="space-y-5">
            {/* 이름 */}
            <div>
              <label className="block text-sm font-medium text-[#1A1A1A] mb-1">
                {t('nameLabel')} <span className="text-[#F44336]">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder={t('namePlaceholder')}
                className="w-full px-4 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-[#00C853] focus:ring-2 focus:ring-[#00C853]/10 transition-colors duration-150"
              />
            </div>

            {/* 이메일 */}
            <div>
              <label className="block text-sm font-medium text-[#1A1A1A] mb-1">
                {t('emailLabel')} <span className="text-[#F44336]">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                onBlur={handleEmailBlur}
                placeholder="example@email.com"
                className="w-full px-4 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-[#00C853] focus:ring-2 focus:ring-[#00C853]/10 transition-colors duration-150"
              />
              {emailWarning && (
                <p className="flex items-center gap-1.5 text-[#B45309] bg-[#F4BE5E]/10 px-2 py-1.5 rounded-md mt-1.5 text-sm font-medium">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {emailWarning}
                </p>
              )}
            </div>

            {/* 전화번호 */}
            <div>
              <label className="block text-sm font-medium text-[#1A1A1A] mb-1">
                {t('phoneLabel')}
              </label>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                onBlur={handlePhoneBlur}
                placeholder="010-0000-0000"
                className="w-full px-4 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-[#00C853] focus:ring-2 focus:ring-[#00C853]/10 transition-colors duration-150"
              />
              {phoneWarning && (
                <p className="flex items-center gap-1.5 text-[#B45309] bg-[#F4BE5E]/10 px-2 py-1.5 rounded-md mt-1.5 text-sm font-medium">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {phoneWarning}
                </p>
              )}
            </div>

            {/* 지원경로 */}
            <div>
              <label className="block text-sm font-medium text-[#1A1A1A] mb-1">
                {t('sourceLabel')} <span className="text-[#F44336]">*</span>
              </label>
              <select
                name="source"
                value={form.source}
                onChange={handleChange}
                className="w-full px-4 py-2 text-sm border border-[#E8E8E8] rounded-lg bg-white focus:outline-none focus:border-[#00C853] focus:ring-2 focus:ring-[#00C853]/10 transition-colors duration-150"
              >
                {SOURCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 포트폴리오 URL */}
            <div>
              <label className="block text-sm font-medium text-[#1A1A1A] mb-1">
                {t('portfolioUrlLabel')}
              </label>
              <input
                type="url"
                name="portfolioUrl"
                value={form.portfolioUrl}
                onChange={handleChange}
                placeholder="https://..."
                className="w-full px-4 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-[#00C853] focus:ring-2 focus:ring-[#00C853]/10 transition-colors duration-150"
              />
            </div>

            {/* 이력서 키 (placeholder) */}
            <div>
              <label className="block text-sm font-medium text-[#1A1A1A] mb-1">
                {t('resumeKeyLabel')}
              </label>
              <input
                type="text"
                name="resumeKey"
                value={form.resumeKey}
                onChange={handleChange}
                placeholder={t('resumeKeyPlaceholder')}
                className="w-full px-4 py-2 text-sm border border-[#E8E8E8] rounded-lg bg-[#FAFAFA] focus:outline-none focus:border-[#00C853] focus:ring-2 focus:ring-[#00C853]/10 transition-colors duration-150"
              />
              <p className="text-xs text-[#999] mt-1">
                {t('resumeKeyDescription')}
              </p>
            </div>

            {/* 메모 */}
            <div>
              <label className="block text-sm font-medium text-[#1A1A1A] mb-1">
                {t('memoLabel')}
              </label>
              <textarea
                name="memo"
                value={form.memo}
                onChange={handleChange}
                placeholder={t('memoPlaceholder')}
                rows={3}
                className="w-full px-4 py-2 text-sm border border-[#E8E8E8] rounded-lg resize-none focus:outline-none focus:border-[#00C853] focus:ring-2 focus:ring-[#00C853]/10 transition-colors duration-150"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 mt-8 pt-6 border-t border-[#E8E8E8]">
            <button
              type="button"
              onClick={() => router.push(`/recruitment/${postingId}/applicants`)}
              className="px-4 py-2 text-sm font-medium text-[#666] border border-[#E8E8E8] rounded-lg hover:bg-[#FAFAFA] transition-colors duration-150"
            >
              {t('cancelButton')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2 text-sm font-medium bg-[#00C853] hover:bg-[#00A844] text-white rounded-lg transition-colors duration-150 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {t('registerSubmit')}
            </button>
            {savedAt && (
              <span className="text-xs text-[#8181A5]">
                초안 자동 저장됨{' '}
                {savedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
      </form>
    </div>
    </>
  )
}
