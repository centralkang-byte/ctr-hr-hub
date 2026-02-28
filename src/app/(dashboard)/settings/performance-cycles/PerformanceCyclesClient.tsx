'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
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

export default function PerformanceCyclesClient({ user }: { user: SessionUser }) {
  void user
  const router = useRouter()
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
        <h1 className="text-2xl font-bold text-ctr-primary">평가 사이클 관리</h1>
        <button
          onClick={() => router.push('/settings/performance-cycles/new')}
          className="inline-flex items-center gap-2 rounded-lg bg-ctr-primary px-4 py-2 text-sm font-medium text-white hover:bg-ctr-secondary transition-colors"
        >
          <Plus className="h-4 w-4" />
          새 사이클
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <select
          value={year}
          onChange={(e) => { setYear(e.target.value); setPage(1) }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-ctr-secondary focus:outline-none focus:ring-1 focus:ring-ctr-secondary"
        >
          <option value="">전체 연도</option>
          {[2024, 2025, 2026, 2027].map((y) => (
            <option key={y} value={y}>{y}년</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1) }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-ctr-secondary focus:outline-none focus:ring-1 focus:ring-ctr-secondary"
        >
          <option value="">전체 상태</option>
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left font-medium text-gray-600">이름</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">연도</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">유형</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">상태</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">목표설정기간</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">평가기간</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">목표수</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">평가수</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                  불러오는 중...
                </td>
              </tr>
            ) : cycles.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                  등록된 사이클이 없습니다
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
                  <td className="px-4 py-3 text-gray-600">{cycle.year}년</td>
                  <td className="px-4 py-3 text-gray-600">{HALF_LABELS[cycle.half] ?? cycle.half}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[cycle.status] ?? 'bg-gray-100 text-gray-700'}`}>
                      {STATUS_LABELS[cycle.status] ?? cycle.status}
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
            이전
          </button>
          <span className="text-sm text-gray-600">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            다음
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
