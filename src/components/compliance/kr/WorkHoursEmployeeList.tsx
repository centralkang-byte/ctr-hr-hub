'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — 근무시간 직원 목록
// 이름 / 사번 / 부서 / 주간시간 / 상태뱃지
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Search, AlertTriangle } from 'lucide-react'
import { TABLE_STYLES } from '@/lib/styles'
import { StatusBadge } from '@/components/ui/StatusBadge'
import type { StatusCategory } from '@/lib/styles/status'

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

const STATUS_MAP: Record<WorkHoursStatus, { label: string; variant: StatusCategory }> = {
  COMPLIANT: { label: '준수', variant: 'success' },
  WARNING: { label: '주의', variant: 'warning' },
  VIOLATION: { label: '위반', variant: 'error' },
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
  const tCommon = useTranslations('common')
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
          const json = await res.json()
          const list = json.data ?? json.employees ?? json
          setEmployees(Array.isArray(list) ? list : [])
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
    <div className="bg-card rounded-xl border border-border">
      {/* List Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-6 border-b border-border">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-foreground tracking-[-0.02em]">직원별 근무현황</h2>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground">
            {filtered.length}명
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder={tCommon('placeholderSearchNameIdDept')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 w-48"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as WorkHoursStatus | 'ALL')}
            className="text-sm border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
          >
            <option value="ALL">전체 상태</option>
            <option value="COMPLIANT">준수</option>
            <option value="WARNING">주의</option>
            <option value="VIOLATION">위반</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className={TABLE_STYLES.wrapper}>
        <table className={TABLE_STYLES.table}>
          <thead>
            <tr className={TABLE_STYLES.header}>
              <th className={TABLE_STYLES.headerCell}>
                이름
              </th>
              <th className={TABLE_STYLES.headerCell}>
                사번
              </th>
              <th className={TABLE_STYLES.headerCell}>
                부서
              </th>
              <th className={TABLE_STYLES.headerCellRight}>
                주간 근무시간
              </th>
              <th className={TABLE_STYLES.headerCell}>
                상태
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-muted rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
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
                    className={TABLE_STYLES.row}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{employee.name}</span>
                        {isViolation && (
                          <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{employee.employeeNo}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{employee.department}</td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`text-sm font-semibold ${
                          isViolation
                            ? 'text-red-500'
                            : employee.status === 'WARNING'
                            ? 'text-orange-500'
                            : 'text-foreground'
                        }`}
                      >
                        {employee.weeklyHours}시간
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge variant={statusInfo.variant}>
                        {statusInfo.label}
                      </StatusBadge>
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
