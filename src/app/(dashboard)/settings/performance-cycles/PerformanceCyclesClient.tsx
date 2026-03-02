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
  DRAFT: 'bg-[#F5F5F5] text-[#666]',
  ACTIVE: 'bg-[#E3F2FD] text-[#1565C0]',
  EVAL_OPEN: 'bg-[#FFF8E1] text-[#F57F17]',
  CALIBRATION: 'bg-[#F3E5F5] text-[#7B1FA2]',
  CLOSED: 'bg-[#E8F5E9] text-[#2E7D32]',
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
        <h1 className="text-2xl font-bold text-[#00C853]">{t('cycleManagement')}</h1>
        <button
          onClick={() => router.push('/settings/performance-cycles/new')}
          className="inline-flex items-center gap-2 rounded-lg bg-[#00C853] px-4 py-2 text-sm font-medium text-white hover:bg-[#00A844] transition-colors"
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
          className="rounded-lg border border-[#E8E8E8] bg-white px-3 py-2 text-sm focus:border-[#00C853] focus:outline-none focus:ring-2 focus:ring-[#00C853]/10"
        >
          <option value="">{t('allYears')}</option>
          {[2024, 2025, 2026, 2027].map((y) => (
            <option key={y} value={y}>{t('yearUnit', { year: y })}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1) }}
          className="rounded-lg border border-[#E8E8E8] bg-white px-3 py-2 text-sm focus:border-[#00C853] focus:outline-none focus:ring-2 focus:ring-[#00C853]/10"
        >
          <option value="">{t('allStatuses')}</option>
          {['DRAFT', 'ACTIVE', 'EVAL_OPEN', 'CALIBRATION', 'CLOSED'].map((key) => (
            <option key={key} value={key}>{t(`cycleStatusLabels.${key}` as Parameters<typeof t>[0])}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[#E8E8E8] bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E8E8E8] bg-[#FAFAFA]">
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">{t('nameColumn')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">{t('yearColumn')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">{t('typeColumn')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">{t('statusColumn')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">{t('goalSettingPeriod')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#999]">{t('evaluationPeriodColumn')}</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-[#999]">{t('goalCount')}</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-[#999]">{t('evalCount')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-[#999]">
                  {t('fetchingData')}
                </td>
              </tr>
            ) : cycles.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-[#999]">
                  {t('noCyclesRegistered')}
                </td>
              </tr>
            ) : (
              cycles.map((cycle) => (
                <tr
                  key={cycle.id}
                  onClick={() => router.push(`/settings/performance-cycles/${cycle.id}`)}
                  className="border-b border-[#F5F5F5] hover:bg-[#FAFAFA] cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-[#1A1A1A]">{cycle.name}</td>
                  <td className="px-4 py-3 text-[#666]">{t('yearUnit', { year: cycle.year })}</td>
                  <td className="px-4 py-3 text-[#666]">{t(`halfLabels.${cycle.half}` as Parameters<typeof t>[0])}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[cycle.status] ?? 'bg-[#F5F5F5] text-[#666]'}`}>
                      {t(`cycleStatusLabels.${cycle.status}` as Parameters<typeof t>[0])}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#666]">
                    {formatDate(cycle.goalStart)} ~ {formatDate(cycle.goalEnd)}
                  </td>
                  <td className="px-4 py-3 text-[#666]">
                    {formatDate(cycle.evalStart)} ~ {formatDate(cycle.evalEnd)}
                  </td>
                  <td className="px-4 py-3 text-center text-[#666]">
                    {cycle._count?.goals ?? 0}
                  </td>
                  <td className="px-4 py-3 text-center text-[#666]">
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
            className="inline-flex items-center gap-1 rounded-lg border border-[#E8E8E8] bg-white px-3 py-1.5 text-sm text-[#666] hover:bg-[#FAFAFA] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" />
            {t('previousPage')}
          </button>
          <span className="text-sm text-[#666]">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="inline-flex items-center gap-1 rounded-lg border border-[#E8E8E8] bg-white px-3 py-1.5 text-sm text-[#666] hover:bg-[#FAFAFA] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('nextPage')}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
