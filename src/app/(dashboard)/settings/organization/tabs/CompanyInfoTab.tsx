'use client'

import { useEffect, useState } from 'react'
import { Loader2, Building2 } from 'lucide-react'
import { apiClient } from '@/lib/api'
// import { SettingFieldWithOverride } from '@/components/settings/SettingFieldWithOverride'
// import { Input } from '@/components/ui/input'
// import { Button } from '@/components/ui/button'
import { TABLE_STYLES } from '@/lib/styles'
import { useTranslations } from 'next-intl'

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

export function CompanyInfoTab({
  companyId }: Props) {
  const t = useTranslations('settings')
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

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-foreground">{t('company_keab8b0eb')}</h3>
        <p className="text-sm text-muted-foreground">{t('companyInfo.subtitle', { count: companies.length })}</p>
      </div>

      {companies.length > 0 ? (
        <div className={TABLE_STYLES.wrapper}>
          <table className={TABLE_STYLES.table}>
            <thead className={TABLE_STYLES.header}>
              <tr>
                <th className={TABLE_STYLES.headerCell}>{t('kr_kecbd94eb')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('company_persons')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('kr_keab5adea')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('kr_ked86b5ed')}</th>
                <th className={TABLE_STYLES.headerCell}>{t('kr_ked8380ec')}</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id} className={TABLE_STYLES.row}>
                  <td className={`${TABLE_STYLES.cell} font-medium text-primary`}>{c.code}</td>
                  <td className={TABLE_STYLES.cell}>{c.name}</td>
                  <td className={TABLE_STYLES.cell}>{c.country}</td>
                  <td className={`${TABLE_STYLES.cell} text-muted-foreground`}>{c.currency}</td>
                  <td className={`${TABLE_STYLES.cell} text-muted-foreground`}>{c.timezone ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <Building2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">{t('register_keb909c_kebb295ec_kec9786ec')}</p>
        </div>
      )}
    </div>
  )
}
