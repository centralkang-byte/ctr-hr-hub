'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'

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

      <div className="flex items-start gap-3 rounded-lg border border-[#5E81F4]/20 bg-[#5E81F4]/5 p-4">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#5E81F4]" />
        <p className="text-xs text-[#8181A5]">직종/직무 분류는 현재 시스템에서 관리됩니다. API 연결 후 편집이 가능합니다.</p>
      </div>

      <div className="overflow-hidden rounded-lg border border-[#F0F0F3]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#F0F0F3] bg-[#F5F5FA]">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#8181A5]">코드</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#8181A5]">직종명 (KR)</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#8181A5]">직종명 (EN)</th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-[#8181A5]">Job Profile</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0F0F3]">
            {families.map((f) => (
              <tr key={f.code} className="hover:bg-[#F5F5FA] transition-colors">
                <td className="px-4 py-3 text-sm font-medium text-[#5E81F4]">{f.code}</td>
                <td className="px-4 py-3 text-sm font-medium text-[#1C1D21]">{f.name}</td>
                <td className="px-4 py-3 text-sm text-[#8181A5]">{f.nameEn}</td>
                <td className="px-4 py-3 text-center text-sm text-[#8181A5]">{f.profiles}개</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
