'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 채용공고 등록 폼 (Client)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ChevronLeft, Briefcase, Sparkles, Loader2 } from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'

// ─── Reference Types ─────────────────────────────────────

interface RefOption {
  id: string
  name: string
}

interface EmployeeOption {
  id: string
  name: string
  employeeNo: string
}

interface Props {
  user: SessionUser
}

// ─── Component ───────────────────────────────────────────

export default function PostingFormClient({ user }: Props) {
  const router = useRouter()
  const t = useTranslations('recruitment')

  // ─── Options (use t() for labels) ─────────────────────
  const EMPLOYMENT_TYPE_OPTIONS = [
    { value: 'FULL_TIME', label: t('typeFULL_TIME') },
    { value: 'CONTRACT', label: t('typeCONTRACT') },
    { value: 'DISPATCH', label: t('typeDISPATCH') },
    { value: 'INTERN', label: t('typeINTERN') },
  ]

  const WORK_MODE_OPTIONS = [
    { value: '', label: t('noSelect') },
    { value: 'OFFICE', label: t('modeOFFICE') },
    { value: 'REMOTE', label: t('modeREMOTE') },
    { value: 'HYBRID', label: t('modeHYBRID') },
  ]

  // ─── Schema ──────────────────────────────────────────
  const formSchema = z.object({
    title: z.string().min(1, t('validationTitle')),
    description: z.string().min(1, t('validationDescription')),
    requirements: z.string().optional(),
    preferred: z.string().optional(),
    employmentType: z.string().min(1, t('validationEmploymentType')),
    departmentId: z.string().optional(),
    jobGradeId: z.string().optional(),
    jobCategoryId: z.string().optional(),
    workMode: z.string().optional(),
    headcount: z.coerce.number().int().min(1).default(1),
    location: z.string().optional(),
    salaryRangeMin: z.coerce.number().optional().or(z.literal('')),
    salaryRangeMax: z.coerce.number().optional().or(z.literal('')),
    salaryHidden: z.boolean().optional(),
    deadlineDate: z.string().optional(),
    recruiterId: z.string().optional(),
    requiredCompetencies: z.string().optional(),
  })

  type FormData = z.input<typeof formSchema>

  const [submitting, setSubmitting] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [departments, setDepartments] = useState<RefOption[]>([])
  const [grades, setGrades] = useState<RefOption[]>([])
  const [categories, setCategories] = useState<RefOption[]>([])
  const [employees, setEmployees] = useState<EmployeeOption[]>([])

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      title: '',
      description: '',
      requirements: '',
      preferred: '',
      employmentType: 'FULL_TIME',
      headcount: 1,
      salaryHidden: false,
    },
  })

  // ─── Fetch reference data ──────────────────────────────

  const fetchRefData = useCallback(async () => {
    try {
      const [deptRes, gradeRes, catRes, empRes] = await Promise.all([
        apiClient.getList<RefOption>('/api/v1/org/departments', { limit: 200 }),
        apiClient.getList<RefOption>('/api/v1/org/grades', { limit: 200 }),
        apiClient.getList<RefOption>('/api/v1/org/job-categories', { limit: 200 }),
        apiClient.getList<EmployeeOption>('/api/v1/employees', { limit: 200 }),
      ])
      setDepartments(deptRes.data)
      setGrades(gradeRes.data)
      setCategories(catRes.data)
      setEmployees(empRes.data)
    } catch {
      /* silently handle */
    }
  }, [])

  useEffect(() => { fetchRefData() }, [fetchRefData])

  // ─── AI Draft Generation ──────────────────────────────

  const handleAiGenerate = async () => {
    const title = watch('title')
    if (!title) return

    const deptId = watch('departmentId')
    const gradeId = watch('jobGradeId')
    const catId = watch('jobCategoryId')

    const dept = departments.find((d) => d.id === deptId)
    const grade = grades.find((g) => g.id === gradeId)
    const cat = categories.find((c) => c.id === catId)

    setAiLoading(true)
    try {
      const res = await apiClient.post<{
        description: string
        qualifications: string
        preferred: string
      }>('/api/v1/ai/job-description', {
        title,
        department: dept?.name,
        grade: grade?.name,
        category: cat?.name,
      })

      setValue('description', res.data.description)
      setValue('requirements', res.data.qualifications)
      setValue('preferred', res.data.preferred)
    } catch {
      /* silently handle */
    } finally {
      setAiLoading(false)
    }
  }

  // ─── Submit ───────────────────────────────────────────

  const onSubmit = async (formData: FormData) => {
    setSubmitting(true)
    try {
      const payload = {
        title: formData.title,
        description: formData.description,
        requirements: formData.requirements || undefined,
        preferred: formData.preferred || undefined,
        employmentType: formData.employmentType,
        departmentId: formData.departmentId || undefined,
        jobGradeId: formData.jobGradeId || undefined,
        jobCategoryId: formData.jobCategoryId || undefined,
        location: formData.location || undefined,
        salaryRangeMin: formData.salaryRangeMin && formData.salaryRangeMin !== '' ? Number(formData.salaryRangeMin) : undefined,
        salaryRangeMax: formData.salaryRangeMax && formData.salaryRangeMax !== '' ? Number(formData.salaryRangeMax) : undefined,
        salaryHidden: formData.salaryHidden ?? false,
        headcount: formData.headcount,
        workMode: formData.workMode || undefined,
        recruiterId: formData.recruiterId || undefined,
        deadlineDate: formData.deadlineDate || undefined,
        requiredCompetencies: formData.requiredCompetencies
          ? formData.requiredCompetencies.split(',').map((s) => s.trim()).filter(Boolean)
          : undefined,
      }

      const res = await apiClient.post<{ id: string }>('/api/v1/recruitment/postings', payload)
      router.push(`/recruitment/${res.data.id}`)
    } catch {
      /* silently handle */
    } finally {
      setSubmitting(false)
    }
  }

  void user

  // ─── Field Style ──────────────────────────────────────

  const inputClass = 'w-full px-3 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-[#2196F3] transition-colors'
  const labelClass = 'block text-sm font-medium text-[#333] mb-1'
  const errorClass = 'text-xs text-[#F44336] mt-1'

  return (
    <div className="min-h-screen bg-[#FAFAFA] p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg border border-[#E8E8E8] hover:bg-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-[#666]" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#E3F2FD] rounded-lg flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-[#2196F3]" />
          </div>
          <h1 className="text-xl font-bold text-[#333]" style={{ letterSpacing: '-0.02em' }}>
            {t('registerPostingTitle')}
          </h1>
        </div>
      </div>

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <form onSubmit={handleSubmit(onSubmit as any)}>
        {/* 기본정보 */}
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-6 mb-6">
          <h2 className="text-base font-bold text-[#333] mb-4" style={{ letterSpacing: '-0.02em' }}>
            {t('basicInfo')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className={labelClass}>{t('postingTitleLabel')}</label>
              <input {...register('title')} className={inputClass} placeholder={t('postingTitlePlaceholder')} />
              {errors.title && <p className={errorClass}>{errors.title.message}</p>}
            </div>

            <div>
              <label className={labelClass}>{t('departmentLabel')}</label>
              <select {...register('departmentId')} className={inputClass}>
                <option value="">{t('noSelect')}</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>{t('jobGradeLabel')}</label>
              <select {...register('jobGradeId')} className={inputClass}>
                <option value="">{t('noSelect')}</option>
                {grades.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>{t('jobCategoryLabel')}</label>
              <select {...register('jobCategoryId')} className={inputClass}>
                <option value="">{t('noSelect')}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>{t('employmentTypeLabel')}</label>
              <select {...register('employmentType')} className={inputClass}>
                {EMPLOYMENT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {errors.employmentType && <p className={errorClass}>{errors.employmentType.message}</p>}
            </div>

            <div>
              <label className={labelClass}>{t('workModeLabel')}</label>
              <select {...register('workMode')} className={inputClass}>
                {WORK_MODE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>{t('headcountLabel')}</label>
              <input {...register('headcount')} type="number" min={1} className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>{t('locationLabel')}</label>
              <input {...register('location')} className={inputClass} placeholder={t('locationPlaceholder')} />
            </div>
          </div>
        </div>

        {/* 공고내용 */}
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-[#333]" style={{ letterSpacing: '-0.02em' }}>
              {t('postingContent')}
            </h2>
            <button
              type="button"
              onClick={handleAiGenerate}
              disabled={aiLoading || !watch('title')}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#2196F3] hover:bg-[#1976D2] text-white rounded-lg transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {aiLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {t('aiDraftGenerate')}
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className={labelClass}>{t('descriptionLabel')}</label>
              <textarea
                {...register('description')}
                rows={5}
                className={inputClass}
                placeholder={t('descriptionPlaceholder')}
              />
              {errors.description && <p className={errorClass}>{errors.description.message}</p>}
            </div>

            <div>
              <label className={labelClass}>{t('requirementsLabel')}</label>
              <textarea
                {...register('requirements')}
                rows={4}
                className={inputClass}
                placeholder={t('requirementsPlaceholder')}
              />
            </div>

            <div>
              <label className={labelClass}>{t('preferredLabel')}</label>
              <textarea
                {...register('preferred')}
                rows={4}
                className={inputClass}
                placeholder={t('preferredPlaceholder')}
              />
            </div>
          </div>
        </div>

        {/* 급여 */}
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-6 mb-6">
          <h2 className="text-base font-bold text-[#333] mb-4" style={{ letterSpacing: '-0.02em' }}>
            {t('salarySection')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t('salaryMinLabel')}</label>
              <input {...register('salaryRangeMin')} type="number" className={inputClass} placeholder="0" />
            </div>
            <div>
              <label className={labelClass}>{t('salaryMaxLabel')}</label>
              <input {...register('salaryRangeMax')} type="number" className={inputClass} placeholder="0" />
            </div>
            <div className="md:col-span-2">
              <label className="flex items-center gap-2 text-sm text-[#333]">
                <input {...register('salaryHidden')} type="checkbox" className="rounded border-[#E8E8E8]" />
                {t('salaryHiddenLabel')}
              </label>
            </div>
          </div>
        </div>

        {/* 채용정보 */}
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-6 mb-6">
          <h2 className="text-base font-bold text-[#333] mb-4" style={{ letterSpacing: '-0.02em' }}>
            {t('recruitmentInfo')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t('deadlineDateLabel')}</label>
              <input {...register('deadlineDate')} type="date" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>{t('recruiterLabel')}</label>
              <select {...register('recruiterId')} className={inputClass}>
                <option value="">{t('noSelect')}</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.name} ({e.employeeNo})</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>{t('competenciesLabel')}</label>
              <input
                {...register('requiredCompetencies')}
                className={inputClass}
                placeholder={t('competenciesPlaceholder')}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2.5 text-sm font-medium border border-[#E8E8E8] text-[#333] hover:bg-[#FAFAFA] rounded-lg transition-colors duration-150"
          >
            {t('cancelButton')}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 text-sm font-medium bg-[#00C853] hover:bg-[#00A844] text-white rounded-lg transition-colors duration-150 disabled:opacity-50"
          >
            {submitting ? t('saving') : t('registerButton')}
          </button>
        </div>
      </form>
    </div>
  )
}
