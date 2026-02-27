'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 포상 등록 폼 (Client)
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ChevronLeft, Award } from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'

// ─── Options ─────────────────────────────────────────────

const REWARD_TYPE_OPTIONS = [
  { value: 'COMMENDATION', label: '표창' },
  { value: 'BONUS_AWARD', label: '포상금' },
  { value: 'PROMOTION_RECOMMENDATION', label: '승진추천' },
  { value: 'LONG_SERVICE', label: '장기근속' },
  { value: 'INNOVATION', label: '혁신상' },
  { value: 'SAFETY_AWARD', label: '안전상' },
  { value: 'CTR_VALUE_AWARD', label: 'CTR 핵심가치상' },
  { value: 'OTHER', label: '기타' },
]

const CTR_VALUE_OPTIONS = [
  { value: 'CHALLENGE', label: '도전 (CHALLENGE)' },
  { value: 'TRUST', label: '신뢰 (TRUST)' },
  { value: 'RESPONSIBILITY', label: '책임 (RESPONSIBILITY)' },
  { value: 'RESPECT', label: '존중 (RESPECT)' },
]

// ─── Schema ──────────────────────────────────────────────

const formSchema = z.object({
  employeeId: z.string().min(1, '사원을 선택해주세요.'),
  rewardType: z.string().min(1, '포상유형을 선택해주세요.'),
  title: z.string().min(1, '포상명을 입력해주세요.'),
  description: z.string().optional(),
  amount: z.coerce.number().min(0).optional().or(z.literal('')),
  awardedDate: z.string().min(1, '수여일을 입력해주세요.'),
  ctrValue: z.string().optional(),
  serviceYears: z.coerce.number().int().min(0).optional().or(z.literal('')),
})

type FormInput = z.input<typeof formSchema>

// ─── Types ───────────────────────────────────────────────

interface EmployeeOption {
  id: string
  name: string
  employeeNo: string
}

interface Props {
  user: SessionUser
}

// ─── Component ───────────────────────────────────────────

export default function RewardFormClient({ user }: Props) {
  const router = useRouter()
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [submitting, setSubmitting] = useState(false)

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
      rewardType: '',
      title: '',
      description: '',
      amount: '',
      awardedDate: '',
      ctrValue: '',
      serviceYears: '',
    },
  })

  const rewardType = watch('rewardType')

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await apiClient.getList<EmployeeOption>('/api/v1/employees', { limit: 100 })
      setEmployees(res.data)
    } catch { /* silently handle */ }
  }, [])

  useEffect(() => { fetchEmployees() }, [fetchEmployees])

  const onSubmit = async (values: FormInput) => {
    setSubmitting(true)
    try {
      await apiClient.post('/api/v1/rewards', {
        employeeId: values.employeeId,
        rewardType: values.rewardType,
        title: values.title,
        description: values.description || undefined,
        amount: values.amount !== '' ? Number(values.amount) : undefined,
        awardedDate: values.awardedDate,
        ctrValue: values.ctrValue || undefined,
        serviceYears: values.serviceYears !== '' ? Number(values.serviceYears) : undefined,
      })
      router.push('/discipline/rewards')
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
          <div className="w-10 h-10 bg-[#E8F5E9] rounded-lg flex items-center justify-center">
            <Award className="w-5 h-5 text-[#00C853]" />
          </div>
          <h1 className="text-xl font-bold text-[#333]" style={{ letterSpacing: '-0.02em' }}>
            포상 등록
          </h1>
        </div>
      </div>

      {/* Form */}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-6 max-w-3xl">
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
          <h2 className="text-base font-bold text-[#333] mb-4" style={{ letterSpacing: '-0.02em' }}>
            포상 정보
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Employee */}
            <div>
              <label className="block text-sm font-medium text-[#333] mb-1">대상 사원 *</label>
              <select
                {...register('employeeId')}
                className="w-full px-3 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-[#2196F3] bg-white"
              >
                <option value="">사원 선택</option>
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

            {/* Reward Type */}
            <div>
              <label className="block text-sm font-medium text-[#333] mb-1">포상유형 *</label>
              <select
                {...register('rewardType')}
                className="w-full px-3 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-[#2196F3] bg-white"
              >
                <option value="">유형 선택</option>
                {REWARD_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {errors.rewardType && (
                <p className="text-xs text-[#F44336] mt-1">{errors.rewardType.message}</p>
              )}
            </div>

            {/* Title */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-[#333] mb-1">포상명 *</label>
              <input
                type="text"
                {...register('title')}
                placeholder="포상 명칭을 입력해주세요."
                className="w-full px-3 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-[#2196F3]"
              />
              {errors.title && (
                <p className="text-xs text-[#F44336] mt-1">{errors.title.message}</p>
              )}
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-[#333] mb-1">금액 (원)</label>
              <input
                type="number"
                min={0}
                {...register('amount')}
                placeholder="0"
                className="w-full px-3 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-[#2196F3]"
              />
            </div>

            {/* Awarded Date */}
            <div>
              <label className="block text-sm font-medium text-[#333] mb-1">수여일 *</label>
              <input
                type="date"
                {...register('awardedDate')}
                className="w-full px-3 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-[#2196F3]"
              />
              {errors.awardedDate && (
                <p className="text-xs text-[#F44336] mt-1">{errors.awardedDate.message}</p>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-[#333] mb-1">설명</label>
            <textarea
              {...register('description')}
              rows={3}
              placeholder="포상 사유를 입력해주세요."
              className="w-full px-3 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-[#2196F3] resize-none"
            />
          </div>
        </div>

        {/* Conditional: CTR_VALUE_AWARD */}
        {rewardType === 'CTR_VALUE_AWARD' && (
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
            <h2 className="text-base font-bold text-[#333] mb-4" style={{ letterSpacing: '-0.02em' }}>
              CTR 핵심가치 선택
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {CTR_VALUE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-3 p-3 border border-[#E8E8E8] rounded-lg cursor-pointer hover:bg-[#FAFAFA] transition-colors"
                >
                  <input
                    type="radio"
                    value={opt.value}
                    {...register('ctrValue')}
                    className="w-4 h-4 text-[#00C853] focus:ring-[#00C853]"
                  />
                  <span className="text-sm text-[#333]">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Conditional: LONG_SERVICE */}
        {rewardType === 'LONG_SERVICE' && (
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-6">
            <h2 className="text-base font-bold text-[#333] mb-4" style={{ letterSpacing: '-0.02em' }}>
              장기근속 정보
            </h2>
            <div>
              <label className="block text-sm font-medium text-[#333] mb-1">근속 연수</label>
              <input
                type="number"
                min={0}
                {...register('serviceYears')}
                placeholder="예: 10"
                className="w-full px-3 py-2 text-sm border border-[#E8E8E8] rounded-lg focus:outline-none focus:border-[#2196F3]"
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 text-sm font-medium bg-[#00C853] hover:bg-[#00A844] text-white rounded-lg transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? '등록 중...' : '포상 등록'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2.5 text-sm font-medium border border-[#E8E8E8] text-[#333] hover:bg-[#FAFAFA] rounded-lg transition-colors duration-150"
          >
            취소
          </button>
        </div>
      </form>
    </div>
  )
}
