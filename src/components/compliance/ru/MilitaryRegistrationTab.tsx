'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Military Registration Tab
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { Plus, Download, Search, RefreshCw } from 'lucide-react'
import { apiClient } from '@/lib/api'
import MilitaryRegistrationForm from './MilitaryRegistrationForm'
import type { PaginationInfo } from '@/types'
import { BUTTON_VARIANTS, TABLE_STYLES } from '@/lib/styles'

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
  FIT_A: 'bg-emerald-500/15 text-emerald-700 border-emerald-200',
  FIT_B: 'bg-primary/10 text-primary/90 border-primary/20',
  FIT_C: 'bg-amber-500/15 text-amber-700 border-amber-300',
  FIT_D: 'bg-orange-500/10 text-orange-700 border-orange-200',
  UNFIT: 'bg-destructive/10 text-destructive border-destructive/20',
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
      <div className="bg-card rounded-xl shadow-sm border border-border p-6">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex gap-2 flex-1">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder={'이름 또는 사번 검색...'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10 placeholder:text-muted-foreground"
              />
            </div>
            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary/10"
            >
              <option value="">전체 구분</option>
              {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
            {/* Refresh */}
            <button
              onClick={() => fetchRegistrations()}
              className="p-2 border border-border rounded-lg hover:bg-background text-muted-foreground"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-2">
            {/* Export T-2 */}
            <button
              onClick={handleExportT2}
              disabled={exporting}
              className="flex items-center gap-2 bg-card border border-border hover:bg-background text-foreground px-4 py-2 rounded-lg font-medium text-sm disabled:opacity-50"
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
      <div className={TABLE_STYLES.wrapper}>
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
            로딩 중...
          </div>
        ) : registrations.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
            군복무 등록 데이터가 없습니다.
          </div>
        ) : (
          <table className={TABLE_STYLES.table}>
            <thead>
              <tr className={TABLE_STYLES.header}>
                <th className={TABLE_STYLES.headerCell}>
                  직원
                </th>
                <th className={TABLE_STYLES.headerCell}>
                  부서
                </th>
                <th className={TABLE_STYLES.headerCell}>
                  복무 구분
                </th>
                <th className={TABLE_STYLES.headerCell}>
                  계급
                </th>
                <th className={TABLE_STYLES.headerCell}>
                  적합도
                </th>
                <th className={TABLE_STYLES.headerCell}>
                  등록일
                </th>
                <th className={TABLE_STYLES.headerCellRight}>
                  작업
                </th>
              </tr>
            </thead>
            <tbody>
              {registrations.map((reg) => (
                <tr key={reg.id} className={TABLE_STYLES.row}>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{reg.employee.name}</p>
                      <p className="text-xs text-muted-foreground">{reg.employee.employeeNo}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {reg.employee.department?.name ?? '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground">
                      {CATEGORY_LABELS[reg.category] ?? reg.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{reg.rank ?? '-'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        FITNESS_COLORS[reg.fitnessCategory] ?? 'bg-background text-muted-foreground border-border'
                      }`}
                    >
                      {FITNESS_LABELS[reg.fitnessCategory] ?? reg.fitnessCategory}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
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
                      className="text-sm text-primary hover:text-primary/90 font-medium"
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
          <div className="px-4 py-3 border-t border-border flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              전체 {pagination.total}건
            </p>
            <div className="flex gap-1">
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => fetchRegistrations(page)}
                  className={`w-8 h-8 text-xs rounded-lg ${
                    page === pagination.page
                      ? 'bg-primary text-white'
                      : 'text-muted-foreground hover:bg-muted'
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
