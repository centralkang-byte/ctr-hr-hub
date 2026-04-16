'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { SlidersHorizontal, X, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet'
import { apiClient } from '@/lib/api'

export interface FilterValues {
  companyId?: string
  departmentId?: string
  jobGradeId?: string
  status?: string
  employmentType?: string
  contractType?: string
  hireDateFrom?: string
  hireDateTo?: string
}

interface CompanyOption { id: string; name: string }
interface DeptOption { id: string; name: string; companyId: string }
interface GradeOption { id: string; name: string }

interface EmployeeFilterPanelProps {
  filters: FilterValues
  onFilterChange: (filters: FilterValues) => void
  onExport?: () => void
  exportLoading?: boolean
  isHrAdmin?: boolean
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Badge variant="outline" className="flex items-center gap-1 pl-2.5 pr-1.5 py-0.5 text-xs bg-primary/10 border-primary/20 text-primary">
      {label}
      <button onClick={onRemove} className="ml-0.5 rounded-full hover:bg-primary/20 p-0.5">
        <X className="h-3 w-3" />
      </button>
    </Badge>
  )
}

export function EmployeeFilterPanel({
  filters,
  onFilterChange,
  onExport,
  exportLoading = false,
  isHrAdmin = false,
}: EmployeeFilterPanelProps) {
  const t = useTranslations('employee')

  const [expanded, setExpanded] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [companies, setCompanies] = useState<CompanyOption[]>([])
  const [departments, setDepartments] = useState<DeptOption[]>([])
  const [jobGrades, setJobGrades] = useState<GradeOption[]>([])

  useEffect(() => {
    // Load reference data - try multiple endpoints
    apiClient.get<CompanyOption[]>('/api/v1/org/companies')
      .then((r) => setCompanies(r.data))
      .catch(() => {})

    apiClient.get<DeptOption[]>('/api/v1/org/departments')
      .then((r) => setDepartments(r.data))
      .catch(() => {})

    // Try job grades endpoint - might be at settings or org
    apiClient.get<GradeOption[]>('/api/v1/settings/job-grades')
      .then((r) => setJobGrades(r.data))
      .catch(() => {
        // fallback: try another path
        apiClient.get<GradeOption[]>('/api/v1/org/job-grades')
          .then((r) => setJobGrades(r.data))
          .catch(() => {})
      })
  }, [])

  const filteredDepts = filters.companyId
    ? departments.filter((d) => d.companyId === filters.companyId)
    : departments

  const set = (key: keyof FilterValues, value: string | undefined) => {
    const next = { ...filters, [key]: value || undefined }
    if (key === 'companyId') next.departmentId = undefined
    onFilterChange(next)
  }

  const chips: Array<{ key: keyof FilterValues; label: string }> = []
  if (filters.companyId) chips.push({ key: 'companyId', label: t('filterChipCompany', { name: companies.find((c) => c.id === filters.companyId)?.name ?? filters.companyId }) })
  if (filters.departmentId) chips.push({ key: 'departmentId', label: t('filterChipDepartment', { name: departments.find((d) => d.id === filters.departmentId)?.name ?? filters.departmentId }) })
  if (filters.jobGradeId) chips.push({ key: 'jobGradeId', label: t('filterChipGrade', { name: jobGrades.find((g) => g.id === filters.jobGradeId)?.name ?? filters.jobGradeId }) })
  if (filters.status) chips.push({ key: 'status', label: t('filterChipStatus', { name: filters.status }) })
  if (filters.employmentType) chips.push({ key: 'employmentType', label: t('filterChipEmployment', { name: filters.employmentType }) })
  if (filters.contractType) chips.push({ key: 'contractType', label: t('filterChipContract', { name: filters.contractType }) })
  if (filters.hireDateFrom) chips.push({ key: 'hireDateFrom', label: t('filterChipHireDateStart', { date: filters.hireDateFrom }) })
  if (filters.hireDateTo) chips.push({ key: 'hireDateTo', label: t('filterChipHireDateEnd', { date: filters.hireDateTo }) })

  const hasFilters = chips.length > 0

  // 필터 폼 (데스크톱 인라인 + 모바일 Sheet 공용)
  const filterForm = (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('filterCompany')}</Label>
            <Select value={filters.companyId ?? '__ALL__'} onValueChange={(v) => set('companyId', v === '__ALL__' ? undefined : v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t('filterAll')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__ALL__">{t('filterAll')}</SelectItem>
                {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('filterDepartment')}</Label>
            <Select value={filters.departmentId ?? '__ALL__'} onValueChange={(v) => set('departmentId', v === '__ALL__' ? undefined : v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t('filterAll')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__ALL__">{t('filterAll')}</SelectItem>
                {filteredDepts.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('filterGrade')}</Label>
            <Select value={filters.jobGradeId ?? '__ALL__'} onValueChange={(v) => set('jobGradeId', v === '__ALL__' ? undefined : v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t('filterAll')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__ALL__">{t('filterAll')}</SelectItem>
                {jobGrades.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('filterStatusLabel')}</Label>
            <Select value={filters.status ?? '__ALL__'} onValueChange={(v) => set('status', v === '__ALL__' ? undefined : v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t('filterAll')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__ALL__">{t('filterAll')}</SelectItem>
                <SelectItem value="ACTIVE">{t('filterStatusActive')}</SelectItem>
                <SelectItem value="ON_LEAVE">{t('filterStatusOnLeave')}</SelectItem>
                <SelectItem value="RESIGNED">{t('filterStatusResigned')}</SelectItem>
                <SelectItem value="TERMINATED">{t('filterStatusTerminated')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('filterEmploymentType')}</Label>
            <Select value={filters.employmentType ?? '__ALL__'} onValueChange={(v) => set('employmentType', v === '__ALL__' ? undefined : v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t('filterAll')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__ALL__">{t('filterAll')}</SelectItem>
                <SelectItem value="FULL_TIME">{t('filterFullTime')}</SelectItem>
                <SelectItem value="CONTRACT">{t('filterContract')}</SelectItem>
                <SelectItem value="INTERN">{t('filterIntern')}</SelectItem>
                <SelectItem value="DISPATCH">{t('filterDispatch')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('filterHireDateStart')}</Label>
            <Input
              type="date"
              value={filters.hireDateFrom ?? ''}
              onChange={(e) => set('hireDateFrom', e.target.value || undefined)}
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('filterHireDateEnd')}</Label>
            <Input
              type="date"
              value={filters.hireDateTo ?? ''}
              onChange={(e) => set('hireDateTo', e.target.value || undefined)}
              className="h-8 text-xs"
            />
          </div>
        </div>
  )

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        {/* 데스크톱: 인라인 토글 */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="hidden md:flex items-center gap-2 text-sm font-medium text-foreground hover:text-foreground"
        >
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          {t('filterAdvanced')}
          {hasFilters && (
            <span className="rounded-full bg-primary text-white text-xs px-1.5 py-0.5">
              {chips.length}
            </span>
          )}
        </button>

        {/* 모바일: Sheet 트리거 */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <button className="flex md:hidden items-center gap-2 text-sm font-medium text-foreground hover:text-foreground">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              {t('filterButton')}
              {hasFilters && (
                <span className="rounded-full bg-primary text-white text-xs px-1.5 py-0.5">
                  {chips.length}
                </span>
              )}
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{t('filterAdvanced')}</SheetTitle>
            </SheetHeader>
            <div className="py-4 space-y-4">
              {filterForm}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => setMobileOpen(false)}
                >
                  {t('filterApply')}
                </Button>
                {hasFilters && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { onFilterChange({}); setMobileOpen(false) }}
                  >
                    {t('filterReset')}
                  </Button>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <div className="flex items-center gap-2">
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onFilterChange({})}
              className="hidden md:flex h-7 text-xs text-muted-foreground hover:text-foreground"
            >
              {t('filterResetAll')}
            </Button>
          )}
          {isHrAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExport}
              disabled={exportLoading}
              className="h-7 gap-1.5 text-xs border-border"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{exportLoading ? t('filterExporting') : t('filterExport')}</span>
              <span className="sm:hidden">{exportLoading ? '...' : t('filterExportShort')}</span>
            </Button>
          )}
        </div>
      </div>

      {hasFilters && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <FilterChip
              key={chip.key}
              label={chip.label}
              onRemove={() => set(chip.key, undefined)}
            />
          ))}
        </div>
      )}

      {/* 데스크톱 인라인 필터 */}
      {expanded && (
        <div className="hidden md:block pt-2 border-t border-border">
          {filterForm}
        </div>
      )}
    </div>
  )
}
