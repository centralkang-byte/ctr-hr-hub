'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { TABLE_STYLES } from '@/lib/styles'

interface Props { companyId: string | null }

export function JobFamiliesTab({ companyId }: Props) {
  const [families] = useState([
    { code: 'MGT', name: '경영관리', nameEn: 'Management', profiles: 4 },
    { code: 'HR', name: '인사', nameEn: 'HR', profiles: 6 },
    { code: 'FIN', name: '재무/회계', nameEn: 'Finance', profiles: 5 },
    { code: 'IT', name: 'IT/개발', nameEn: 'IT', profiles: 8 },
    { code: 'MFG', name: '생산/제조', nameEn: 'Manufacturing', profiles: 7 },
    { code: 'RND', name: 'R&D', nameEn: 'R&D', profiles: 5 },
    { code: 'SAL', name: '영업', nameEn: 'Sales', profiles: 4 },
    { code: 'MKT', name: '마케팅', nameEn: 'Marketing', profiles: 3 },
  ])

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-[#1C1D21]">직종/직무</h3>
        <p className="text-sm text-[#8181A5]">{families.length}개 직종, 총 {families.reduce((s, f) => s + f.profiles, 0)}개 Job Profile</p>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-[#4F46E5]/20 bg-[#4F46E5]/5 p-4">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#4F46E5]" />
        <p className="text-xs text-[#8181A5]">직종/직무 분류는 현재 시스템에서 관리됩니다. API 연결 후 편집이 가능합니다.</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#F0F0F3]">
        <table className="w-full">
          <thead>
            <tr className={TABLE_STYLES.header}>
              <th className={TABLE_STYLES.headerCell}>코드</th>
              <th className={TABLE_STYLES.headerCell}>직종명 (KR)</th>
              <th className={TABLE_STYLES.headerCell}>직종명 (EN)</th>
              <th className={TABLE_STYLES.headerCell}>Job Profile</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0F0F3]">
            {families.map((f) => (
              <tr key={f.code} className="hover:bg-[#F5F5FA] transition-colors">
                <td className="px-4 py-3 text-sm font-medium text-[#4F46E5]">{f.code}</td>
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
