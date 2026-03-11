'use client'

import { useEffect, useState } from 'react'
import { Loader2, Plus, Settings2 } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { Button } from '@/components/ui/button'

interface CustomField { id: string; entityType: string; fieldKey: string; fieldLabel: string; fieldType: string; isRequired: boolean; isSearchable: boolean; sortOrder: number }
interface Props { companyId: string | null }

export function CustomFieldsTab({ companyId }: Props) {
  const [fields, setFields] = useState<CustomField[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    apiClient.get('/api/v1/settings/custom-fields?limit=100')
      .then((res) => { const list = (res as any)?.data ?? res ?? []; setFields(Array.isArray(list) ? list : []) })
      .catch(() => setFields([]))
      .finally(() => setLoading(false))
  }, [companyId])

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#5E81F4]" /></div>

  const grouped = fields.reduce<Record<string, CustomField[]>>((acc, f) => { (acc[f.entityType] ??= []).push(f); return acc }, {})

  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <div><h3 className="text-base font-semibold text-[#1C1D21]">커스텀 필드</h3><p className="text-sm text-[#8181A5]">사용자 정의 필드 {fields.length}개</p></div>
        <Button className="bg-[#5E81F4] text-white hover:bg-[#4A6FE0]"><Plus className="mr-2 h-4 w-4" />필드 추가</Button>
      </div>
      {fields.length > 0 ? Object.entries(grouped).map(([entity, items]) => (
        <div key={entity}>
          <h4 className="mb-2 text-sm font-semibold text-[#8181A5]">{entity}</h4>
          <div className="overflow-hidden rounded-lg border border-[#F0F0F3]">
            <table className="w-full">
              <thead><tr className="border-b border-[#F0F0F3] bg-[#F5F5FA]">
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-[#8181A5]">필드 키</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-[#8181A5]">라벨</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-[#8181A5]">타입</th>
                <th className="px-4 py-2 text-center text-xs font-medium uppercase text-[#8181A5]">필수</th>
                <th className="px-4 py-2 text-center text-xs font-medium uppercase text-[#8181A5]">검색</th>
              </tr></thead>
              <tbody className="divide-y divide-[#F0F0F3]">{items.map((f) => (
                <tr key={f.id} className="hover:bg-[#F5F5FA]">
                  <td className="px-4 py-2 text-sm font-medium text-[#5E81F4]">{f.fieldKey}</td>
                  <td className="px-4 py-2 text-sm text-[#1C1D21]">{f.fieldLabel}</td>
                  <td className="px-4 py-2 text-sm text-[#8181A5]">{f.fieldType}</td>
                  <td className="px-4 py-2 text-center text-sm">{f.isRequired ? '✓' : '—'}</td>
                  <td className="px-4 py-2 text-center text-sm">{f.isSearchable ? '✓' : '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )) : (
        <div className="rounded-lg border border-dashed border-[#F0F0F3] py-12 text-center">
          <Settings2 className="mx-auto mb-3 h-8 w-8 text-[#8181A5]" /><p className="text-sm font-medium text-[#1C1D21]">등록된 커스텀 필드가 없습니다</p>
        </div>
      )}
    </div>
  )
}
