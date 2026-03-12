'use client'

import { useState, useEffect, useCallback } from 'react'
import { Download, Users } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { BUTTON_VARIANTS } from '@/lib/styles'

interface RegistryRow {
  employeeNo: string
  name: string
  nameEn: string | null
  gender: string | null
  birthDate: string | null
  hireDate: string
  department: string
  jobGrade: string
  employmentType: string
  status: string
  email: string
}

interface RegistryData {
  meta: {
    totalCount: number
    generatedAt: string
    filename: string
  }
  columns: { key: string; label: string }[]
  rows: RegistryRow[]
}

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  FULL_TIME: '정규직',
  PART_TIME: '계약직',
  CONTRACT: '프리랜서',
  INTERN: '인턴',
  DISPATCH: '파견직',
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: '재직',
  ON_LEAVE: '휴직',
  RESIGNED: '퇴직',
  TERMINATED: '해고',
}

const GENDER_LABELS: Record<string, string> = {
  M: '남',
  F: '여',
  MALE: '남',
  FEMALE: '여',
}

export default function EmployeeRegistryTab() {
  const [registryData, setRegistryData] = useState<RegistryData | null>(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')

  const fetchRegistry = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<RegistryData>(
        '/api/v1/compliance/cn/employee-registry/export',
      )
      setRegistryData(res.data ?? null)
    } catch {
      setRegistryData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRegistry()
  }, [fetchRegistry])

  const handleExport = async () => {
    if (!registryData) return
    setExporting(true)
    try {
      const headers = registryData.columns.map((c) => c.label)
      const rows = registryData.rows.map((r) => [
        r.employeeNo,
        r.name,
        r.nameEn ?? '',
        r.gender ? (GENDER_LABELS[r.gender] ?? r.gender) : '',
        r.birthDate ?? '',
        r.hireDate,
        r.department,
        r.jobGrade,
        EMPLOYMENT_TYPE_LABELS[r.employmentType] ?? r.employmentType,
        STATUS_LABELS[r.status] ?? r.status,
        r.email,
      ])

      const csvContent = [
        headers.join(','),
        ...rows.map((r) => r.map((v) => `"${v}"`).join(',')),
      ].join('\n')

      const blob = new Blob(['\uFEFF' + csvContent], {
        type: 'text/csv;charset=utf-8;',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = registryData.meta.filename.replace('.xlsx', '.csv')
      link.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  // Get unique departments for filter
  const departments = registryData
    ? [...new Set(registryData.rows.map((r) => r.department))].sort()
    : []

  // Filter rows
  const filteredRows = registryData?.rows.filter((r) => {
    const matchesSearch =
      !searchTerm ||
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.employeeNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.nameEn?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
    const matchesDept = !departmentFilter || r.department === departmentFilter
    return matchesSearch && matchesDept
  }) ?? []

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-[#1A1A1A]">
            직원 명부 <span className="text-[#999] font-normal text-sm">(花名册)</span>
          </h2>
          <p className="text-xs text-[#666] mt-0.5">
            재직 중인 직원 명부를 관리합니다
          </p>
        </div>
        <div className="flex items-center gap-2">
          {registryData && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#E8F5E9] text-[#00A844] border border-[#E8F5E9]">
              <Users className="w-3 h-3" />
              총 {registryData.meta.totalCount.toLocaleString()}명
            </span>
          )}
          <button
            onClick={handleExport}
            disabled={exporting || !registryData}
            className={`flex items-center gap-2 ${BUTTON_VARIANTS.primary} px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Download className="w-4 h-4" />
            {exporting ? '내보내는 중...' : '명부 내보내기'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={tCommon('placeholderSearchNameId')}
          className="px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10 focus:border-[#00C853] placeholder:text-[#999] w-56"
        />
        <select
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
          className="px-3 py-2 border border-[#D4D4D4] rounded-lg text-sm focus:ring-2 focus:ring-[#00C853]/10"
        >
          <option value="">전체 부서</option>
          {departments.map((dept) => (
            <option key={dept} value={dept}>
              {dept}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-12 text-center text-sm text-[#666]">Loading...</div>
      ) : filteredRows.length === 0 ? (
        <div className="py-12 text-center text-sm text-[#666]">
          직원 데이터가 없습니다.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#FAFAFA] text-xs text-[#666] font-medium uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">사번</th>
                  <th className="px-4 py-3 text-left">이름</th>
                  <th className="px-4 py-3 text-left">성별</th>
                  <th className="px-4 py-3 text-left">생년월일</th>
                  <th className="px-4 py-3 text-left">부서</th>
                  <th className="px-4 py-3 text-left">직급</th>
                  <th className="px-4 py-3 text-left">고용 형태</th>
                  <th className="px-4 py-3 text-left">입사일</th>
                  <th className="px-4 py-3 text-center">재직 상태</th>
                  <th className="px-4 py-3 text-left">이메일</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr
                    key={row.employeeNo}
                    className="border-b border-[#F5F5F5] hover:bg-[#FAFAFA]"
                  >
                    <td className="px-4 py-3 font-mono text-[#555] text-xs">
                      {row.employeeNo}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#1A1A1A]">{row.name}</div>
                      {row.nameEn && (
                        <div className="text-xs text-[#999]">{row.nameEn}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#333]">
                      {row.gender ? (GENDER_LABELS[row.gender] ?? row.gender) : '-'}
                    </td>
                    <td className="px-4 py-3 text-[#333]">
                      {row.birthDate ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-[#333]">{row.department}</td>
                    <td className="px-4 py-3 text-[#333]">{row.jobGrade}</td>
                    <td className="px-4 py-3 text-[#333]">
                      {EMPLOYMENT_TYPE_LABELS[row.employmentType] ?? row.employmentType}
                    </td>
                    <td className="px-4 py-3 text-[#333]">{row.hireDate}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          row.status === 'ACTIVE'
                            ? 'bg-[#D1FAE5] text-[#047857] border border-[#A7F3D0]'
                            : row.status === 'ON_LEAVE'
                              ? 'bg-[#FEF3C7] text-[#B45309] border border-[#FCD34D]'
                              : 'bg-[#FAFAFA] text-[#555] border border-[#E8E8E8]'
                        }`}
                      >
                        {STATUS_LABELS[row.status] ?? row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#555] text-xs">{row.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-[#999]">
              {filteredRows.length.toLocaleString()}명 표시
              {registryData && filteredRows.length < registryData.rows.length
                ? ` (전체 ${registryData.rows.length.toLocaleString()}명 중)`
                : ''}
            </p>
            {registryData && (
              <p className="text-xs text-[#999]">
                생성일시: {new Date(registryData.meta.generatedAt).toLocaleString('ko-KR')}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
