'use client'

import { useEffect, useState } from 'react'
import { Loader2, Plus, Bell } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { Button } from '@/components/ui/button'

interface Trigger { id: string; eventType: string; name: string; channels: string[]; isActive: boolean; targetRole?: string }
interface Props { companyId: string | null }

export function NotificationRulesTab({ companyId }: Props) {
  const [triggers, setTriggers] = useState<Trigger[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    apiClient.get('/api/v1/settings/notification-triggers?limit=100')
      .then((res) => { const list = (res as any)?.data ?? res ?? []; setTriggers(Array.isArray(list) ? list : []) })
      .catch(() => setTriggers([]))
      .finally(() => setLoading(false))
  }, [companyId])

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#5E81F4]" /></div>

  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <div><h3 className="text-base font-semibold text-[#1C1D21]">알림 규칙</h3><p className="text-sm text-[#8181A5]">이벤트별 알림 대상 및 채널 ({triggers.length}건)</p></div>
        <Button className="bg-[#5E81F4] text-white hover:bg-[#4A6FE0]"><Plus className="mr-2 h-4 w-4" />규칙 추가</Button>
      </div>
      {triggers.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-[#F0F0F3]">
          <table className="w-full"><thead><tr className="border-b border-[#F0F0F3] bg-[#F5F5FA]">
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#8181A5]">이벤트</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#8181A5]">이름</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#8181A5]">채널</th>
            <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-[#8181A5]">상태</th>
          </tr></thead><tbody className="divide-y divide-[#F0F0F3]">{triggers.map((t) => (
            <tr key={t.id} className="hover:bg-[#F5F5FA]">
              <td className="px-4 py-3 text-sm font-medium text-[#5E81F4]">{t.eventType}</td>
              <td className="px-4 py-3 text-sm text-[#1C1D21]">{t.name}</td>
              <td className="px-4 py-3"><div className="flex gap-1">{(t.channels ?? []).map((ch) => (
                <span key={ch} className="rounded bg-[#F5F5FA] px-2 py-0.5 text-xs text-[#8181A5]">{ch}</span>
              ))}</div></td>
              <td className="px-4 py-3 text-center"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${t.isActive ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-400'}`}>{t.isActive ? '활성' : '비활성'}</span></td>
            </tr>
          ))}</tbody></table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-[#F0F0F3] py-12 text-center">
          <Bell className="mx-auto mb-3 h-8 w-8 text-[#8181A5]" /><p className="text-sm font-medium text-[#1C1D21]">등록된 알림 규칙이 없습니다</p>
        </div>
      )}
    </div>
  )
}
