'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { apiClient } from '@/lib/api'
import { format } from 'date-fns'
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react'
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
  DRAFT: 'bg-gray-100 text-gray-700',
  ACTIVE: 'bg-blue-100 text-blue-700',
  EVAL_OPEN: 'bg-yellow-100 text-yellow-700',
  CALIBRATION: 'bg-purple-100 text-purple-700',
  CLOSED: 'bg-green-100 text-green-700',
}

export default function PerformanceCyclesClient({ user }: { user: SessionUser }) {
  void user
  const router = useRouter()
  const t = useTranslations('performance')
  const [cycles, setCycles] = useState<PerformanceCycle[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [year, setYear] = useState<string>('')
  const [status, setStatus] = useState<string>('')

  const fetchCycles = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = { page: String(page), limit: '20' }
      if (year) params.year = year
      if (status) params.status = status
      const res = await apiClient.getList<PerformanceCycle>('/api/v1/performance/cycles', params)
      setCycles(res.data)
      setTotalPages(res.pagination.totalPages)
    } catch {
      setCycles([])
    } finally {
      setLoading(false)
    }
  }, [page, year, status])

  useEffect(() => {
    fetchCycles()
  }, [fetchCycles])

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'yyyy-MM-dd')
    } catch {
      return '-'
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ctr-primary">{t('cycleManagement')}</h1>
        <button
          onClick={() => router.push('/settings/performance-cycles/new')}
          className="inline-flex items-center gap-2 rounded-lg bg-ctr-primary px-4 py-2 text-sm font-medium text-white hover:bg-ctr-secondary transition-colors"
        >
          <Plus className="h-4 w-4" />
          {t('newCycleButton')}
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <select
          value={year}
          onChange={(e) => { setYear(e.target.value); setPage(1) }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-ctr-secondary focus:outline-none focus:ring-1 focus:ring-ctr-secondary"
        >
          <option value="">{t('allYears')}</option>
          {[2024, 2025, 2026, 2027].map((y) => (
            <option key={y} value={y}>{t('yearUnit', { year: y })}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1) }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-ctr-secondary focus:outline-none focus:ring-1 focus:ring-ctr-secondary"
        >
          <option value="">{t('allStatuses')}</option>
          {['DRAFT', 'ACTIVE', 'EVAL_OPEN', 'CALIBRATION', 'CLOSED'].map((key) => (
            <option key={key} value={key}>{t(`cycleStatusLabels.${key}` as Parameters<typeof t>[0])}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left font-medium text-gray-600">{t('nameColumn')}</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">{t('yearColumn')}</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">{t('typeColumn')}</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">{t('statusColumn')}</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">{t('goalSettingPeriod')}</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">{t('evaluationPeriodColumn')}</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">{t('goalCount')}</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">{t('evalCount')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                  {t('fetchingData')}
                </td>
              </tr>
            ) : cycles.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                  {t('noCyclesRegistered')}
                </td>
              </tr>
            ) : (
              cycles.map((cycle) => (
                <tr
                  key={cycle.id}
                  onClick={() => router.push(`/settings/performance-cycles/${cycle.id}`)}
                  className="border-b border-gray-100 hover:bg-ctr-light cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{cycle.name}</td>
                  <td className="px-4 py-3 text-gray-600">{t('yearUnit', { year: cycle.year })}</td>
                  <td className="px-4 py-3 text-gray-600">{t(`halfLabels.${cycle.half}` as Parameters<typeof t>[0])}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[cycle.status] ?? 'bg-gray-100 text-gray-700'}`}>
                      {t(`cycleStatusLabels.${cycle.status}` as Parameters<typeof t>[0])}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatDate(cycle.goalStart)} ~ {formatDate(cycle.goalEnd)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatDate(cycle.evalStart)} ~ {formatDate(cycle.evalEnd)}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">
                    {cycle._count?.goals ?? 0}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">
                    {cycle._count?.evaluations ?? 0}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" />
            {t('previousPage')}
          </button>
          <span className="text-sm text-gray-600">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('nextPage')}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
