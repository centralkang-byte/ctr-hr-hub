'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { TABLE_STYLES } from '@/lib/styles'
import { useTranslations } from 'next-intl'

interface Props { companyId: string | null }

export function JobFamiliesTab({
  companyId }: Props) {
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
        <h3 className="text-base font-semibold text-[#1C1D21]">{t('kr_keca781ec_keca781eb')}</h3>
        <p className="text-sm text-[#8181A5]">{families.length}개 직종, 총 {families.reduce((s, f) => s + f.profiles, 0)}개 Job Profile</p>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-[#5E81F4]/20 bg-[#5E81F4]/5 p-4">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#5E81F4]" />
        <p className="text-xs text-[#8181A5]">{t('kr_keca781ec_keca781eb_kebb684eb_')}</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#F0F0F3]">
        <table className="w-full">
          <thead>
            <tr className={TABLE_STYLES.header}>
              <th className={TABLE_STYLES.headerCell}>{t('kr_kecbd94eb')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('kr_keca781ec_kr')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('kr_keca781ec_en')}</th>
              <th className={TABLE_STYLES.headerCell}>Job Profile</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0F0F3]">
            {families.map((f) => (
              <tr key={f.code} className="hover:bg-[#F5F5FA] transition-colors">
                <td className="px-4 py-3 text-sm font-medium text-[#5E81F4]">{f.code}</td>
                <td className={TABLE_STYLES.cell}>{f.name}</td>
                <td className={TABLE_STYLES.cellMuted}>{f.nameEn}</td>
                <td className="px-4 py-3 text-center text-sm text-[#8181A5]">{f.profiles}개</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
