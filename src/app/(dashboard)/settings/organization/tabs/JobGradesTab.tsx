'use client'

import { useState } from 'react'
import { Save, AlertTriangle } from 'lucide-react'
import { SettingFieldWithOverride } from '@/components/settings/SettingFieldWithOverride'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { TABLE_STYLES } from '@/lib/styles'

interface Props { companyId: string | null }

export function JobGradesTab({ companyId }: Props) {
  const [grades] = useState([
    { code: 'S1', name: '사원', nameEn: 'Staff', minYears: 0, promoYears: 3 },
    { code: 'S2', name: '주임', nameEn: 'Senior Staff', minYears: 3, promoYears: 3 },
    { code: 'S3', name: '대리', nameEn: 'Assistant Manager', minYears: 4, promoYears: 4 },
    { code: 'M1', name: '과장', nameEn: 'Manager', minYears: 4, promoYears: 5 },
    { code: 'M2', name: '차장', nameEn: 'Deputy GM', minYears: 5, promoYears: 5 },
    { code: 'D1', name: '부장', nameEn: 'General Manager', minYears: 5, promoYears: null },
    { code: 'D2', name: '이사', nameEn: 'Director', minYears: 5, promoYears: null },
    { code: 'E1', name: '상무', nameEn: 'Senior Director', minYears: null, promoYears: null },
    { code: 'E2', name: '전무', nameEn: 'EVP', minYears: null, promoYears: null },
    { code: 'C1', name: '대표이사', nameEn: 'CEO', minYears: null, promoYears: null },
  ])

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-[#1C1D21]">직급 체계</h3>
        <p className="text-sm text-[#8181A5]">{grades.length}개 직급 등록</p>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-[#5E81F4]/20 bg-[#5E81F4]/5 p-4">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#5E81F4]" />
        <p className="text-xs text-[#8181A5]">직급 체계는 현재 시스템에서 관리됩니다. API 연결 후 편집이 가능합니다.</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#F0F0F3]">
        <table className="w-full">
          <thead>
            <tr className={TABLE_STYLES.header}>
              <th className={TABLE_STYLES.headerCell}>코드</th>
              <th className={TABLE_STYLES.headerCell}>직급명</th>
              <th className={TABLE_STYLES.headerCell}>영문명</th>
              <th className={TABLE_STYLES.headerCell}>최소 연차</th>
              <th className={TABLE_STYLES.headerCell}>승진 소요</th>
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
