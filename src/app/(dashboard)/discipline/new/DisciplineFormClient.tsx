'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 징계 등록 폼 (Client)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ChevronLeft, Gavel, ChevronDown, ChevronUp } from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'

// ─── Schema ──────────────────────────────────────────────

const formSchema = z.object({
  employeeId: z.string().min(1, '사원을 선택해주세요.'),
  actionType: z.string().min(1, '징계유형을 선택해주세요.'),
  category: z.string().min(1, '분류를 선택해주세요.'),
  incidentDate: z.string().min(1, '사건일자를 입력해주세요.'),
  description: z.string().min(1, '설명을 입력해주세요.'),
  evidenceKeys: z.string().optional(),
  committeeDate: z.string().optional(),
  committeeMembers: z.string().optional(),
  decision: z.string().optional(),
  decisionDate: z.string().optional(),
  suspensionStart: z.string().optional(),
  suspensionEnd: z.string().optional(),
  validMonths: z.coerce.number().int().min(1).optional().or(z.literal('')),
  demotionGradeId: z.string().optional(),
  salaryReductionRate: z.coerce.number().min(0).max(100).optional().or(z.literal('')),
  salaryReductionMonths: z.coerce.number().int().min(1).optional().or(z.literal('')),
})

type FormInput = z.input<typeof formSchema>

// ─── Types ───────────────────────────────────────────────

interface EmployeeOption {
  id: string
  name: string
  employeeNo: string
}

interface GradeOption {
  id: string
  name: string
}

interface Props {
  user: SessionUser
}

const TYPE_KEYS = ['VERBAL_WARNING', 'WRITTEN_WARNING', 'REPRIMAND', 'SUSPENSION', 'PAY_CUT', 'DEMOTION', 'TERMINATION'] as const
const CATEGORY_KEYS = ['ATTENDANCE', 'SAFETY', 'QUALITY', 'CONDUCT', 'POLICY_VIOLATION', 'MISCONDUCT', 'HARASSMENT', 'FRAUD', 'OTHER'] as const

// ─── Component ───────────────────────────────────────────

export default function DisciplineFormClient({ user }: Props) {
  const router = useRouter()
  const t = useTranslations('disciplineForm')
  const tPage = useTranslations('disciplinePage')
  const tCommon = useTranslations('common')

  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [grades, setGrades] = useState<GradeOption[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [committeeOpen, setCommitteeOpen] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      employeeId: '',
      actionType: '',
      category: '',
      incidentDate: '',
      description: '',
      evidenceKeys: '',
      committeeDate: '',
      committeeMembers: '',
      decision: '',
      decisionDate: '',
      suspensionStart: '',
      suspensionEnd: '',
      validMonths: '',
      demotionGradeId: '',
      salaryReductionRate: '',
      salaryReductionMonths: '',
    },
  })

  const actionType = watch('actionType')

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await apiClient.getList<EmployeeOption>('/api/v1/employees', { limit: 100 })
      setEmployees(res.data)
    } catch { /* silently handle */ }
  }, [])

  const fetchGrades = useCallback(async () => {
    try {
      const res = await apiClient.getList<GradeOption>('/api/v1/org/grades', { limit: 100 })
      setGrades(res.data)
    } catch { /* silently handle */ }
  }, [])

  useEffect(() => {
    fetchEmployees()
    fetchGrades()
  }, [fetchEmployees, fetchGrades])

  const onSubmit = async (values: FormInput) => {
    setSubmitting(true)
    try {
      const evidenceArr = values.evidenceKeys
        ? values.evidenceKeys.split('\n').map((s) => s.trim()).filter(Boolean)
        : undefined
      const committeeMembersArr = values.committeeMembers
        ? values.committeeMembers.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined

      await apiClient.post('/api/v1/disciplinary', {
        employeeId: values.employeeId,
        actionType: values.actionType,
        category: values.category,
        incidentDate: values.incidentDate,
        description: values.description,
        evidenceKeys: evidenceArr,
        committeeDate: values.committeeDate || undefined,
        committeeMembers: committeeMembersArr,
        decision: values.decision || undefined,
        decisionDate: values.decisionDate || undefined,
        suspensionStart: values.suspensionStart || undefined,
        suspensionEnd: values.suspensionEnd || undefined,
        validMonths: values.validMonths !== '' ? Number(values.validMonths) : undefined,
        demotionGradeId: values.demotionGradeId || undefined,
        salaryReductionRate: values.salaryReductionRate !== '' ? Number(values.salaryReductionRate) : undefined,
        salaryReductionMonths: values.salaryReductionMonths !== '' ? Number(values.salaryReductionMonths) : undefined,
      })
      router.push('/discipline')
    } catch {
      /* silently handle */
    } finally {
      setSubmitting(false)
    }
  }

  void user

  return (
    <div className="min-h-screen bg-[#FAFAFA] p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 border border-[#E8E8E8] rounded-lg hover:bg-[#FAFAFA] transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-[#666]" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#FFEBEE] rounded-lg flex items-center justify-center">
            <Gavel className="w-5 h-5 text-[#F44336]" />
          </div>
          <h1 className="text-xl font-bold text-[#333]" style={{ letterSpacing: '-0.02em' }}>
            {t('title')}
          </h1>
        </div>
      </div>

      {/* Form */}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-6 max-w-3xl">
        {/* Basic Info */}
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
          <h2 className="text-base font-bold text-[#333] mb-4" style={{ letterSpacing: '-0.02em' }}>
            {t('basicInfo')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Employee */}
            <div>
              <label className="block text-sm font-medium text-[#333] mb-1">{t('targetEmployee')} *</label>
              <select
                {...register('employeeId')}
                className="w-full px-3 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-[#2196F3] bg-white"
              >
                <option value="">{t('selectEmployee')}</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.employeeNo})
                  </option>
                ))}
              </select>
              {errors.employeeId && (
                <p className="text-xs text-[#F44336] mt-1">{errors.employeeId.message}</p>
              )}
            </div>

            {/* Action Type */}
            <div>
              <label className="block text-sm font-medium text-[#333] mb-1">{tPage('disciplineType')} *</label>
              <select
                {...register('actionType')}
                className="w-full px-3 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-[#2196F3] bg-white"
              >
                <option value="">{t('selectType')}</option>
                {TYPE_KEYS.map((key) => (
                  <option key={key} value={key}>{tPage(`typeLabels.${key}`)}</option>
                ))}
              </select>
              {errors.actionType && (
                <p className="text-xs text-[#F44336] mt-1">{errors.actionType.message}</p>
              )}
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-[#333] mb-1">{tCommon('category')} *</label>
              <select
                {...register('category')}
                className="w-full px-3 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-[#2196F3] bg-white"
              >
                <option value="">{t('selectCategory')}</option>
                {CATEGORY_KEYS.map((key) => (
                  <option key={key} value={key}>{tPage(`categoryLabels.${key}`)}</option>
                ))}
              </select>
              {errors.category && (
                <p className="text-xs text-[#F44336] mt-1">{errors.category.message}</p>
              )}
            </div>

            {/* Incident Date */}
            <div>
              <label className="block text-sm font-medium text-[#333] mb-1">{tPage('incidentDate')} *</label>
              <input
                type="date"
                {...register('incidentDate')}
                className="w-full px-3 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-[#2196F3]"
              />
              {errors.incidentDate && (
                <p className="text-xs text-[#F44336] mt-1">{errors.incidentDate.message}</p>
              )}
            </div>

            {/* Valid Months */}
            <div>
              <label className="block text-sm font-medium text-[#333] mb-1">{t('validMonthsLabel')}</label>
              <input
                type="number"
                min={1}
                {...register('validMonths')}
                placeholder={t('validMonthsPlaceholder')}
                className="w-full px-3 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-[#2196F3]"
              />
            </div>
          </div>

          {/* Description */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-[#333] mb-1">{tCommon('description')} *</label>
            <textarea
              {...register('description')}
              rows={4}
              placeholder={t('descriptionPlaceholder')}
              className="w-full px-3 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-[#2196F3] resize-none"
            />
            {errors.description && (
              <p className="text-xs text-[#F44336] mt-1">{errors.description.message}</p>
            )}
          </div>

          {/* Evidence */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-[#333] mb-1">{t('evidenceLabel')}</label>
            <textarea
              {...register('evidenceKeys')}
              rows={2}
              placeholder={t('evidencePlaceholder')}
              className="w-full px-3 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-[#2196F3] resize-none"
            />
          </div>
        </div>

        {/* Conditional: SUSPENSION */}
        {actionType === 'SUSPENSION' && (
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
            <h2 className="text-base font-bold text-[#333] mb-4" style={{ letterSpacing: '-0.02em' }}>
              {t('suspensionPeriod')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#333] mb-1">{t('suspensionStart')}</label>
                <input
                  type="date"
                  {...register('suspensionStart')}
                  className="w-full px-3 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-[#2196F3]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#333] mb-1">{t('suspensionEnd')}</label>
                <input
                  type="date"
                  {...register('suspensionEnd')}
                  className="w-full px-3 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-[#2196F3]"
                />
              </div>
            </div>
          </div>
        )}

        {/* Conditional: PAY_CUT */}
        {actionType === 'PAY_CUT' && (
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
            <h2 className="text-base font-bold text-[#333] mb-4" style={{ letterSpacing: '-0.02em' }}>
              {t('payCutConditions')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#333] mb-1">{t('reductionRate')}</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  {...register('salaryReductionRate')}
                  placeholder={t('reductionRatePlaceholder')}
                  className="w-full px-3 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-[#2196F3]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#333] mb-1">{t('reductionPeriod')}</label>
                <input
                  type="number"
                  min={1}
                  {...register('salaryReductionMonths')}
                  placeholder={t('reductionPeriodPlaceholder')}
                  className="w-full px-3 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-[#2196F3]"
                />
              </div>
            </div>
          </div>
        )}

        {/* Conditional: DEMOTION */}
        {actionType === 'DEMOTION' && (
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
            <h2 className="text-base font-bold text-[#333] mb-4" style={{ letterSpacing: '-0.02em' }}>
              {t('demotionInfo')}
            </h2>
            <div>
              <label className="block text-sm font-medium text-[#333] mb-1">{t('demotionGrade')}</label>
              <select
                {...register('demotionGradeId')}
                className="w-full px-3 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-[#2196F3] bg-white"
              >
                <option value="">{t('selectGrade')}</option>
                {grades.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Committee (collapsible) */}
        <div className="bg-white border border-[#E8E8E8] rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setCommitteeOpen((prev) => !prev)}
            className="flex items-center justify-between w-full p-6 text-left"
          >
            <h2 className="text-base font-bold text-[#333]" style={{ letterSpacing: '-0.02em' }}>
              {t('committeeOptional')}
            </h2>
            {committeeOpen ? (
              <ChevronUp className="w-4 h-4 text-[#999]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[#999]" />
            )}
          </button>
          {committeeOpen && (
            <div className="px-6 pb-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#333] mb-1">{t('committeeDate')}</label>
                  <input
                    type="date"
                    {...register('committeeDate')}
                    className="w-full px-3 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-[#2196F3]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#333] mb-1">{t('decisionDate')}</label>
                  <input
                    type="date"
                    {...register('decisionDate')}
                    className="w-full px-3 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-[#2196F3]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#333] mb-1">{t('committeeMembersLabel')}</label>
                <input
                  type="text"
                  {...register('committeeMembers')}
                  placeholder={t('committeeMembersPlaceholder')}
                  className="w-full px-3 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-[#2196F3]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#333] mb-1">{t('decisionContent')}</label>
                <textarea
                  {...register('decision')}
                  rows={2}
                  placeholder={t('decisionContentPlaceholder')}
                  className="w-full px-3 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-[#2196F3] resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 text-sm font-medium bg-[#00C853] hover:bg-[#00A844] text-white rounded-lg transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? t('submitting') : t('submitButton')}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2.5 text-sm font-medium border border-[#E8E8E8] text-[#333] hover:bg-[#FAFAFA] rounded-lg transition-colors duration-150"
          >
            {tCommon('cancel')}
          </button>
        </div>
      </form>
    </div>
  )
}
