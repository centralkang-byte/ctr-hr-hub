'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { apiClient } from '@/lib/api'
import { ArrowLeft, Save } from 'lucide-react'
import type { SessionUser } from '@/types'

export default function NewCycleClient({ user }: { user: SessionUser }) {
  void user
  const router = useRouter()
  const t = useTranslations('performance')
  const tc = useTranslations('common')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const formSchema = z.object({
    name: z.string().min(1, t('validationEnterName')).max(100),
    year: z.coerce.number().int().min(2020).max(2100),
    half: z.enum(['H1', 'H2', 'ANNUAL']),
    goalStart: z.string().min(1, t('validationEnterStartDate')),
    goalEnd: z.string().min(1, t('validationEnterEndDate')),
    evalStart: z.string().min(1, t('validationEnterStartDate')),
    evalEnd: z.string().min(1, t('validationEnterEndDate')),
  })

  type FormValues = z.input<typeof formSchema>

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      name: '',
      year: new Date().getFullYear(),
      half: 'H1',
      goalStart: '',
      goalEnd: '',
      evalStart: '',
      evalEnd: '',
    },
  })

  const onSubmit = async (data: FormValues) => {
    setSubmitting(true)
    setError(null)
    try {
      await apiClient.post('/api/v1/performance/cycles', {
        name: data.name,
        year: Number(data.year),
        half: data.half,
        goalStart: new Date(data.goalStart).toISOString(),
        goalEnd: new Date(data.goalEnd).toISOString(),
        evalStart: new Date(data.evalStart).toISOString(),
        evalEnd: new Date(data.evalEnd).toISOString(),
      })
      router.push('/settings/performance-cycles')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('cycleCreationFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white p-2 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold text-ctr-primary">{t('newEvaluationCycle')}</h1>
      </div>

      {/* Form */}
      <form

        onSubmit={handleSubmit(onSubmit as Parameters<typeof handleSubmit>[0])}
        className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-6"
      >
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* 이름 */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('nameColumn')}</label>
            <input
              {...register('name')}
              type="text"
              placeholder={t('namePlaceholder')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ctr-secondary focus:outline-none focus:ring-1 focus:ring-ctr-secondary"
            />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
          </div>

          {/* 연도 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('yearLabel')}</label>
            <input
              {...register('year')}
              type="number"
              min={2020}
              max={2100}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ctr-secondary focus:outline-none focus:ring-1 focus:ring-ctr-secondary"
            />
            {errors.year && <p className="mt-1 text-xs text-red-500">{errors.year.message}</p>}
          </div>

          {/* 유형 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('typeLabel')}</label>
            <select
              {...register('half')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ctr-secondary focus:outline-none focus:ring-1 focus:ring-ctr-secondary"
            >
              {(['H1', 'H2', 'ANNUAL'] as const).map((key) => (
                <option key={key} value={key}>{t(`halfLabels.${key}`)}</option>
              ))}
            </select>
            {errors.half && <p className="mt-1 text-xs text-red-500">{errors.half.message}</p>}
          </div>

          {/* 목표설정 시작일 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('goalSettingStart')}</label>
            <input
              {...register('goalStart')}
              type="date"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ctr-secondary focus:outline-none focus:ring-1 focus:ring-ctr-secondary"
            />
            {errors.goalStart && <p className="mt-1 text-xs text-red-500">{errors.goalStart.message}</p>}
          </div>

          {/* 목표설정 종료일 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('goalSettingEnd')}</label>
            <input
              {...register('goalEnd')}
              type="date"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ctr-secondary focus:outline-none focus:ring-1 focus:ring-ctr-secondary"
            />
            {errors.goalEnd && <p className="mt-1 text-xs text-red-500">{errors.goalEnd.message}</p>}
          </div>

          {/* 평가 시작일 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('evalStart')}</label>
            <input
              {...register('evalStart')}
              type="date"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ctr-secondary focus:outline-none focus:ring-1 focus:ring-ctr-secondary"
            />
            {errors.evalStart && <p className="mt-1 text-xs text-red-500">{errors.evalStart.message}</p>}
          </div>

          {/* 평가 종료일 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('evalEnd')}</label>
            <input
              {...register('evalEnd')}
              type="date"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ctr-secondary focus:outline-none focus:ring-1 focus:ring-ctr-secondary"
            />
            {errors.evalEnd && <p className="mt-1 text-xs text-red-500">{errors.evalEnd.message}</p>}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {tc('cancel')}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-ctr-primary px-4 py-2 text-sm font-medium text-white hover:bg-ctr-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4" />
            {submitting ? t('saving') : tc('save')}
          </button>
        </div>
      </form>
    </div>
  )
}
