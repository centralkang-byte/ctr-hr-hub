'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 지원자 등록 폼 (Client)
// ═══════════════════════════════════════════════════════════

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ChevronLeft, UserPlus, Save, Loader2 } from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'

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
  const [form, setForm] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    source: 'DIRECT',
    portfolioUrl: '',
    memo: '',
    resumeKey: '',
  })

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

    setSubmitting(true)
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
      router.push(`/recruitment/${postingId}/applicants`)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('applicantRegisterError')
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
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
              className="text-xl font-bold text-[#333]"
              style={{ letterSpacing: '-0.02em' }}
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
              <label className="block text-sm font-medium text-[#333] mb-1">
                {t('nameLabel')} <span className="text-[#F44336]">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder={t('namePlaceholder')}
                className="w-full px-4 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-[#2196F3] transition-colors duration-150"
              />
            </div>

            {/* 이메일 */}
            <div>
              <label className="block text-sm font-medium text-[#333] mb-1">
                {t('emailLabel')} <span className="text-[#F44336]">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="example@email.com"
                className="w-full px-4 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-[#2196F3] transition-colors duration-150"
              />
            </div>

            {/* 전화번호 */}
            <div>
              <label className="block text-sm font-medium text-[#333] mb-1">
                {t('phoneLabel')}
              </label>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="010-0000-0000"
                className="w-full px-4 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-[#2196F3] transition-colors duration-150"
              />
            </div>

            {/* 지원경로 */}
            <div>
              <label className="block text-sm font-medium text-[#333] mb-1">
                {t('sourceLabel')} <span className="text-[#F44336]">*</span>
              </label>
              <select
                name="source"
                value={form.source}
                onChange={handleChange}
                className="w-full px-4 py-2 text-sm border border-[#E8E8E8] rounded-lg bg-white focus:outline-none focus:border-[#2196F3] transition-colors duration-150"
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
              <label className="block text-sm font-medium text-[#333] mb-1">
                {t('portfolioUrlLabel')}
              </label>
              <input
                type="url"
                name="portfolioUrl"
                value={form.portfolioUrl}
                onChange={handleChange}
                placeholder="https://..."
                className="w-full px-4 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-[#2196F3] transition-colors duration-150"
              />
            </div>

            {/* 이력서 키 (placeholder) */}
            <div>
              <label className="block text-sm font-medium text-[#333] mb-1">
                {t('resumeKeyLabel')}
              </label>
              <input
                type="text"
                name="resumeKey"
                value={form.resumeKey}
                onChange={handleChange}
                placeholder={t('resumeKeyPlaceholder')}
                className="w-full px-4 py-2 text-sm border border-[#E8E8E8] rounded-lg bg-[#FAFAFA] focus:outline-none focus:border-[#2196F3] transition-colors duration-150"
              />
              <p className="text-xs text-[#999] mt-1">
                {t('resumeKeyDescription')}
              </p>
            </div>

            {/* 메모 */}
            <div>
              <label className="block text-sm font-medium text-[#333] mb-1">
                {t('memoLabel')}
              </label>
              <textarea
                name="memo"
                value={form.memo}
                onChange={handleChange}
                placeholder={t('memoPlaceholder')}
                rows={3}
                className="w-full px-4 py-2 text-sm border border-[#E8E8E8] rounded-lg resize-none focus:outline-none focus:border-[#2196F3] transition-colors duration-150"
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
          </div>
        </div>
      </form>
    </div>
  )
}
