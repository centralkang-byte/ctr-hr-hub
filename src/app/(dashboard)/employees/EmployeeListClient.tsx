'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Employee List Client
// 직원 목록: DataTable + 필터 + 검색 + 페이지네이션
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Plus } from 'lucide-react'
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
  jobCategory: { id: string; name: string } | null
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

// ─── Component ──────────────────────────────────────────────

export function EmployeeListClient({ user }: EmployeeListClientProps) {
  const router = useRouter()
  const t = useTranslations('employee')
  const tc = useTranslations('common')

  // ─── Translated label maps ───
  const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
    FULL_TIME: t('fullTime'),
    CONTRACT: t('contract'),
    DISPATCH: t('dispatch'),
    INTERN: t('intern'),
  }

  const STATUS_LABELS: Record<string, string> = {
    ACTIVE: t('statusActive'),
    ON_LEAVE: t('statusOnLeave'),
    RESIGNED: t('statusResigned'),
    TERMINATED: t('statusTerminated'),
  }

  // ─── Filter state ───
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [employmentType, setEmploymentType] = useState('')
  const [status, setStatus] = useState('')
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
        ...(departmentId ? { departmentId } : {}),
        ...(employmentType ? { employmentType } : {}),
        ...(status ? { status } : {}),
      })
      .then((res) => {
        setEmployees(res.data)
        setPagination(res.pagination)
      })
      .catch(() => setEmployees([]))
      .finally(() => setLoading(false))
  }, [page, limit, sortBy, sortDir, debouncedSearch, departmentId, employmentType, status])

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

  // ─── Row click ───
  const handleRowClick = useCallback(
    (row: EmployeeRow) => {
      router.push(`/employees/${row.id}`)
    },
    [router],
  )

  // ─── Columns ───
  const columns = useMemo<DataTableColumn<EmployeeRow>[]>(() => [
    {
      key: 'employeeNo',
      header: t('employeeCode'),
      render: (row) => <span className="font-mono text-sm">{row.employeeNo}</span>,
    },
    {
      key: 'name',
      header: t('name'),
      sortable: true,
      render: (row) => (
        <div>
          <p className="font-medium">{row.name}</p>
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
      key: 'jobGrade',
      header: t('jobGrade'),
      render: (row) => row.jobGrade?.name ?? '-',
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
  ], [t, EMPLOYMENT_TYPE_LABELS, STATUS_LABELS])

  const isHrAdmin = user.role === ROLE.HR_ADMIN || user.role === ROLE.SUPER_ADMIN

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title={t('title')}
        description={t('listDescription')}
        actions={
          isHrAdmin ? (
            <Button
              onClick={() => router.push('/employees/new')}
              className="bg-ctr-primary hover:bg-ctr-primary/90"
            >
              <Plus className="mr-2 h-4 w-4" />
              {t('newEmployee')}
            </Button>
          ) : undefined
        }
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
                {n}{tc('items')}
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
    </div>
  )
}
