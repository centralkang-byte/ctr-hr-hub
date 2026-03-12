'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, LayoutGrid, List, Building2, Users, Filter, X, Mail, Phone, MapPin, ExternalLink } from 'lucide-react'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { useDebounce } from '@/hooks/useDebounce'
import { TABLE_STYLES } from '@/lib/styles'

interface DirectoryEmployee {
  id: string
  name: string
  nameEn: string | null
  email: string
  phone: string | null
  photoUrl: string | null
  avatarPath: string | null
  department: { id: string; name: string } | null
  jobGrade: { id: string; name: string; code: string } | null
  company: { id: string; code: string; name: string } | null
  bio: string | null
  skills: string[]
  languages: unknown
  certifications: unknown
}

interface DirectoryClientProps {
  user: SessionUser
  companies: { id: string; code: string; name: string }[]
  departments: { id: string; name: string; companyId: string }[]
  jobGrades: { id: string; name: string; code: string; companyId: string }[]
}

function InitialAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const sizeClass = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-16 h-16 text-xl',
  }[size]

  const colors = [
    'bg-primary text-white',
    'bg-[#4338CA] text-white',
    'bg-[#059669] text-white',
    'bg-[#B45309] text-white',
    'bg-[#DC2626] text-white',
  ]
  const color = colors[name.charCodeAt(0) % colors.length]

  return (
    <div className={`${sizeClass} ${color} rounded-full flex items-center justify-center font-bold shrink-0`}>
      {initials}
    </div>
  )
}

export function DirectoryClient({ user, companies, departments, jobGrades }: DirectoryClientProps) {
  const router = useRouter()
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card')
  const [search, setSearch] = useState('')
  const [selectedCompany, setSelectedCompany] = useState('all')
  const [selectedDept, setSelectedDept] = useState('all')
  const [selectedGrade, setSelectedGrade] = useState('all')
  const [employees, setEmployees] = useState<DirectoryEmployee[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [selectedEmployee, setSelectedEmployee] = useState<DirectoryEmployee | null>(null)
  const debouncedSearch = useDebounce(search, 300)

  const fetchDirectory = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = { page: String(page), limit: '20' }
      if (debouncedSearch) params.search = debouncedSearch
      if (selectedCompany && selectedCompany !== 'all') params.companyId = selectedCompany
      if (selectedDept && selectedDept !== 'all') params.departmentId = selectedDept
      if (selectedGrade && selectedGrade !== 'all') params.jobGradeId = selectedGrade

      const res = await apiClient.getList<DirectoryEmployee>('/api/v1/directory', params)
      setEmployees(res.data ?? [])
      setTotal(res.pagination?.total ?? 0)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, selectedCompany, selectedDept, selectedGrade, page])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, selectedCompany, selectedDept, selectedGrade])

  useEffect(() => {
    fetchDirectory()
  }, [fetchDirectory])

  const clearFilters = () => {
    setSearch('')
    setSelectedCompany('all')
    setSelectedDept('all')
    setSelectedGrade('all')
  }

  const hasFilters = search || (selectedCompany && selectedCompany !== 'all') || (selectedDept && selectedDept !== 'all') || (selectedGrade && selectedGrade !== 'all')

  const filteredDepts = selectedCompany && selectedCompany !== 'all'
    ? departments.filter((d) => d.companyId === selectedCompany)
    : departments

  const filteredGrades = selectedCompany && selectedCompany !== 'all'
    ? jobGrades.filter((g) => g.companyId === selectedCompany)
    : jobGrades

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">People Directory</h1>
          <p className="text-sm text-[#666] mt-0.5">총 {total.toLocaleString()}명의 구성원</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('card')}
            className={`p-2 rounded-lg ${viewMode === 'card' ? 'bg-primary text-white' : 'text-[#666] hover:bg-[#F5F5F5]'}`}
          >
            <LayoutGrid size={18} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-primary text-white' : 'text-[#666] hover:bg-[#F5F5F5]'}`}
          >
            <List size={18} />
          </button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className={`${CARD_STYLES.kpi} space-y-3`}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999]" size={16} />
          <Input
            placeholder="이름, 부서, 이메일로 검색..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Filter size={14} className="text-[#666]" />
          <Select value={selectedCompany} onValueChange={setSelectedCompany}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue placeholder="법인 전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">법인 전체</SelectItem>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.code}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedDept} onValueChange={setSelectedDept}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue placeholder="부서 전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">부서 전체</SelectItem>
              {filteredDepts.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedGrade} onValueChange={setSelectedGrade}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue placeholder="직급 전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">직급 전체</SelectItem>
              {filteredGrades.map((g) => (
                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-[#666] hover:text-[#333]"
            >
              <X size={12} /> 초기화
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className={viewMode === 'card' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4' : 'space-y-2'}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className={viewMode === 'card' ? 'h-48 rounded-xl' : 'h-14 rounded-lg'} />
          ))}
        </div>
      ) : employees.length === 0 ? (
        <div className="text-center py-16 text-[#999]">
          <Users size={40} className="mx-auto mb-3 opacity-30" />
          <p>검색 결과가 없습니다</p>
        </div>
      ) : viewMode === 'card' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {employees.map((emp) => (
            <EmployeeCard key={emp.id} emp={emp} onClick={() => setSelectedEmployee(emp)} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#E8E8E8] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className={TABLE_STYLES.header}>
                <th className={TABLE_STYLES.headerCell}>이름</th>
                <th className={TABLE_STYLES.headerCell}>부서</th>
                <th className={TABLE_STYLES.headerCell}>직급</th>
                <th className={TABLE_STYLES.headerCell}>법인</th>
                <th className={TABLE_STYLES.headerCell}>연락처</th>
                <th className={TABLE_STYLES.headerCell}>스킬</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr
                  key={emp.id}
                  className={TABLE_STYLES.header}
                  onClick={() => setSelectedEmployee(emp)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <InitialAvatar name={emp.name} size="sm" />
                      <div>
                        <p className="text-sm font-medium text-[#1A1A1A]">{emp.name}</p>
                        {emp.nameEn && <p className="text-xs text-[#999]">{emp.nameEn}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#555]">{emp.department?.name ?? '-'}</td>
                  <td className="px-4 py-3 text-sm text-[#555]">{emp.jobGrade?.name ?? '-'}</td>
                  <td className="px-4 py-3 text-sm text-[#555]">{emp.company?.code ?? '-'}</td>
                  <td className="px-4 py-3 text-sm text-[#555]">{emp.email}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {emp.skills.slice(0, 3).map((s) => (
                        <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-[#E0E7FF] text-[#4338CA]">{s}</span>
                      ))}
                      {emp.skills.length > 3 && (
                        <span className="text-xs text-[#999]">+{emp.skills.length - 3}</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>이전</Button>
          <span className="text-sm text-[#666]">{page} / {Math.ceil(total / 20)}</span>
          <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)}>다음</Button>
        </div>
      )}

      {/* Profile Detail Panel */}
      <Sheet open={!!selectedEmployee} onOpenChange={(open) => !open && setSelectedEmployee(null)}>
        <SheetContent className="w-[420px] overflow-y-auto">
          {selectedEmployee && <EmployeeDetailPanel emp={selectedEmployee} onViewProfile={(id) => router.push(`/employees/${id}`)} />}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function EmployeeCard({ emp, onClick }: { emp: DirectoryEmployee; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`${CARD_STYLES.kpi} text-left hover:border-[#00C853] hover:shadow-sm transition-all flex flex-col items-center gap-2`}
    >
      <InitialAvatar name={emp.name} size="lg" />
      <div className="text-center">
        <p className="text-sm font-semibold text-[#1A1A1A]">{emp.name}</p>
        {emp.nameEn && <p className="text-xs text-[#999]">{emp.nameEn}</p>}
        <p className="text-xs text-[#666] mt-0.5">{emp.department?.name ?? '-'}</p>
        <p className="text-xs text-[#999]">{emp.company?.code ?? '-'} · {emp.jobGrade?.name ?? '-'}</p>
      </div>
      {emp.skills.length > 0 && (
        <div className="flex gap-1 flex-wrap justify-center">
          {emp.skills.slice(0, 3).map((s) => (
            <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-[#E0E7FF] text-[#4338CA]">{s}</span>
          ))}
        </div>
      )}
    </button>
  )
}

function EmployeeDetailPanel({ emp, onViewProfile }: { emp: DirectoryEmployee; onViewProfile: (id: string) => void }) {
  const certifications = emp.certifications as Array<{ name: string; issuer: string; date: string }> | null
  const languages = emp.languages as Array<{ language: string; level: string }> | null

  return (
    <div className="space-y-5">
      <SheetHeader>
        <div className="flex items-start gap-3">
          <InitialAvatar name={emp.name} size="lg" />
          <div>
            <SheetTitle className="text-lg">{emp.name}</SheetTitle>
            {emp.nameEn && <p className="text-sm text-[#999]">{emp.nameEn}</p>}
            <p className="text-sm text-[#666] mt-0.5">
              {emp.department?.name} · {emp.jobGrade?.name} · {emp.company?.code}
            </p>
          </div>
        </div>
      </SheetHeader>

      {emp.bio && (
        <p className="text-sm text-[#555] italic">"{emp.bio}"</p>
      )}

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-[#555]">
          <Mail size={14} className="text-[#999]" />
          <span>{emp.email}</span>
        </div>
        {emp.phone && (
          <div className="flex items-center gap-2 text-sm text-[#555]">
            <Phone size={14} className="text-[#999]" />
            <span>{emp.phone}</span>
          </div>
        )}
      </div>

      {emp.skills.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-2">스킬</p>
          <div className="flex flex-wrap gap-1.5">
            {emp.skills.map((s) => (
              <span key={s} className="text-xs px-2.5 py-1 rounded-full bg-[#E0E7FF] text-[#4338CA]">{s}</span>
            ))}
          </div>
        </div>
      )}

      {languages && Array.isArray(languages) && languages.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-2">언어</p>
          <div className="space-y-1">
            {languages.map((l, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-[#555]">{l.language}</span>
                <span className="text-xs text-[#999]">{l.level}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {certifications && Array.isArray(certifications) && certifications.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-2">자격/인증</p>
          <div className="space-y-1">
            {certifications.map((c, i) => (
              <div key={i} className="text-sm text-[#555]">
                <span className="font-medium">{c.name}</span>
                <span className="text-[#999] ml-2">({c.issuer}, {c.date})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="pt-2 border-t border-[#E8E8E8]">
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={() => onViewProfile(emp.id)}
        >
          <ExternalLink size={14} className="mr-1.5" />
          프로필 상세 보기
        </Button>
      </div>
    </div>
  )
}
