'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
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

const STATUS_LABELS: Record<string, string> = {
  DRAFT: '초안',
  ACTIVE: '진행중',
  EVAL_OPEN: '평가중',
  CALIBRATION: '캘리브레이션',
  CLOSED: '확정',
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  ACTIVE: 'bg-blue-100 text-blue-700',
  EVAL_OPEN: 'bg-yellow-100 text-yellow-700',
  CALIBRATION: 'bg-purple-100 text-purple-700',
  CLOSED: 'bg-green-100 text-green-700',
}

const HALF_LABELS: Record<string, string> = {
  H1: '상반기',
  H2: '하반기',
  ANNUAL: '연간',
}

const NEXT_ACTION: Record<string, string> = {
  DRAFT: '목표설정 시작',
  ACTIVE: '평가 시작',
  EVAL_OPEN: '캘리브레이션 시작',
  CALIBRATION: '결과 확정',
}

const editSchema = z.object({
  name: z.string().min(1, '이름을 입력하세요').max(100),
  goalStart: z.string().min(1, '시작일을 입력하세요'),
  goalEnd: z.string().min(1, '종료일을 입력하세요'),
  evalStart: z.string().min(1, '시작일을 입력하세요'),
  evalEnd: z.string().min(1, '종료일을 입력하세요'),
})

type EditFormValues = z.input<typeof editSchema>

export default function CycleDetailClient({ user }: { user: SessionUser }) {
  void user
  const router = useRouter()
  const pathname = usePathname()
  const cycleId = pathname.split('/').pop() ?? ''

  const [cycle, setCycle] = useState<PerformanceCycle | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const [confirmAdvance, setConfirmAdvance] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      setError(err instanceof Error ? err.message : '저장에 실패했습니다')
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
      setError(err instanceof Error ? err.message : '상태 변경에 실패했습니다')
    } finally {
      setAdvancing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-400">불러오는 중...</p>
      </div>
    )
  }

  if (!cycle) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-gray-400">사이클을 찾을 수 없습니다</p>
        <button
          onClick={() => router.push('/settings/performance-cycles')}
          className="text-sm text-ctr-secondary hover:underline"
        >
          목록으로 돌아가기
        </button>
      </div>
    )
  }

  const isDraft = cycle.status === 'DRAFT'
  const nextAction = NEXT_ACTION[cycle.status]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/settings/performance-cycles')}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white p-2 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-ctr-primary">{cycle.name}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {cycle.year}년 {HALF_LABELS[cycle.half] ?? cycle.half}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isDraft && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              수정
            </button>
          )}
          {nextAction && (
            <button
              onClick={() => setConfirmAdvance(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-ctr-primary px-4 py-2 text-sm font-medium text-white hover:bg-ctr-secondary transition-colors"
            >
              {nextAction}
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Confirm Advance Dialog */}
      {confirmAdvance && nextAction && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 flex items-center justify-between">
          <p className="text-sm text-yellow-800">
            <strong>&quot;{nextAction}&quot;</strong> 단계로 진행하시겠습니까? 이 작업은 되돌릴 수 없습니다.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setConfirmAdvance(false)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              취소
            </button>
            <button
              onClick={handleAdvance}
              disabled={advancing}
              className="rounded-lg bg-ctr-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {advancing ? '처리 중...' : '확인'}
            </button>
          </div>
        </div>
      )}

      {/* Detail / Edit Form */}
      {editing ? (
        <form
          
          onSubmit={handleSubmit(onSave as Parameters<typeof handleSubmit>[0])}
          className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-6"
        >
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
              <input
                {...register('name')}
                type="text"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ctr-secondary focus:outline-none focus:ring-1 focus:ring-ctr-secondary"
              />
              {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">목표설정 시작일</label>
              <input
                {...register('goalStart')}
                type="date"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ctr-secondary focus:outline-none focus:ring-1 focus:ring-ctr-secondary"
              />
              {errors.goalStart && <p className="mt-1 text-xs text-red-500">{errors.goalStart.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">목표설정 종료일</label>
              <input
                {...register('goalEnd')}
                type="date"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ctr-secondary focus:outline-none focus:ring-1 focus:ring-ctr-secondary"
              />
              {errors.goalEnd && <p className="mt-1 text-xs text-red-500">{errors.goalEnd.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">평가 시작일</label>
              <input
                {...register('evalStart')}
                type="date"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ctr-secondary focus:outline-none focus:ring-1 focus:ring-ctr-secondary"
              />
              {errors.evalStart && <p className="mt-1 text-xs text-red-500">{errors.evalStart.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">평가 종료일</label>
              <input
                {...register('evalEnd')}
                type="date"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ctr-secondary focus:outline-none focus:ring-1 focus:ring-ctr-secondary"
              />
              {errors.evalEnd && <p className="mt-1 text-xs text-red-500">{errors.evalEnd.message}</p>}
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => { setEditing(false); setError(null) }}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-ctr-primary px-4 py-2 text-sm font-medium text-white hover:bg-ctr-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="h-4 w-4" />
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* 상태 */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 mb-1">상태</p>
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[cycle.status] ?? 'bg-gray-100 text-gray-700'}`}>
              {STATUS_LABELS[cycle.status] ?? cycle.status}
            </span>
          </div>

          {/* 유형 */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 mb-1">유형</p>
            <p className="text-sm font-semibold text-gray-900">{HALF_LABELS[cycle.half] ?? cycle.half}</p>
          </div>

          {/* 목표 수 */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 mb-1">목표 수</p>
            <p className="text-2xl font-bold text-ctr-primary">{cycle._count?.goals ?? 0}</p>
          </div>

          {/* 평가 수 */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 mb-1">평가 수</p>
            <p className="text-2xl font-bold text-ctr-primary">{cycle._count?.evaluations ?? 0}</p>
          </div>

          {/* 목표설정기간 */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:col-span-2">
            <p className="text-xs font-medium text-gray-500 mb-1">목표설정기간</p>
            <p className="text-sm font-semibold text-gray-900">
              {formatDateDisplay(cycle.goalStart)} ~ {formatDateDisplay(cycle.goalEnd)}
            </p>
          </div>

          {/* 평가기간 */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:col-span-2">
            <p className="text-xs font-medium text-gray-500 mb-1">평가기간</p>
            <p className="text-sm font-semibold text-gray-900">
              {formatDateDisplay(cycle.evalStart)} ~ {formatDateDisplay(cycle.evalEnd)}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
