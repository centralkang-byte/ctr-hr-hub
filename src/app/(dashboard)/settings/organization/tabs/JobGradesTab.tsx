'use client'

import { useState } from 'react'
import { Save, AlertTriangle } from 'lucide-react'
import { SettingFieldWithOverride } from '@/components/settings/SettingFieldWithOverride'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { TABLE_STYLES } from '@/lib/styles'
import { useTranslations } from 'next-intl'

interface Props { companyId: string | null }

export function JobGradesTab({
  companyId }: Props) {
  const t = useTranslations('settings')
  const [grades] = useState([
    { code: 'S1', name: t('kr_kec82acec'), nameEn: 'Staff', minYears: 0, promoYears: 3 },
    { code: 'S2', name: t('kr_keca3bcec'), nameEn: 'Senior Staff', minYears: 3, promoYears: 3 },
    { code: 'S3', name: t('kr_keb8c80eb'), nameEn: 'Assistant Manager', minYears: 4, promoYears: 4 },
    { code: 'M1', name: t('kr_keab3bcec'), nameEn: 'Manager', minYears: 4, promoYears: 5 },
    { code: 'M2', name: t('kr_kecb0a8ec'), nameEn: 'Deputy GM', minYears: 5, promoYears: 5 },
    { code: 'D1', name: t('kr_kebb680ec'), nameEn: 'General Manager', minYears: 5, promoYears: null },
    { code: 'D2', name: t('kr_kec9db4ec'), nameEn: 'Director', minYears: 5, promoYears: null },
    { code: 'E1', name: t('kr_kec8381eb'), nameEn: 'Senior Director', minYears: null, promoYears: null },
    { code: 'E2', name: t('kr_keca084eb'), nameEn: 'EVP', minYears: null, promoYears: null },
    { code: 'C1', name: t('kr_keb8c80ed'), nameEn: 'CEO', minYears: null, promoYears: null },
  ])

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-[#1C1D21]">{t('grade_kecb2b4ea')}</h3>
        <p className="text-sm text-[#8181A5]">{grades.length}개 직급 등록</p>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-[#5E81F4]/20 bg-[#5E81F4]/5 p-4">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#5E81F4]" />
        <p className="text-xs text-[#8181A5]">{t('grade_kecb2b4ea_ked9884ec_kec8b9cec_keab480eb_api_kec97b0ea_ked9b84_ked8eb8ec_keab080eb')}</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#F0F0F3]">
        <table className="w-full">
          <thead>
            <tr className={TABLE_STYLES.header}>
              <th className={TABLE_STYLES.headerCell}>{t('kr_kecbd94eb')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('grade_persons')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('kr_kec9881eb')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('kr_kecb59cec_kec97b0ec')}</th>
              <th className={TABLE_STYLES.headerCell}>{t('kr_kec8ab9ec_kec868cec')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0F0F3]">
            {grades.map((g) => (
              <tr key={g.code} className="hover:bg-[#F5F5FA] transition-colors">
                <td className="px-4 py-3 text-sm font-medium text-[#5E81F4]">{g.code}</td>
                <td className={TABLE_STYLES.cell}>{g.name}</td>
                <td className={TABLE_STYLES.cellMuted}>{g.nameEn}</td>
                <td className="px-4 py-3 text-center text-sm text-[#8181A5]">{g.minYears != null ? `${g.minYears}년` : '—'}</td>
                <td className="px-4 py-3 text-center text-sm text-[#8181A5]">{g.promoYears != null ? `${g.promoYears}년` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
