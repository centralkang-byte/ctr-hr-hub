'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Loader2, X, ChevronRight, ChevronLeft, CheckCircle2 } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { BUTTON_VARIANTS, MODAL_STYLES } from '@/lib/styles'

// ─── Types ──────────────────────────────────────────────────

interface Props {
  applicationId: string
  applicantName: string
  applicantEmail: string
  postingDepartment?: string
  postingGrade?: string
  postingCompanyId?: string
}

interface RefOption {
  id: string
  name: string
}

// ─── Component ──────────────────────────────────────────────

export default function ConvertToEmployeeButton({
  applicationId,
  applicantName,
  applicantEmail,
  postingDepartment,
  postingGrade,
  postingCompanyId: _postingCompanyId,
}: Props) {
  const router = useRouter()
  const t = useTranslations('recruitment')
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'form' | 'review'>('form')
  const [loading, setLoading] = useState(false)
  const [departments, setDepartments] = useState<RefOption[]>([])
  const [grades, setGrades] = useState<RefOption[]>([])
  const [form, setForm] = useState({
    employeeNo: '',
    startDate: '',
    departmentId: '',
    jobGradeId: '',
  })

  const fetchRefs = useCallback(async () => {
    try {
      const [deptRes, gradeRes] = await Promise.all([
        apiClient.getList<RefOption>('/api/v1/org/departments', { limit: 200 }),
        apiClient.getList<RefOption>('/api/v1/org/grades', { limit: 200 }),
      ])
      setDepartments(deptRes.data)
      setGrades(gradeRes.data)
    } catch {
      // 참조 데이터 로드 실패 — 수동 입력으로 대체
    }
  }, [])

  useEffect(() => {
    if (open) {
      fetchRefs()
      setStep('form')
      setForm({ employeeNo: '', startDate: '', departmentId: '', jobGradeId: '' })
    }
  }, [open, fetchRefs])

  const selectedDept = departments.find((d) => d.id === form.departmentId)
  const selectedGrade = grades.find((g) => g.id === form.jobGradeId)

  const handleConvert = async () => {
    setLoading(true)
    try {
      const res = await apiClient.post<{ employeeId: string; employeeNo: string; alreadyConverted?: boolean }>(
        `/api/v1/recruitment/applications/${applicationId}/convert-to-employee`,
        {
          employeeNo: form.employeeNo || undefined,
          startDate: form.startDate,
          departmentId: form.departmentId || undefined,
          jobGradeId: form.jobGradeId || undefined,
        },
      )
      setOpen(false)

      if (res.data.alreadyConverted) {
        toast({ title: t('convertAlreadyDone') })
      } else {
        toast({ title: t('convertSuccess'), description: t('convertSuccessDesc', { no: res.data.employeeNo }) })
      }
      router.refresh()
    } catch (err) {
      toast({
        title: t('convertFailed'),
        description: err instanceof Error ? err.message : t('convertFailedDesc'),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const inputClass = 'w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors'
  const labelClass = 'block text-sm font-medium text-foreground mb-1'

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`px-3 py-1.5 text-sm font-medium ${BUTTON_VARIANTS.primary} rounded-lg transition-colors duration-150`}
      >
        {t('convertButton')}
      </button>

      {open && (
        <div className={MODAL_STYLES.container}>
          <div className="bg-card rounded-2xl w-full max-w-md mx-4 shadow-lg">
            {/* Header */}
            <div className="flex items-center justify-between p-6 pb-0">
              <h2 className="text-lg font-bold text-foreground tracking-[-0.02em]">
                {applicantName} — {t('convertButton')}
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg hover:bg-background text-muted-foreground transition-colors duration-150"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-2 px-6 pt-3">
              <div className={`w-2 h-2 rounded-full ${step === 'form' ? 'bg-primary' : 'bg-muted'}`} />
              <div className={`w-2 h-2 rounded-full ${step === 'review' ? 'bg-primary' : 'bg-muted'}`} />
              <span className="text-xs text-muted-foreground ml-1">
                {step === 'form' ? t('convertStepInput') : t('convertStepReview')}
              </span>
            </div>

            <div className="p-6 space-y-4">
              {step === 'form' && (
                <>
                  <div>
                    <label className={labelClass}>{t('convertEmployeeNo')}</label>
                    <input
                      placeholder={t('convertEmployeeNoPlaceholder')}
                      value={form.employeeNo}
                      onChange={(e) => setForm((f) => ({ ...f, employeeNo: e.target.value }))}
                      className={inputClass}
                    />
                    <p className="text-xs text-muted-foreground mt-1">{t('convertEmployeeNoHint')}</p>
                  </div>
                  <div>
                    <label className={labelClass}>{t('convertStartDate')} *</label>
                    <input
                      type="date"
                      value={form.startDate}
                      onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  {departments.length > 0 && (
                    <div>
                      <label className={labelClass}>{t('department')}</label>
                      <select
                        value={form.departmentId}
                        onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value }))}
                        className={inputClass}
                      >
                        <option value="">{postingDepartment ? `${t('convertFromPosting')}: ${postingDepartment}` : t('noSelect')}</option>
                        {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                  )}
                  {grades.length > 0 && (
                    <div>
                      <label className={labelClass}>{t('jobGrade')}</label>
                      <select
                        value={form.jobGradeId}
                        onChange={(e) => setForm((f) => ({ ...f, jobGradeId: e.target.value }))}
                        className={inputClass}
                      >
                        <option value="">{postingGrade ? `${t('convertFromPosting')}: ${postingGrade}` : t('noSelect')}</option>
                        {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                    </div>
                  )}

                  <button
                    onClick={() => setStep('review')}
                    disabled={!form.startDate}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium ${BUTTON_VARIANTS.primary} rounded-lg transition-colors duration-150 disabled:opacity-50`}
                  >
                    {t('convertReviewButton')}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}

              {step === 'review' && (
                <>
                  {/* 비가역 경고 */}
                  <div className="p-3 rounded-xl bg-warning/10 text-warning text-sm font-medium">
                    {t('convertIrreversibleWarning')}
                  </div>

                  {/* 프리뷰 테이블 */}
                  <div className="space-y-2">
                    <ReviewRow label={t('convertPreviewName')} value={applicantName} />
                    <ReviewRow label={t('convertPreviewEmail')} value={applicantEmail} />
                    <ReviewRow label={t('convertPreviewStartDate')} value={form.startDate} />
                    <ReviewRow
                      label={t('convertPreviewEmployeeNo')}
                      value={form.employeeNo || t('convertAutoGenerate')}
                    />
                    <ReviewRow
                      label={t('department')}
                      value={selectedDept?.name ?? postingDepartment ?? t('convertFromPostingDefault')}
                    />
                    <ReviewRow
                      label={t('jobGrade')}
                      value={selectedGrade?.name ?? postingGrade ?? t('convertFromPostingDefault')}
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setStep('form')}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium border border-border text-foreground hover:bg-background rounded-lg transition-colors duration-150"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      {t('convertBackButton')}
                    </button>
                    <button
                      onClick={handleConvert}
                      disabled={loading}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium ${BUTTON_VARIANTS.primary} rounded-lg transition-colors duration-150 disabled:opacity-50`}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {t('convertProcessing')}
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          {t('convertConfirmButton')}
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Sub Components ──────────────────────────────────────────

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  )
}
