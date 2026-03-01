'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 근무시간 직원 목록
// 이름 / 사번 / 부서 / 주간시간 / 상태뱃지
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { Search, AlertTriangle } from 'lucide-react'

type WorkHoursStatus = 'COMPLIANT' | 'WARNING' | 'VIOLATION'

interface WorkHoursEmployee {
  id: string
  name: string
  employeeNo: string
  department: string
  weeklyHours: number
  status: WorkHoursStatus
}

interface Props {
  weekOffset: number
}

const STATUS_MAP: Record<WorkHoursStatus, { label: string; className: string }> = {
  COMPLIANT: {
    label: '준수',
    className:
      'bg-emerald-50 text-emerald-700 border border-emerald-200',
  },
  WARNING: {
    label: '주의',
    className:
      'bg-amber-50 text-amber-700 border border-amber-200',
  },
  VIOLATION: {
    label: '위반',
    className:
      'bg-red-50 text-red-700 border border-red-200',
  },
}

const MOCK_EMPLOYEES: WorkHoursEmployee[] = [
  { id: '1', name: '김철수', employeeNo: 'KR-001', department: '생산팀', weeklyHours: 38, status: 'COMPLIANT' },
  { id: '2', name: '이영희', employeeNo: 'KR-002', department: '품질팀', weeklyHours: 45, status: 'WARNING' },
  { id: '3', name: '박민준', employeeNo: 'KR-003', department: '물류팀', weeklyHours: 55, status: 'VIOLATION' },
  { id: '4', name: '최수진', employeeNo: 'KR-004', department: '인사팀', weeklyHours: 40, status: 'COMPLIANT' },
  { id: '5', name: '정지훈', employeeNo: 'KR-005', department: '생산팀', weeklyHours: 48, status: 'WARNING' },
  { id: '6', name: '한소영', employeeNo: 'KR-006', department: '기술팀', weeklyHours: 54, status: 'VIOLATION' },
  { id: '7', name: '윤재원', employeeNo: 'KR-007', department: '영업팀', weeklyHours: 35, status: 'COMPLIANT' },
  { id: '8', name: '강미래', employeeNo: 'KR-008', department: '재무팀', weeklyHours: 42, status: 'WARNING' },
]

export default function WorkHoursEmployeeList({ weekOffset }: Props) {
  const [employees, setEmployees] = useState<WorkHoursEmployee[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<WorkHoursStatus | 'ALL'>('ALL')

  useEffect(() => {
    const fetchEmployees = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ weekOffset: String(weekOffset) })
        if (statusFilter !== 'ALL') params.set('status', statusFilter)
        const res = await fetch(`/api/v1/compliance/kr/work-hours/employees?${params}`)
        if (res.ok) {
          const data = await res.json()
          setEmployees(data.employees ?? data)
        } else {
          setEmployees(MOCK_EMPLOYEES)
        }
      } catch {
        setEmployees(MOCK_EMPLOYEES)
      } finally {
        setLoading(false)
      }
    }
    fetchEmployees()
  }, [weekOffset, statusFilter])

  const filtered = employees.filter((e) => {
    const matchSearch =
      search === '' ||
      e.name.includes(search) ||
      e.employeeNo.toLowerCase().includes(search.toLowerCase()) ||
      e.department.includes(search)
    return matchSearch
  })

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      {/* List Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-slate-900">직원별 근무현황</h2>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
            {filtered.length}명
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="이름 / 사번 / 부서 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as WorkHoursStatus | 'ALL')}
            className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">전체 상태</option>
            <option value="COMPLIANT">준수</option>
            <option value="WARNING">주의</option>
            <option value="VIOLATION">위반</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50">
              <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium uppercase tracking-wider">
                이름
              </th>
              <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium uppercase tracking-wider">
                사번
              </th>
              <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium uppercase tracking-wider">
                부서
              </th>
              <th className="px-4 py-3 text-right text-xs text-slate-500 font-medium uppercase tracking-wider">
                주간 근무시간
              </th>
              <th className="px-4 py-3 text-center text-xs text-slate-500 font-medium uppercase tracking-wider">
                상태
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-100">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-slate-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <AlertTriangle className="w-8 h-8" />
                    <p className="text-sm">검색 결과가 없습니다.</p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((employee) => {
                const statusInfo = STATUS_MAP[employee.status]
                const isViolation = employee.status === 'VIOLATION'
                return (
                  <tr
                    key={employee.id}
                    className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900">{employee.name}</span>
                        {isViolation && (
                          <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{employee.employeeNo}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{employee.department}</td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`text-sm font-semibold ${
                          isViolation
                            ? 'text-red-700'
                            : employee.status === 'WARNING'
                            ? 'text-amber-700'
                            : 'text-slate-900'
                        }`}
                      >
                        {employee.weeklyHours}시간
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.className}`}
                      >
                        {statusInfo.label}
                      </span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
