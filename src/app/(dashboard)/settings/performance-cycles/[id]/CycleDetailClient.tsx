'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { apiClient } from '@/lib/api'
import { format } from 'date-fns'
import { ArrowLeft, Save, ChevronRight } from 'lucide-react'
import type { SessionUser } from '@/types'

interface PerformanceCycle {
  id: string
  name: string
  year: number
  half: string
  status: string
  goalStart: string
  goalEnd: string
  evalStart: string
  evalEnd: string
  _count?: {
    goals: number
    evaluations: number
  }
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-[#F5F5F5] text-[#666]',
  ACTIVE: 'bg-[#E3F2FD] text-[#1565C0]',
  EVAL_OPEN: 'bg-[#FFF8E1] text-[#F57F17]',
  CALIBRATION: 'bg-[#F3E5F5] text-[#7B1FA2]',
  CLOSED: 'bg-[#E8F5E9] text-[#2E7D32]',
}

export default function CycleDetailClient({ user }: { user: SessionUser }) {
  void user
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations('performance')
  const tc = useTranslations('common')
  const cycleId = pathname.split('/').pop() ?? ''

  const [cycle, setCycle] = useState<PerformanceCycle | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const [confirmAdvance, setConfirmAdvance] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const editSchema = z.object({
    name: z.string().min(1, t('validationEnterName')).max(100),
    goalStart: z.string().min(1, t('validationEnterStartDate')),
    goalEnd: z.string().min(1, t('validationEnterEndDate')),
    evalStart: z.string().min(1, t('validationEnterStartDate')),
    evalEnd: z.string().min(1, t('validationEnterEndDate')),
  })

  type EditFormValues = z.input<typeof editSchema>

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(editSchema) as any,
  })

  const fetchCycle = useCallback(async () => {
    if (!cycleId) return
    setLoading(true)
    try {
      const res = await apiClient.get<PerformanceCycle>(`/api/v1/performance/cycles/${cycleId}`)
      setCycle(res.data)
    } catch {
      setCycle(null)
    } finally {
      setLoading(false)
    }
  }, [cycleId])

  useEffect(() => {
    fetchCycle()
  }, [fetchCycle])

  useEffect(() => {
    if (cycle) {
      reset({
        name: cycle.name,
        goalStart: formatDateForInput(cycle.goalStart),
        goalEnd: formatDateForInput(cycle.goalEnd),
        evalStart: formatDateForInput(cycle.evalStart),
        evalEnd: formatDateForInput(cycle.evalEnd),
      })
    }
  }, [cycle, reset])

  const formatDateForInput = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'yyyy-MM-dd')
    } catch {
      return ''
    }
  }

  const formatDateDisplay = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'yyyy-MM-dd')
    } catch {
      return '-'
    }
  }

  const onSave = async (data: EditFormValues) => {
    setSaving(true)
    setError(null)
    try {
      await apiClient.put(`/api/v1/performance/cycles/${cycleId}`, {
        name: data.name,
        goalStart: new Date(data.goalStart).toISOString(),
        goalEnd: new Date(data.goalEnd).toISOString(),
        evalStart: new Date(data.evalStart).toISOString(),
        evalEnd: new Date(data.evalEnd).toISOString(),
      })
      setEditing(false)
      await fetchCycle()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleAdvance = async () => {
    setAdvancing(true)
    setError(null)
    try {
      await apiClient.put(`/api/v1/performance/cycles/${cycleId}/advance`, {})
      setConfirmAdvance(false)
      await fetchCycle()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('statusChangeFailed'))
    } finally {
      setAdvancing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-[#999]">{t('fetchingData')}</p>
      </div>
    )
  }

  if (!cycle) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-[#999]">{t('cycleNotFound')}</p>
        <button
          onClick={() => router.push('/settings/performance-cycles')}
          className="text-sm text-[#00C853] hover:underline"
        >
          {t('backToList')}
        </button>
      </div>
    )
  }

  const isDraft = cycle.status === 'DRAFT'
  const nextAction = t.has(`nextActionLabels.${cycle.status}` as Parameters<typeof t.has>[0])
    ? t(`nextActionLabels.${cycle.status}` as Parameters<typeof t>[0])
    : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/settings/performance-cycles')}
            className="inline-flex items-center justify-center rounded-lg border border-[#E8E8E8] bg-white p-2 text-[#666] hover:bg-[#FAFAFA] transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-[#00C853]">{cycle.name}</h1>
            <p className="text-sm text-[#999] mt-0.5">
              {t('yearUnit', { year: cycle.year })} {t(`halfLabels.${cycle.half}` as Parameters<typeof t>[0])}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isDraft && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="rounded-lg border border-[#E8E8E8] bg-white px-4 py-2 text-sm font-medium text-[#666] hover:bg-[#FAFAFA] transition-colors"
            >
              {t('editCycle')}
            </button>
          )}
          {nextAction && (
            <button
              onClick={() => setConfirmAdvance(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-[#00C853] px-4 py-2 text-sm font-medium text-white hover:bg-[#00A844] transition-colors"
            >
              {nextAction}
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-[#FEE2E2] border border-[#FECACA] px-4 py-3 text-sm text-[#B91C1C]">
          {error}
        </div>
      )}

      {/* Confirm Advance Dialog */}
      {confirmAdvance && nextAction && (
        <div className="rounded-xl border border-[#FDE68A] bg-[#FEFCE8] p-4 flex items-center justify-between">
          <p className="text-sm text-[#854D0E]">
            {t('confirmAdvance', { action: nextAction })}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setConfirmAdvance(false)}
              className="rounded-lg border border-[#E8E8E8] bg-white px-3 py-1.5 text-sm text-[#666] hover:bg-[#FAFAFA]"
            >
              {tc('cancel')}
            </button>
            <button
              onClick={handleAdvance}
              disabled={advancing}
              className="rounded-lg bg-[#EF4444] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {advancing ? t('processing') : tc('confirm')}
            </button>
          </div>
        </div>
      )}

      {/* Detail / Edit Form */}
      {editing ? (
        <form

          onSubmit={handleSubmit(onSave as Parameters<typeof handleSubmit>[0])}
          className="rounded-xl border border-[#E8E8E8] bg-white p-6 space-y-6"
        >
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-[#666] mb-1">{t('nameColumn')}</label>
              <input
                {...register('name')}
                type="text"
                className="w-full rounded-lg border border-[#E8E8E8] px-3 py-2 text-sm focus:border-[#00C853] focus:outline-none focus:ring-2 focus:ring-[#00C853]/10"
              />
              {errors.name && <p className="mt-1 text-xs text-[#EF4444]">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-[#666] mb-1">{t('goalSettingStart')}</label>
              <input
                {...register('goalStart')}
                type="date"
                className="w-full rounded-lg border border-[#E8E8E8] px-3 py-2 text-sm focus:border-[#00C853] focus:outline-none focus:ring-2 focus:ring-[#00C853]/10"
              />
              {errors.goalStart && <p className="mt-1 text-xs text-[#EF4444]">{errors.goalStart.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-[#666] mb-1">{t('goalSettingEnd')}</label>
              <input
                {...register('goalEnd')}
                type="date"
                className="w-full rounded-lg border border-[#E8E8E8] px-3 py-2 text-sm focus:border-[#00C853] focus:outline-none focus:ring-2 focus:ring-[#00C853]/10"
              />
              {errors.goalEnd && <p className="mt-1 text-xs text-[#EF4444]">{errors.goalEnd.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-[#666] mb-1">{t('evalStart')}</label>
              <input
                {...register('evalStart')}
                type="date"
                className="w-full rounded-lg border border-[#E8E8E8] px-3 py-2 text-sm focus:border-[#00C853] focus:outline-none focus:ring-2 focus:ring-[#00C853]/10"
              />
              {errors.evalStart && <p className="mt-1 text-xs text-[#EF4444]">{errors.evalStart.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-[#666] mb-1">{t('evalEnd')}</label>
              <input
                {...register('evalEnd')}
                type="date"
                className="w-full rounded-lg border border-[#E8E8E8] px-3 py-2 text-sm focus:border-[#00C853] focus:outline-none focus:ring-2 focus:ring-[#00C853]/10"
              />
              {errors.evalEnd && <p className="mt-1 text-xs text-[#EF4444]">{errors.evalEnd.message}</p>}
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E8E8E8]">
            <button
              type="button"
              onClick={() => { setEditing(false); setError(null) }}
              className="rounded-lg border border-[#E8E8E8] bg-white px-4 py-2 text-sm font-medium text-[#666] hover:bg-[#FAFAFA] transition-colors"
            >
              {tc('cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-[#00C853] px-4 py-2 text-sm font-medium text-white hover:bg-[#00A844] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="h-4 w-4" />
              {saving ? t('saving') : tc('save')}
            </button>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* 상태 */}
          <div className="rounded-xl border border-[#E8E8E8] bg-white p-4">
            <p className="text-xs font-medium text-[#999] mb-1">{t('statusColumn')}</p>
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[cycle.status] ?? 'bg-[#F5F5F5] text-[#666]'}`}>
              {t(`cycleStatusLabels.${cycle.status}` as Parameters<typeof t>[0])}
            </span>
          </div>

          {/* 유형 */}
          <div className="rounded-xl border border-[#E8E8E8] bg-white p-4">
            <p className="text-xs font-medium text-[#999] mb-1">{t('typeColumn')}</p>
            <p className="text-sm font-semibold text-[#1A1A1A]">{t(`halfLabels.${cycle.half}` as Parameters<typeof t>[0])}</p>
          </div>

          {/* 목표 수 */}
          <div className="rounded-xl border border-[#E8E8E8] bg-white p-4">
            <p className="text-xs font-medium text-[#999] mb-1">{t('goalCount')}</p>
            <p className="text-2xl font-bold text-[#00C853]">{cycle._count?.goals ?? 0}</p>
          </div>

          {/* 평가 수 */}
          <div className="rounded-xl border border-[#E8E8E8] bg-white p-4">
            <p className="text-xs font-medium text-[#999] mb-1">{t('evalCount')}</p>
            <p className="text-2xl font-bold text-[#00C853]">{cycle._count?.evaluations ?? 0}</p>
          </div>

          {/* 목표설정기간 */}
          <div className="rounded-xl border border-[#E8E8E8] bg-white p-4 md:col-span-2">
            <p className="text-xs font-medium text-[#999] mb-1">{t('goalSettingPeriod')}</p>
            <p className="text-sm font-semibold text-[#1A1A1A]">
              {formatDateDisplay(cycle.goalStart)} ~ {formatDateDisplay(cycle.goalEnd)}
            </p>
          </div>

          {/* 평가기간 */}
          <div className="rounded-xl border border-[#E8E8E8] bg-white p-4 md:col-span-2">
            <p className="text-xs font-medium text-[#999] mb-1">{t('evaluationPeriodColumn')}</p>
            <p className="text-sm font-semibold text-[#1A1A1A]">
              {formatDateDisplay(cycle.evalStart)} ~ {formatDateDisplay(cycle.evalEnd)}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
