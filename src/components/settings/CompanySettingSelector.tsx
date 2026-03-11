'use client'

// ═══════════════════════════════════════════════════════════
// Settings — Company Override Selector (H-1)
// Dropdown: "글로벌 (기본값)" + companies from API
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react'
import { Building2, ChevronDown, Globe } from 'lucide-react'
import { apiClient } from '@/lib/api'

interface Company {
  id: string
  code: string
  name: string
  nameEn: string | null
  currency: string
}

interface CompanySettingSelectorProps {
  value: string | null  // null = global
  onChange: (companyId: string | null) => void
  className?: string
}

export function CompanySettingSelector({ value, onChange, className = '' }: CompanySettingSelectorProps) {
  const [companies, setCompanies] = useState<Company[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    apiClient.get<Company[]>('/api/v1/org/companies').then((res) => {
      if (res.data) setCompanies(res.data)
    })
  }, [])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const selected = value ? companies.find((c) => c.id === value) : null

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-lg border border-[#F0F0F3] bg-white px-4 py-2.5 text-sm transition-colors hover:border-[#5E81F4]/40 focus:outline-none focus:ring-2 focus:ring-[#5E81F4]/20"
      >
        {value ? (
          <Building2 className="h-4 w-4 text-[#5E81F4]" />
        ) : (
          <Globe className="h-4 w-4 text-[#8181A5]" />
        )}
        <span className="font-medium text-[#1C1D21]">
          {selected ? `${selected.code} — ${selected.name}` : '글로벌 (기본값)'}
        </span>
        <ChevronDown className={`ml-1 h-4 w-4 text-[#8181A5] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-72 overflow-hidden rounded-xl border border-[#F0F0F3] bg-white shadow-lg animate-in fade-in-0 zoom-in-95 duration-150">
          {/* Global option */}
          <button
            type="button"
            onClick={() => { onChange(null); setOpen(false) }}
            className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-[#F5F5FA] ${
              !value ? 'bg-[#5E81F4]/5 text-[#5E81F4]' : 'text-[#1C1D21]'
            }`}
          >
            <Globe className="h-4 w-4" />
            <div>
              <p className="font-medium">글로벌 (기본값)</p>
              <p className="text-xs text-[#8181A5]">모든 법인에 적용되는 기본 설정</p>
            </div>
          </button>
          <div className="border-t border-[#F0F0F3]" />
          {/* Companies */}
          {companies.map((company) => (
            <button
              key={company.id}
              type="button"
              onClick={() => { onChange(company.id); setOpen(false) }}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-[#F5F5FA] ${
                company.id === value ? 'bg-[#5E81F4]/5 text-[#5E81F4]' : 'text-[#1C1D21]'
              }`}
            >
              <Building2 className="h-4 w-4 text-[#8181A5]" />
              <span className="font-medium">{company.code}</span>
              <span className="text-[#8181A5]">{company.name}</span>
              <span className="ml-auto text-xs text-[#8181A5]">{company.currency}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
