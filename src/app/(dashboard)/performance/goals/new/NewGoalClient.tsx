'use client'

import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'
import { useSubmitGuard } from '@/hooks/useSubmitGuard'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft } from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'

// ─── Types ────────────────────────────────────────────────

interface CycleOption {
  id: string
  name: string
  status: string
}

// ─── Component ────────────────────────────────────────────

export default function NewGoalClient({
  const tCommon = useTranslations('common')
  const { isSubmitting, guardedSubmit } = useSubmitGuard()
  const t = useTranslations('performance')
 user }: { user: SessionUser }) {
  const router = useRouter()
  const t = useTranslations('performance')
  const tc = useTranslations('common')
  const [cycles, setCycles] = useState<CycleOption[]>([])
  const [submitting, setSubmitting] = useState(false)

  // ─── Schema (uses t for validation messages) ──────────
  const formSchema = z.object({
    cycleId: z.string().min(1, t('validationSelectCycle')),
    title: z.string().min(1, t('validationEnterTitle')).max(200),
    description: z.string().max(2000).optional(),
    weight: z.coerce.number().min(0, t('validationMinZero')).max(100, t('validationMaxHundred')),
    targetMetric: z.string().max(100).optional(),
    targetValue: z.string().max(100).optional(),
  })

  type FormValues = z.input<typeof formSchema>

  const {
    register,
    handleSubmit,
    formState: { errors },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) as any })

  // ─── Fetch cycles ─────────────────────────────────────

  useEffect(() => {
    async function fetchCycles() {
      try {
        const res = await apiClient.getList<CycleOption>(
          '/api/v1/performance/cycles',
          { page: 1, limit: 100 },
        )
        setCycles(res.data)
      } catch {
        console.error(t('cycleListLoadFailed'))
      }
    }
    fetchCycles()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Submit ───────────────────────────────────────────

  async function onSubmit(values: FormValues) {
    setSubmitting(true)
    try {
      await apiClient.post('/api/v1/performance/goals', {
        cycleId: values.cycleId,
        title: values.title,
        description: values.description || undefined,
        weight: Number(values.weight),
        targetMetric: values.targetMetric || undefined,
        targetValue: values.targetValue || undefined,
      })
      router.push('/performance/goals')
    } catch {
      alert(t('registerFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Render ───────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#FAFAFA] p-6">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/performance/goals')}
            className="mb-4 inline-flex items-center gap-1 text-sm text-[#999] hover:text-[#00C853] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('backToGoalList')}
          </button>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">{t('newGoalRegister')}</h1>
        </div>

        {/* Form */}
        <form
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onSubmit={handleSubmit(onSubmit as any)}
          className="space-y-5 rounded-lg bg-white p-6"
        >
          {/* 사이클 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[#666]">
              {t('cycleLabel')} <span className="text-[#EF4444]">*</span>
            </label>
            <select
              {...register('cycleId')}
              className="w-full rounded-lg border border-[#E8E8E8] px-3 py-2 text-sm focus:border-[#00C853] focus:outline-none focus:ring-2 focus:ring-[#00C853]/10"
            >
              <option value="">{t('selectCycle')}</option>
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {errors.cycleId && (
              <p className="mt-1 text-xs text-[#EF4444]">{errors.cycleId.message}</p>
            )}
          </div>

          {/* 제목 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[#666]">
              {t('titleLabel')} <span className="text-[#EF4444]">*</span>
            </label>
            <input
              type="text"
              {...register('title')}
              placeholder={t('titlePlaceholder')}
              className="w-full rounded-lg border border-[#E8E8E8] px-3 py-2 text-sm focus:border-[#00C853] focus:outline-none focus:ring-2 focus:ring-[#00C853]/10"
            />
            {errors.title && (
              <p className="mt-1 text-xs text-[#EF4444]">{errors.title.message}</p>
            )}
          </div>

          {/* 설명 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[#666]">
              {t('descriptionLabel')}
            </label>
            <textarea
              rows={4}
              {...register('description')}
              placeholder={t('descriptionPlaceholder')}
              className="w-full rounded-lg border border-[#E8E8E8] px-3 py-2 text-sm focus:border-[#00C853] focus:outline-none focus:ring-2 focus:ring-[#00C853]/10"
            />
            {errors.description && (
              <p className="mt-1 text-xs text-[#EF4444]">
                {errors.description.message}
              </p>
            )}
          </div>

          {/* 가중치 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[#666]">
              {t('weightPercent')} <span className="text-[#EF4444]">*</span>
            </label>
            <input
              type="number"
              min={0}
              max={100}
              {...register('weight')}
              className="w-32 rounded-lg border border-[#E8E8E8] px-3 py-2 text-sm focus:border-[#00C853] focus:outline-none focus:ring-2 focus:ring-[#00C853]/10"
            />
            {errors.weight && (
              <p className="mt-1 text-xs text-[#EF4444]">{errors.weight.message}</p>
            )}
          </div>

          {/* KPI 지표 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[#666]">
              {t('kpiMetric')}
            </label>
            <input
              type="text"
              {...register('targetMetric')}
              placeholder={t('kpiMetricPlaceholder')}
              className="w-full rounded-lg border border-[#E8E8E8] px-3 py-2 text-sm focus:border-[#00C853] focus:outline-none focus:ring-2 focus:ring-[#00C853]/10"
            />
            {errors.targetMetric && (
              <p className="mt-1 text-xs text-[#EF4444]">
                {errors.targetMetric.message}
              </p>
            )}
          </div>

          {/* 목표값 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[#666]">
              {t('targetValue')}
            </label>
            <input
              type="text"
              {...register('targetValue')}
              placeholder={t('targetValuePlaceholder')}
              className="w-full rounded-lg border border-[#E8E8E8] px-3 py-2 text-sm focus:border-[#00C853] focus:outline-none focus:ring-2 focus:ring-[#00C853]/10"
            />
            {errors.targetValue && (
              <p className="mt-1 text-xs text-[#EF4444]">
                {errors.targetValue.message}
              </p>
            )}
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-[#00C853] px-6 py-2 text-sm font-medium text-white hover:bg-[#00A844] disabled:opacity-50 transition-colors"
            >
              {submitting ? t('registering') : t('registerGoal')}
            </button>
            <button
              type="button"
              onClick={() => router.push('/performance/goals')}
              className="rounded-lg border border-[#E8E8E8] px-6 py-2 text-sm font-medium text-[#666] hover:bg-[#FAFAFA] transition-colors"
            >
              {tc('cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
