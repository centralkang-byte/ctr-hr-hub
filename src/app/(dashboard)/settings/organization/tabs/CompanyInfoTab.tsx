'use client'

import { useEffect, useState } from 'react'
import { Loader2, Save, Building2 } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { SettingFieldWithOverride } from '@/components/settings/SettingFieldWithOverride'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { TABLE_STYLES } from '@/lib/styles'

interface Company {
  id: string
  code: string
  name: string
  country: string
  currency: string
  timezone?: string
  locale?: string
}

interface Props { companyId: string | null }

export function CompanyInfoTab({ companyId }: Props) {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    apiClient.get('/api/v1/companies')
      .then((res) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const list = (res as any)?.data ?? res ?? []
        setCompanies(Array.isArray(list) ? list : [])
      })
      .catch(() => setCompanies([]))
      .finally(() => setLoading(false))
  }, [companyId])

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#5E81F4]" /></div>

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-[#1C1D21]">법인 기본정보</h3>
        <p className="text-sm text-[#8181A5]">등록된 법인 {companies.length}개</p>
      </div>

      {companies.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-[#F0F0F3]">
          <table className="w-full">
            <thead>
              <tr className={TABLE_STYLES.header}>
                <th className={TABLE_STYLES.headerCell}>코드</th>
                <th className={TABLE_STYLES.headerCell}>법인명</th>
                <th className={TABLE_STYLES.headerCell}>국가</th>
                <th className={TABLE_STYLES.headerCell}>통화</th>
                <th className={TABLE_STYLES.headerCell}>타임존</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0F3]">
              {companies.map((c) => (
                <tr key={c.id} className="hover:bg-[#F5F5FA] transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-[#5E81F4]">{c.code}</td>
                  <td className={TABLE_STYLES.cell}>{c.name}</td>
                  <td className={TABLE_STYLES.cell}>{c.country}</td>
                  <td className={TABLE_STYLES.cellMuted}>{c.currency}</td>
                  <td className={TABLE_STYLES.cellMuted}>{c.timezone ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[#F0F0F3] py-12 text-center">
          <Building2 className="mx-auto mb-3 h-8 w-8 text-[#8181A5]" />
          <p className="text-sm font-medium text-[#1C1D21]">등록된 법인이 없습니다</p>
        </div>
      )}
    </div>
  )
}
