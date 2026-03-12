'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Military Registration Tab
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { Plus, Download, Search, RefreshCw } from 'lucide-react'
import { apiClient } from '@/lib/api'
import MilitaryRegistrationForm from './MilitaryRegistrationForm'
import type { PaginationInfo } from '@/types'
import { BUTTON_VARIANTS } from '@/lib/styles'

interface MilitaryRegistration {
  id: string
  employeeId: string
  category: string
  rank: string | null
  specialtyCode: string | null
  fitnessCategory: string
  militaryOffice: string | null
  registrationDate: string | null
  deregistrationDate: string | null
  notes: string | null
  createdAt: string
  employee: {
    id: string
    name: string
    employeeNo: string
    department: { id: string; name: string } | null
  }
}

const CATEGORY_LABELS: Record<string, string> = {
  OFFICER: '장교',
  SOLDIER: '병사',
  RESERVIST: '예비역',
  EXEMPT: '면제',
}

const FITNESS_LABELS: Record<string, string> = {
  FIT_A: '적합 A',
  FIT_B: '적합 B',
  FIT_C: '적합 C',
  FIT_D: '적합 D',
  UNFIT: '부적합',
}

const FITNESS_COLORS: Record<string, string> = {
  FIT_A: 'bg-[#D1FAE5] text-[#047857] border-[#A7F3D0]',
  FIT_B: 'bg-[#E8F5E9] text-[#00A844] border-[#E8F5E9]',
  FIT_C: 'bg-[#FEF3C7] text-[#B45309] border-[#FCD34D]',
  FIT_D: 'bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]',
  UNFIT: 'bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]',
}

export default function MilitaryRegistrationTab() {
  const [registrations, setRegistrations] = useState<MilitaryRegistration[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [selectedRegistration, setSelectedRegistration] = useState<MilitaryRegistration | null>(null)
  const [exporting, setExporting] = useState(false)

  const fetchRegistrations = useCallback(
    async (page = 1) => {
      setLoading(true)
      try {
        const params: Record<string, string | number> = { page, limit: 20 }
        if (search) params.search = search
        if (categoryFilter) params.category = categoryFilter

        const res = await apiClient.getList<MilitaryRegistration>(
          '/api/v1/compliance/ru/military',
          params,
        )
        setRegistrations(res.data ?? [])
        setPagination(res.pagination ?? null)
      } catch {
        // error handled silently
      } finally {
        setLoading(false)
      }
    },
    [search, categoryFilter],
  )

  useEffect(() => {
    fetchRegistrations()
  }, [fetchRegistrations])

  const handleExportT2 = async () => {
    setExporting(true)
    try {
      const res = await apiClient.get<{ records: MilitaryRegistration[]; exportedAt: string }>(
        '/api/v1/compliance/ru/military/export/t2',
      )
      // Trigger JSON download (Excel generation would be client-side with a library)
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `T2_military_export_${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // error handled silently
    } finally {
      setExporting(false)
    }
  }

  const handleFormSuccess = () => {
    setShowForm(false)
    setSelectedRegistration(null)
    fetchRegistrations()
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className={}>
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex gap-2 flex-1">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999]" />
              <input
                type="text"
                placeholder="이름 또는 사번 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10 placeholder:text-[#999]"
              />
            </div>
            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10"
            >
              <option value="">전체 구분</option>
              {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
            {/* Refresh */}
            <button
              onClick={() => fetchRegistrations()}
              className="p-2 border border-[#D4D4D4] rounded-lg hover:bg-[#FAFAFA] text-[#555]"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-2">
            {/* Export T-2 */}
            <button
              onClick={handleExportT2}
              disabled={exporting}
              className="flex items-center gap-2 bg-white border border-[#D4D4D4] hover:bg-[#FAFAFA] text-[#333] px-4 py-2 rounded-lg font-medium text-sm disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              T-2 내보내기
            </button>
            {/* Add New */}
            <button
              onClick={() => { setSelectedRegistration(null); setShowForm(true) }}
              className={`flex items-center gap-2 ${BUTTON_VARIANTS.primary} px-4 py-2 rounded-lg font-medium text-sm`}
            >
              <Plus className="w-4 h-4" />
              군복무 등록
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#E8E8E8] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#999] text-sm">
            로딩 중...
          </div>
        ) : registrations.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-[#999] text-sm">
            군복무 등록 데이터가 없습니다.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-[#FAFAFA] border-b border-[#E8E8E8]">
                <th className="px-4 py-3 text-left text-xs text-[#666] font-medium uppercase tracking-wider">
                  직원
                </th>
                <th className="px-4 py-3 text-left text-xs text-[#666] font-medium uppercase tracking-wider">
                  부서
                </th>
                <th className="px-4 py-3 text-left text-xs text-[#666] font-medium uppercase tracking-wider">
                  복무 구분
                </th>
                <th className="px-4 py-3 text-left text-xs text-[#666] font-medium uppercase tracking-wider">
                  계급
                </th>
                <th className="px-4 py-3 text-left text-xs text-[#666] font-medium uppercase tracking-wider">
                  적합도
                </th>
                <th className="px-4 py-3 text-left text-xs text-[#666] font-medium uppercase tracking-wider">
                  등록일
                </th>
                <th className="px-4 py-3 text-right text-xs text-[#666] font-medium uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
            <tbody>
              {registrations.map((reg) => (
                <tr key={reg.id} className="border-b border-[#F5F5F5] hover:bg-[#FAFAFA]">
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-[#1A1A1A]">{reg.employee.name}</p>
                      <p className="text-xs text-[#666]">{reg.employee.employeeNo}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#555]">
                    {reg.employee.department?.name ?? '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F5F5F5] text-[#333]">
                      {CATEGORY_LABELS[reg.category] ?? reg.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#555]">{reg.rank ?? '-'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        FITNESS_COLORS[reg.fitnessCategory] ?? 'bg-[#FAFAFA] text-[#555] border-[#E8E8E8]'
                      }`}
                    >
                      {FITNESS_LABELS[reg.fitnessCategory] ?? reg.fitnessCategory}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#555]">
                    {reg.registrationDate
                      ? new Date(reg.registrationDate).toLocaleDateString('ko-KR')
                      : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => {
                        setSelectedRegistration(reg)
                        setShowForm(true)
                      }}
                      className="text-sm text-[#00C853] hover:text-[#00A844] font-medium"
                    >
                      수정
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-[#E8E8E8] flex items-center justify-between">
            <p className="text-xs text-[#666]">
              전체 {pagination.total}건
            </p>
            <div className="flex gap-1">
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => fetchRegistrations(page)}
                  className={`w-8 h-8 text-xs rounded-lg ${
                    page === pagination.page
                      ? 'bg-[#00C853] text-white'
                      : 'text-[#555] hover:bg-[#F5F5F5]'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <MilitaryRegistrationForm
          registration={selectedRegistration}
          onClose={() => { setShowForm(false); setSelectedRegistration(null) }}
          onSuccess={handleFormSuccess}
        />
      )}
    </div>
  )
}
