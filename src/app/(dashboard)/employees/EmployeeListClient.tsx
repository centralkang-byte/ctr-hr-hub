'use client'


// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Employee List Client
// 직원 목록: DataTable + 필터 + 검색 + 페이지네이션
// P01 Master-Detail: URL deep linking (?selectedId=)
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Plus, Upload, Calendar, ExternalLink, Mail, FileText, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { deriveProbationBadge, deriveContractBadge } from '@/lib/employees/lifecycle'
import { PageHeader } from '@/components/shared/PageHeader'
import { WdStatusChips } from '@/components/shared/WdStatusChips'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { DetailPanel } from '@/components/shared/DetailPanel'
import { EmployeeInspector } from '@/components/shared/EmployeeInspector'
import { BulkActionBar } from '@/components/shared/BulkActionBar'
import { wtAvatarColor } from '@/lib/styles/wt-avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { EmployeeFilterPanel, type FilterValues } from '@/components/employees/EmployeeFilterPanel'
import { apiClient } from '@/lib/api'
import { ROLE } from '@/lib/constants'
import type { SessionUser, PaginationInfo, SortDirection } from '@/types'

// ─── Types ──────────────────────────────────────────────────

type EmployeeRow = {
  id: string
  employeeNo: string
  name: string
  nameEn: string | null
  hireDate: string | null
  employmentType: string
  status: string
  department: { id: string; name: string } | null
  jobGrade: { id: string; name: string } | null
  title: { id: string; name: string } | null
  jobCategory: { id: string; name: string } | null
  // 수습/계약 라이프사이클 (HR_UP 응답에만 포함)
  probationStatus?: string | null
  probationEndDate?: string | null
  contractEndDate?: string | null
}

type EmployeeDetail = EmployeeRow & {
  email: string | null
  phone: string | null
  photoUrl: string | null
  title: { id: string; name: string } | null
  position: { id: string; titleKo: string } | null
  workLocation: { id: string; name: string } | null
  company: { id: string; name: string; code: string } | null
  manager?: { id: string; name: string } | null
}

interface EmployeeListClientProps {
  user: SessionUser
}

// ─── Display constants ───────────────────────────────────────


const LIMIT_OPTIONS = [10, 20, 50, 100]
const SENTINEL_ALL = '__ALL__'

// ─── Employee Quick Panel ────────────────────────────────────

function EmployeeQuickPanel({
  employeeId,
  onViewFull,
}: {
  employeeId: string
  onViewFull: () => void
}) {
  const t = useTranslations('employee')
  const [employee, setEmployee] = useState<EmployeeDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setEmployee(null)
    apiClient
      .get<EmployeeDetail>(`/api/v1/employees/${employeeId}`)
      .then((res) => setEmployee(res.data))
      .catch(() => setEmployee(null))
      .finally(() => setLoading(false))
  }, [employeeId])

  if (loading) {
    return (
      <div className="p-5 space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-5 rounded bg-muted animate-pulse" />
        ))}
      </div>
    )
  }

  if (!employee) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
        {t('listLoadError')}
      </div>
    )
  }

  const hireDateStr = employee.hireDate
    ? new Date(employee.hireDate).toLocaleDateString('ko-KR')
    : null

  const tenureText = (() => {
    if (!employee.hireDate) return null
    const hire = new Date(employee.hireDate)
    const now = new Date()
    const m =
      (now.getFullYear() - hire.getFullYear()) * 12 +
      (now.getMonth() - hire.getMonth())
    const years = Math.floor(m / 12)
    const months = m % 12
    return years > 0
      ? t('tenureYearsMonths', { years, months })
      : months > 0
      ? t('tenureMonthsOnly', { months })
      : t('tenureZeroMonths')
  })()

  const statusText =
    (
      {
        ACTIVE: t('statusActive'),
        ON_LEAVE: t('statusOnLeave'),
        RESIGNED: t('statusResigned'),
        TERMINATED: t('statusTerminated'),
      } as Record<string, string>
    )[employee.status] ?? employee.status

  const kv = ([
    employee.employeeNo
      ? { k: t('employeeNo'), v: <span className="font-mono">{employee.employeeNo}</span> }
      : null,
    employee.company?.name
      ? { k: t('listQuickPanelCompany'), v: employee.company.name }
      : null,
    employee.department?.name
      ? { k: t('listQuickPanelDepartment'), v: employee.department.name }
      : null,
    employee.workLocation?.name
      ? { k: t('listQuickPanelWorkLocation'), v: employee.workLocation.name }
      : null,
    employee.employmentType
      ? { k: t('employmentType'), v: employee.employmentType }
      : null,
    employee.hireDate
      ? {
          k: t('listQuickPanelHireDate'),
          v: (
            <>
              {hireDateStr}
              {tenureText && (
                <span className="ml-1.5 text-muted-foreground">· {tenureText}</span>
              )}
            </>
          ),
        }
      : null,
    employee.phone ? { k: t('phone'), v: employee.phone } : null,
    employee.email
      ? { k: t('email'), v: <span className="block truncate">{employee.email}</span> }
      : null,
    {
      k: t('listQuickPanelStatus'),
      v: <StatusBadge status={employee.status}>{statusText}</StatusBadge>,
    },
  ] as ({ k: string; v: ReactNode } | null)[]).filter(
    (r): r is { k: string; v: ReactNode } => r !== null,
  )

  const tags = [
    employee.title?.name && (
      <span
        key="title"
        className="rounded-full border border-border bg-card px-2 py-0.5 text-[10.5px] font-medium text-foreground"
      >
        {employee.title.name}
      </span>
    ),
    employee.department?.name && (
      <span
        key="dept"
        className="rounded-full border border-border bg-card px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground"
      >
        {employee.department.name}
      </span>
    ),
  ].filter(Boolean)

  return (
    <EmployeeInspector
      name={employee.name}
      nameEn={employee.nameEn}
      code={employee.employeeNo}
      photoUrl={employee.photoUrl}
      avatarColor={wtAvatarColor(employee.id)}
      tags={tags.length > 0 ? tags : undefined}
      // Message/Document/1:1 — 미구현(P3 라우팅·i18n P1-6c). disabled로
      // 시각 충실도 유지 + dead-control 방지 (Codex P2).
      quickActions={[
        { ariaLabel: 'Message', icon: Mail, onClick: () => {}, disabled: true },
        { ariaLabel: 'Document', icon: FileText, onClick: () => {}, disabled: true },
        { ariaLabel: '1:1', icon: Calendar, onClick: () => {}, disabled: true },
      ]}
      // 섹션 헤더 임시 영문 — i18n P1-6c
      sectionLabels={{ info: 'Basic Info', stats: 'Quick Stats', activity: 'Recent Activity' }}
      kv={kv}
      // 빠른통계·최근활동 실데이터 P3 이월 → EmptyState 플레이스홀더(Q5)
      statsSlot={<EmptyState size="sm" />}
      activitySlot={<EmptyState size="sm" />}
      viewFull={{
        label: t('listViewFullProfile'),
        onClick: onViewFull,
        icon: ExternalLink,
      }}
    />
  )
}

// ─── Component ──────────────────────────────────────────────

export function EmployeeListClient({ user }: EmployeeListClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const t = useTranslations('employee')
  const tc = useTranslations('common')

  // ─── URL deep link state ───
  const selectedId = searchParams.get('selectedId')

  const openPanel = useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('selectedId', id)
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [router, pathname, searchParams],
  )

  const closePanel = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('selectedId')
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [router, pathname, searchParams])

  // ─── Translated label maps ───
  const EMPLOYMENT_TYPE_LABELS: Record<string, string> = useMemo(() => ({
    FULL_TIME: t('fullTime'),
    CONTRACT: t('contract'),
    DISPATCH: t('dispatch'),
    INTERN: t('intern'),
  }), [t])

  const STATUS_LABELS: Record<string, string> = useMemo(() => ({
    ACTIVE: t('statusActive'),
    ON_LEAVE: t('statusOnLeave'),
    RESIGNED: t('statusResigned'),
    TERMINATED: t('statusTerminated'),
    PROBATION: t('statusProbation'),
  }), [t])

  // ─── Filter state ───
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [employmentType, setEmploymentType] = useState('')
  const [status, setStatus] = useState('')
  const [filters, setFilters] = useState<FilterValues>({})
  const [exportLoading, setExportLoading] = useState(false)
  // bulkUploadOpen state 제거 — 새 페이지로 navigate
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [sortBy, setSortBy] = useState('name')
  const [sortDir, setSortDir] = useState<SortDirection>('asc')

  // ─── Row selection (canary BulkActionBar) ───
  // 쿼리(페이지·필터·정렬·검색)가 바뀌면 fetch effect에서 초기화 → 선택은 항상 현재 페이지 행만.
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // ─── Data state ───
  const [employees, setEmployees] = useState<EmployeeRow[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([])

  // ─── Debounce search ───
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value)
      setPage(1)
    }, 300)
  }, [])

  // ─── Load departments for filter ───
  useEffect(() => {
    apiClient
      .getList<{ id: string; name: string }>('/api/v1/org/departments', { limit: 200 })
      .then((res) => setDepartments(res.data))
      .catch(() => undefined)
  }, [])

  // ─── Load employees ───
  useEffect(() => {
    setLoading(true)
    // 쿼리 변경 시 선택 초기화 — 화면에 없는 행이 선택 상태로 남지 않도록 (Codex G1 MED5)
    setSelected(new Set())
    apiClient
      .getList<EmployeeRow>('/api/v1/employees', {
        page,
        limit,
        sortBy,
        sortDir,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        // Quick-filter bar values take precedence; panel filters supplement
        ...(departmentId ? { departmentId } : filters.departmentId ? { departmentId: filters.departmentId } : {}),
        ...(employmentType ? { employmentType } : filters.employmentType ? { employmentType: filters.employmentType } : {}),
        ...(status ? { status } : filters.status ? { status: filters.status } : {}),
        // Panel-only filters
        ...(filters.companyId ? { companyId: filters.companyId } : {}),
        ...(filters.jobGradeId ? { jobGradeId: filters.jobGradeId } : {}),
        ...(filters.contractType ? { contractType: filters.contractType } : {}),
        ...(filters.hireDateFrom ? { hireDateFrom: filters.hireDateFrom } : {}),
        ...(filters.hireDateTo ? { hireDateTo: filters.hireDateTo } : {}),
      })
      .then((res) => {
        setEmployees(res.data)
        setPagination(res.pagination)
      })
      .catch(() => setEmployees([]))
      .finally(() => setLoading(false))
  }, [page, limit, sortBy, sortDir, debouncedSearch, departmentId, employmentType, status, filters])

  // ─── Sort handler ───
  const handleSort = useCallback(
    (key: string) => {
      if (sortBy === key) {
        setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortBy(key)
        setSortDir('asc')
      }
      setPage(1)
    },
    [sortBy],
  )

  // ─── Export handler ───
  const handleExport = useCallback(() => {
    setExportLoading(true)
    const params = new URLSearchParams()
    if (debouncedSearch) params.set('search', debouncedSearch)
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v) })
    if (departmentId) params.set('departmentId', departmentId)
    if (employmentType) params.set('employmentType', employmentType)
    if (status) params.set('status', status)
    const a = document.createElement('a')
    a.href = `/api/v1/employees/export?${params.toString()}`
    a.download = 'employees.xlsx'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => setExportLoading(false), 1000)
  }, [filters, debouncedSearch, departmentId, employmentType, status])

  // ─── Selection handlers (BulkActionBar) ───
  const toggleRow = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const toggleAllVisible = useCallback(
    (nextAll: boolean) => {
      // 선택은 현재 페이지 행만 — nextAll이면 현재 페이지 전체, 아니면 해제
      setSelected(nextAll ? new Set(employees.map((e) => e.id)) : new Set())
    },
    [employees],
  )

  const clearSelection = useCallback(() => setSelected(new Set()), [])

  // 선택 직원만 엑셀 — /export?ids= (서버에서 회사 스코프와 AND, 멀티테넌트 안전)
  const handleExportSelected = useCallback(() => {
    if (selected.size === 0) return
    const params = new URLSearchParams({ ids: [...selected].join(',') })
    const a = document.createElement('a')
    a.href = `/api/v1/employees/export?${params.toString()}`
    a.download = 'employees.xlsx'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [selected])

  // ─── Row click → URL deep link ───
  const handleRowClick = useCallback(
    (row: EmployeeRow) => {
      openPanel(row.id)
    },
    [openPanel],
  )

  // ─── Selected employee name for panel subtitle ───
  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === selectedId) ?? null,
    [employees, selectedId],
  )

  // ─── Columns ───
  const columns = useMemo<DataTableColumn<EmployeeRow>[]>(() => [
    {
      key: 'employeeNo',
      header: t('employeeCode'),
      render: (row) => <span className="font-mono tabular-nums text-sm">{row.employeeNo}</span>,
    },
    {
      key: 'name',
      header: t('name'),
      sortable: true,
      render: (row) => (
        <div>
          <p className={`font-medium ${row.id === selectedId ? 'text-primary' : ''}`}>
            {row.name}
          </p>
          {row.nameEn && <p className="text-xs text-muted-foreground">{row.nameEn}</p>}
        </div>
      ),
    },
    {
      key: 'department',
      header: t('department'),
      sortable: true,
      render: (row) => row.department?.name ?? '-',
    },
    {
      key: 'title',
      header: t('employeeTitle'),
      render: (row) => row.title?.name ?? '-',
    },
    {
      key: 'jobCategory',
      header: t('jobCategory'),
      render: (row) => row.jobCategory?.name ?? '-',
    },
    {
      key: 'hireDate',
      header: t('hireDate'),
      sortable: true,
      render: (row) =>
        row.hireDate ? new Date(row.hireDate).toLocaleDateString('ko-KR') : '-',
    },
    {
      key: 'employmentType',
      header: t('employmentType'),
      render: (row) => EMPLOYMENT_TYPE_LABELS[row.employmentType] ?? row.employmentType,
    },
    {
      key: 'status',
      header: t('status'),
      render: (row) => {
        const now = new Date()
        const probation = deriveProbationBadge(row.probationEndDate, row.probationStatus, now)
        const contract = deriveContractBadge(row.contractEndDate, now)
        return (
          <div className="flex flex-wrap items-center gap-1">
            <StatusBadge status={row.status}>
              {STATUS_LABELS[row.status] ?? row.status}
            </StatusBadge>
            {probation && (
              <Badge variant={probation.variant}>
                {t(`lifecycle.${probation.labelKey}`, { days: Math.abs(probation.daysLeft) })}
              </Badge>
            )}
            {contract && (
              <Badge variant={contract.variant}>
                {t(`lifecycle.${contract.labelKey}`, { days: Math.abs(contract.daysLeft) })}
              </Badge>
            )}
          </div>
        )
      },
    },
  ], [t, EMPLOYMENT_TYPE_LABELS, STATUS_LABELS, selectedId])

  const isHrAdmin = user.role === ROLE.HR_ADMIN || user.role === ROLE.SUPER_ADMIN

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title={t('title')}
        description={t('listDescription')}
        actions={
          isHrAdmin ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => router.push('/hr/bulk-movements')}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                {t('listBulkMovement')}
              </Button>
              <Button
                onClick={() => router.push('/employees/new')}
                className="bg-ctr-primary hover:bg-ctr-primary-dark text-white"
              >
                <Plus className="mr-2 h-4 w-4" />
                {t('newEmployee')}
              </Button>
            </div>
          ) : undefined
        }
      />

      {!loading && pagination ? (() => {
        // 쿼리에 실제 반영되는 effective 필터(빠른+고급 패널) 기준으로 칩 도출
        const otherFilterActive =
          !!departmentId ||
          !!employmentType ||
          Object.values(filters).some((v) => v != null && v !== '')
        const anyFilter = !!status || !!debouncedSearch || otherFilterActive
        const statusTone = (status === 'ACTIVE'
          ? 'success'
          : status === 'ON_LEAVE'
            ? 'warn'
            : status === 'RESIGNED' || status === 'TERMINATED'
              ? 'danger'
              : 'default') as 'success' | 'warn' | 'danger' | 'default'
        return (
          <WdStatusChips
            aria-label={t('listDescription')}
            items={[
              { label: tc('total'), value: pagination.total, tone: 'accent' },
              ...(status
                ? [{ label: STATUS_LABELS[status] ?? status, tone: statusTone }]
                : []),
              ...(debouncedSearch
                ? [{ label: debouncedSearch, tone: 'default' as const }]
                : []),
              ...(otherFilterActive
                ? [{ label: tc('filter'), tone: 'default' as const }]
                : []),
              ...(!anyFilter ? [{ label: tc('filter'), muted: true }] : []),
            ]}
          />
        )
      })() : null}

      {/* ─── Advanced Filter Panel ─── */}
      <EmployeeFilterPanel
        filters={filters}
        onFilterChange={(newFilters) => {
          setFilters(newFilters)
          setPage(1)
        }}
        onExport={handleExport}
        exportLoading={exportLoading}
        isHrAdmin={isHrAdmin}
      />

      {/* ─── Filters ─── */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder={t('searchEmployee')}
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-64"
        />

        <Select
          value={departmentId || SENTINEL_ALL}
          onValueChange={(v) => {
            setDepartmentId(v === SENTINEL_ALL ? '' : v)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t('departmentAll')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SENTINEL_ALL}>{t('departmentAll')}</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={employmentType || SENTINEL_ALL}
          onValueChange={(v) => {
            setEmploymentType(v === SENTINEL_ALL ? '' : v)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder={t('employmentType')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SENTINEL_ALL}>{t('employmentTypeAll')}</SelectItem>
            {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={status || SENTINEL_ALL}
          onValueChange={(v) => {
            setStatus(v === SENTINEL_ALL ? '' : v)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder={tc('status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SENTINEL_ALL}>{t('statusAll')}</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={String(limit)}
          onValueChange={(v) => {
            setLimit(Number(v))
            setPage(1)
          }}
        >
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LIMIT_OPTIONS.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n} {tc('items')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ─── Table ─── */}
      <DataTable<EmployeeRow>
        columns={columns}
        data={employees}
        pagination={pagination ?? undefined}
        onPageChange={setPage}
        sortBy={sortBy}
        sortDir={sortDir}
        onSort={handleSort}
        onRowClick={handleRowClick}
        loading={loading}
        emptyMessage={t('emptyMessage')}
        emptyDescription={
          isHrAdmin ? t('emptyDescription') : undefined
        }
        emptyAction={
          isHrAdmin
            ? { label: t('newEmployee'), onClick: () => router.push('/employees/new') }
            : undefined
        }
        rowKey={(row) => row.id}
        // 행 선택 — /employees는 HR_UP 전용 라우트라 isHrAdmin == 전 뷰어(export 권한 보유)
        selectable={isHrAdmin}
        selectedKeys={selected}
        onToggleRow={toggleRow}
        onToggleAllVisible={toggleAllVisible}
        selectAllLabel={t('bulkSelectAll')}
        rowSelectLabel={(row) => t('bulkSelectRow', { name: row.name })}
      />

      {/* ─── P01 Master-Detail: URL Deep Link Panel ─── */}
      <DetailPanel
        open={!!selectedId}
        onClose={closePanel}
        title={selectedEmployee?.name ?? t('listQuickPanelTitle')}
        subtitle={selectedEmployee?.department?.name ?? undefined}
        width="w-[min(480px,92vw)]"
      >
        {selectedId && (
          <EmployeeQuickPanel
            employeeId={selectedId}
            onViewFull={() => {
              closePanel()
              router.push(`/employees/${selectedId}`)
            }}
          />
        )}
      </DetailPanel>

      {/* ─── Bulk Action Bar (선택 직원 일괄 작업) ─── */}
      {/* 메시지 보내기·일괄 발령(선택주입)은 백엔드 부재 → 후속 피처로 actions 배열에 additive 추가 */}
      {isHrAdmin && (
        <BulkActionBar
          count={selected.size}
          onClear={clearSelection}
          label={t('bulkSelectedCount', { count: selected.size })}
          clearAriaLabel={t('bulkClearSelection')}
          actions={[
            {
              label: t('bulkExportSelected'),
              icon: Download,
              onClick: handleExportSelected,
              primary: true,
            },
          ]}
        />
      )}

      {/* Bulk Upload Wizard → /hr/bulk-movements 로 이동됨 */}
    </div>
  )
}
