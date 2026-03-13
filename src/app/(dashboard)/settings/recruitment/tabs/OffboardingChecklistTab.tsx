'use client'

import { useEffect, useState } from 'react'
import { Loader2, Plus, ClipboardCheck } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { BUTTON_VARIANTS,  TABLE_STYLES } from '@/lib/styles'

interface Checklist { id: string; name: string; targetType: string; isActive: boolean; _count?: { offboardingTasks?: number } }
interface Props { companyId: string | null }

export function OffboardingChecklistTab({ companyId }: Props) {
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = companyId ? `?companyId=${companyId}&limit=50` : '?limit=50'
    apiClient.get(`/api/v1/offboarding/checklists${params}`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((res) => { const list = (res as any)?.data ?? res ?? []; setChecklists(Array.isArray(list) ? list : []) })
      .catch(() => setChecklists([]))
      .finally(() => setLoading(false))
  }, [companyId])

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#4F46E5]" /></div>

  const typeLabels: Record<string,string> = { VOLUNTARY: '자발적 퇴직', INVOLUNTARY: '비자발적', RETIREMENT: '정년퇴직', CONTRACT_END: '계약만료' }

  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <div><h3 className="text-base font-semibold text-[#1C1D21]">오프보딩 체크리스트</h3><p className="text-sm text-[#8181A5]">{checklists.length}개 체크리스트</p></div>
        <Button className={BUTTON_VARIANTS.primary}><Plus className="mr-2 h-4 w-4" />체크리스트 추가</Button>
      </div>
      {checklists.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-[#F0F0F3]">
          <table className="w-full"><thead><tr className={TABLE_STYLES.header}>
            <th className={TABLE_STYLES.headerCell}>체크리스트명</th>
            <th className={TABLE_STYLES.headerCell}>대상 유형</th>
            <th className={TABLE_STYLES.headerCell}>태스크 수</th>
            <th className={TABLE_STYLES.headerCell}>상태</th>
          </tr></thead><tbody className="divide-y divide-[#F0F0F3]">{checklists.map((c) => (
            <tr key={c.id} className={TABLE_STYLES.row}>
              <td className={TABLE_STYLES.cell}>{c.name}</td>
              <td className={TABLE_STYLES.cellMuted}>{typeLabels[c.targetType] ?? c.targetType}</td>
              <td className="px-4 py-3 text-center text-sm text-[#8181A5]">{c._count?.offboardingTasks ?? 0}</td>
              <td className="px-4 py-3 text-center"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.isActive ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-400'}`}>{c.isActive ? '활성' : '비활성'}</span></td>
            </tr>
          ))}</tbody></table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[#F0F0F3] py-12 text-center">
          <ClipboardCheck className="mx-auto mb-3 h-8 w-8 text-[#8181A5]" /><p className="text-sm font-medium text-[#1C1D21]">등록된 체크리스트가 없습니다</p>
        </div>
      )}
    </div>
  )
}
