'use client'

import { useState, useEffect } from 'react'
import { Building2, ChevronDown } from 'lucide-react'
import { apiClient } from '@/lib/api'

interface Company {
  id: string
  code: string
  name: string
  nameEn: string | null
  countryCode: string
  currency: string
}

interface CompanySelectorProps {
  selectedCompanyId: string
  onCompanyChange: (companyId: string) => void
  className?: string
}

export function CompanySelector({ selectedCompanyId, onCompanyChange, className = '' }: CompanySelectorProps) {
  const [companies, setCompanies] = useState<Company[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    apiClient.get<Company[]>('/api/v1/org/companies').then((res) => {
      if (res.data) setCompanies(res.data)
    })
  }, [])

  const selected = companies.find((c) => c.id === selectedCompanyId)

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-xl border border-[#E8E8E8] bg-white px-3 py-2 text-sm hover:border-[#5E81F4] focus:outline-none focus:ring-2 focus:ring-[#5E81F4]/20"
      >
        <Building2 className="h-4 w-4 text-[#666]" />
        <span className="font-medium text-[#1A1A1A]">
          {selected ? `${selected.code} ${selected.name}` : '법인 선택'}
        </span>
        <ChevronDown className={`h-4 w-4 text-[#666] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-lg border border-[#E8E8E8] bg-white shadow-lg">
            {companies.map((company) => (
              <button
                key={company.id}
                type="button"
                onClick={() => {
                  onCompanyChange(company.id)
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-[#FAFAFA] ${
                  company.id === selectedCompanyId ? 'bg-[#EDF1FE] text-[#4B6DE0]' : 'text-[#333]'
                }`}
              >
                <span className="font-medium">{company.code}</span>
                <span className="text-[#666]">{company.name}</span>
                <span className="ml-auto text-xs text-[#999]">{company.currency}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
