'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { TABLE_STYLES } from '@/lib/styles'
import { useTranslations } from 'next-intl'

interface Props { companyId: string | null }

export function JobFamiliesTab({
  companyId: _companyId }: Props) {
  const t = useTranslations('settings')
  const [families] = useState([
    { code: 'MGT', name: t('kr_keab2bdec'), nameEn: 'Management', profiles: 4 },
    { code: 'HR', name: t('kr_kec9db8ec'), nameEn: 'HR', profiles: 6 },
    { code: 'FIN', name: t('kr_kec9eaceb_ked9a8cea'), nameEn: 'Finance', profiles: 5 },
    { code: 'IT', name: t('kr_it_keab09ceb'), nameEn: 'IT', profiles: 8 },
    { code: 'MFG', name: t('kr_kec839dec_keca09cec'), nameEn: 'Manufacturing', profiles: 7 },
    { code: 'RND', name: 'R&D', nameEn: 'R&D', profiles: 5 },
    { code: 'SAL', name: t('kr_kec9881ec'), nameEn: 'Sales', profiles: 4 },
    { code: 'MKT', name: t('kr_keba788ec'), nameEn: 'Marketing', profiles: 3 },
  ])

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-foreground">{t('kr_keca781ec_keca781eb')}</h3>
        <p className="text-sm text-muted-foreground">{families.length}개 직종, 총 {families.reduce((s, f) => s + f.profiles, 0)}개 Job Profile</p>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-xs text-muted-foreground">{t('kr_keca781ec_keca781eb_kebb684eb_')}</p>
      </div>

      <div className={TABLE_STYLES.wrapper}>
        <table className={TABLE_STYLES.table}>
          <thead className={TABLE_STYLES.header}>
            <tr>
              <th className={TABLE_STYLES.headerCell}>{t('kr_kecbd94eb')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('kr_keca781ec_kr')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('kr_keca781ec_en')}</th>
              <th className={TABLE_STYLES.headerCell}>Job Profile</th>
            </tr>
          </thead>
          <tbody>
            {families.map((f) => (
              <tr key={f.code} className={TABLE_STYLES.row}>
                <td className={`${TABLE_STYLES.cell} font-medium text-primary`}>{f.code}</td>
                <td className={TABLE_STYLES.cell}>{f.name}</td>
                <td className={`${TABLE_STYLES.cell} text-muted-foreground`}>{f.nameEn}</td>
                <td className={`${TABLE_STYLES.cell} text-center text-muted-foreground`}>{f.profiles}개</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
