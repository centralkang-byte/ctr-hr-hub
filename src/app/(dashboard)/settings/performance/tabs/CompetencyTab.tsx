'use client'

import { useEffect, useState } from 'react'
import { Loader2, BookOpen, Lock } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { TABLE_STYLES } from '@/lib/styles'

interface Competency { id: string; name: string; nameEn?: string; category: string; description?: string; _count?: { indicators?: number } }
interface Props { companyId: string | null }

export function CompetencyTab({ companyId }: Props) {
  const [items, setItems] = useState<Competency[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    apiClient.get('/api/v1/competencies?limit=50')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((res) => { const list = (res as any)?.data ?? res ?? []; setItems(Array.isArray(list) ? list : []) })
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [companyId])

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#4F46E5]" /></div>

  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-[#1C1D21]">역량 라이브러리</h3>
            <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600"><Lock className="h-3 w-3" />글로벌 고정</span>
          </div>
          <p className="text-sm text-[#8181A5]">핵심가치 역량 {items.length}개</p>
        </div>
      </div>
      {items.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-[#F0F0F3]">
          <table className="w-full"><thead><tr className={TABLE_STYLES.header}>
            <th className={TABLE_STYLES.headerCell}>역량명</th>
            <th className={TABLE_STYLES.headerCell}>영문</th>
            <th className={TABLE_STYLES.headerCell}>카테고리</th>
            <th className={TABLE_STYLES.headerCell}>행동지표</th>
          </tr></thead><tbody className="divide-y divide-[#F0F0F3]">{items.map((c) => (
            <tr key={c.id} className={TABLE_STYLES.row}>
              <td className={TABLE_STYLES.cell}>{c.name}</td>
              <td className={TABLE_STYLES.cellMuted}>{c.nameEn ?? '—'}</td>
              <td className={TABLE_STYLES.cellMuted}>{c.category}</td>
              <td className="px-4 py-3 text-center text-sm text-[#8181A5]">{c._count?.indicators ?? 0}개</td>
            </tr>
          ))}</tbody></table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[#F0F0F3] py-12 text-center">
          <BookOpen className="mx-auto mb-3 h-8 w-8 text-[#8181A5]" /><p className="text-sm font-medium text-[#1C1D21]">등록된 역량이 없습니다</p>
        </div>
      )}
    </div>
  )
}
