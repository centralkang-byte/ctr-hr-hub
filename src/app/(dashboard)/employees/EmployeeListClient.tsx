'use client'


// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Employee List Client
// 직원 목록: DataTable + 필터 + 검색 + 페이지네이션
// P01 Master-Detail: URL deep linking (?selectedId=)
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Plus,
  Upload,
  User,
  Building2,
  Calendar,
  ExternalLink,
    Mail,
  Phone,
  MapPin,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { DetailPanel } from '@/components/shared/DetailPanel'
import { EmployeeFilterPanel, type FilterValues } from '@/components/employees/EmployeeFilterPanel'
// BulkUploadWizard deprecated — 새 bulk-movements 페이지로 이동
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

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  ACTIVE: 'default',
  ON_LEAVE: 'secondary',
  RESIGNED: 'outline',
  TERMINATED: 'destructive',
}

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

  const hireDate = employee.hireDate
    ? new Date(employee.hireDate).toLocaleDateString('ko-KR')
    : '-'

  const subtitle = [employee.title?.name, employee.position?.titleKo].filter(Boolean).join(' · ')

  const STATUS_RING: Record<string, string> = {
    ACTIVE: 'ring-2 ring-green-500',
    ON_LEAVE: 'ring-2 ring-orange-400',
    RESIGNED: 'ring-2 ring-gray-400',
    TERMINATED: '',
  }
  const ringClass = STATUS_RING[employee.status] ?? ''

  function calcTenure(d: string): { years: number; months: number } {
    const hire = new Date(d)
    const now = new Date()
    const totalMonths = (now.getFullYear() - hire.getFullYear()) * 12 + (now.getMonth() - hire.getMonth())
    return { years: Math.floor(totalMonths / 12), months: totalMonths % 12 }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Profile header */}
      <div className="px-5 py-5 flex items-center gap-4 border-b border-border">
        <div className={`w-14 h-14 rounded-full bg-border flex items-center justify-center overflow-hidden flex-shrink-0 ${ringClass} ring-offset-2`}>
          {employee.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={employee.photoUrl}
              alt={employee.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <User className="w-7 h-7 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-foreground truncate">{employee.name}</p>
          {employee.nameEn && (
            <p className="text-xs text-muted-foreground truncate">{employee.nameEn}</p>
          )}
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-0.5 truncate">{subtitle}</p>
          )}
          <span className="text-xs font-mono tabular-nums text-muted-foreground mt-1 block">{employee.employeeNo}</span>
        </div>
      </div>

      {/* Detail fields */}
      <div className="px-5 py-4 space-y-3 flex-1 overflow-y-auto">
        {/* 조직 */}
        {employee.company && (
          <div className="flex items-center gap-3">
            <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="text-[11px] text-muted-foreground">{t('listQuickPanelCompany')}</p>
              <p className="text-sm text-foreground">{employee.company.name}</p>
            </div>
          </div>
        )}

        {employee.department && (
          <div className="flex items-center gap-3">
            <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="text-[11px] text-muted-foreground">{t('listQuickPanelDepartment')}</p>
              <p className="text-sm text-foreground">{employee.department.name}</p>
            </div>
          </div>
        )}

        {employee.workLocation && (
          <div className="flex items-center gap-3">
            <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="text-[11px] text-muted-foreground">{t('listQuickPanelWorkLocation')}</p>
              <p className="text-sm text-foreground">{employee.workLocation.name}</p>
            </div>
          </div>
        )}

        {/* 구분선 */}
        <div className="border-t border-border" />

        {/* 연락처 */}
        {employee.email && (
          <div className="flex items-center gap-3">
            <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <p className="text-sm text-foreground truncate">{employee.email}</p>
          </div>
        )}

        {employee.phone && (
          <div className="flex items-center gap-3">
            <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <p className="text-sm text-foreground">{employee.phone}</p>
          </div>
        )}

        {/* 구분선 */}
        <div className="border-t border-border" />

        {/* 입사일 + 근속 */}
        <div className="flex items-center gap-3">
          <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <div>
            <p className="text-[11px] text-muted-foreground">{t('listQuickPanelHireDate')}</p>
            <p className="text-sm text-foreground">
              {hireDate}
              {employee.hireDate && (
                <span className="text-xs text-muted-foreground ml-1.5">· {(() => { const tn = calcTenure(employee.hireDate); return tn.years > 0 ? t('tenureYearsMonths', tn) : tn.months > 0 ? t('tenureMonthsOnly', tn) : t('tenureZeroMonths') })()}</span>
              )}
            </p>
          </div>
        </div>

        {/* 재직 상태 */}
        <div className="pt-1">
          <p className="text-[11px] text-muted-foreground mb-1.5">{t('listQuickPanelStatus')}</p>
          <Badge variant={STATUS_VARIANTS[employee.status] ?? 'outline'}>
            {({
              ACTIVE: t('statusActive'),
              ON_LEAVE: t('statusOnLeave'),
              RESIGNED: t('statusResigned'),
              TERMINATED: t('statusTerminated'),
            } as Record<string, string>)[employee.status] ?? employee.status}
          </Badge>
        </div>
      </div>

      {/* Footer action */}
      <div className="px-5 py-4 border-t border-border">
        <Button
          onClick={onViewFull}
          className="w-full bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg"
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          {t('listViewFullProfile')}
        </Button>
      </div>
    </div>
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
      render: (row) => (
        <Badge variant={STATUS_VARIANTS[row.status] ?? 'outline'}>
          {STATUS_LABELS[row.status] ?? row.status}
        </Badge>
      ),
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
      />

      {/* ─── P01 Master-Detail: URL Deep Link Panel ─── */}
      <DetailPanel
        open={!!selectedId}
        onClose={closePanel}
        title={selectedEmployee?.name ?? t('listQuickPanelTitle')}
        subtitle={selectedEmployee?.department?.name ?? undefined}
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

      {/* Bulk Upload Wizard → /hr/bulk-movements 로 이동됨 */}
    </div>
  )
}
