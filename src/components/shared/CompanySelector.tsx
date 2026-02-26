'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — CompanySelector
// 법인 전환 드롭다운 (헤더 우측 배치)
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Building2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ROLE } from '@/lib/constants'

// ─── Types ──────────────────────────────────────────────────

interface CompanyOption {
  id: string
  name: string
  nameEn: string | null
}

interface CompanySelectorProps {
  companies: CompanyOption[]
  currentCompanyId: string
  userRole: string
}

const GROUP_AGGREGATE_ID = '__GROUP_ALL__'

// ─── Component ──────────────────────────────────────────────

export function CompanySelector({
  companies,
  currentCompanyId,
  userRole,
}: CompanySelectorProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [selectedCompanyId, setSelectedCompanyId] = useState(
    searchParams.get('company_id') ?? currentCompanyId,
  )

  // Sync from URL changes
  useEffect(() => {
    const urlCompanyId = searchParams.get('company_id')
    if (urlCompanyId && urlCompanyId !== selectedCompanyId) {
      setSelectedCompanyId(urlCompanyId)
    }
  }, [searchParams, selectedCompanyId])

  const handleChange = useCallback(
    (value: string) => {
      setSelectedCompanyId(value)
      const params = new URLSearchParams(searchParams.toString())
      if (value === currentCompanyId) {
        params.delete('company_id')
      } else {
        params.set('company_id', value)
      }
      const query = params.toString()
      router.push(`${pathname}${query ? `?${query}` : ''}`)
    },
    [router, pathname, searchParams, currentCompanyId],
  )

  // HR_ADMIN / EXECUTIVE / SUPER_ADMIN see all companies + group aggregate
  const canSeeAll = [ROLE.HR_ADMIN, ROLE.EXECUTIVE, ROLE.SUPER_ADMIN].includes(
    userRole as typeof ROLE.HR_ADMIN,
  )

  // MANAGER / EMPLOYEE: own company only (read-only)
  if (!canSeeAll) {
    const ownCompany = companies.find((c) => c.id === currentCompanyId)
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Building2 className="h-4 w-4" />
        <span>{ownCompany?.name ?? '내 법인'}</span>
      </div>
    )
  }

  return (
    <Select value={selectedCompanyId} onValueChange={handleChange}>
      <SelectTrigger className="w-[200px]">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 shrink-0" />
          <SelectValue placeholder="법인 선택" />
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={GROUP_AGGREGATE_ID}>그룹 합산</SelectItem>
        {companies.map((company) => (
          <SelectItem key={company.id} value={company.id}>
            {company.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
