'use client'

import { useEffect, useState } from 'react'
import { Loader2, Calendar } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { TABLE_STYLES } from '@/lib/styles'

interface Cycle { id: string; name: string; type: string; status: string; startDate: string; endDate: string }
interface Props { companyId: string | null }

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: '임시저장', cls: 'bg-muted/50 text-muted-foreground' },
  GOAL_SETTING: { label: '목표 설정', cls: 'bg-primary/5 text-primary' },
  IN_PROGRESS: { label: '진행 중', cls: 'bg-tertiary-container/10 text-tertiary' },
  SELF_REVIEW: { label: '자기평가', cls: 'bg-yellow-500/10 text-yellow-600' },
  MANAGER_REVIEW: { label: '상세', cls: 'bg-orange-500/10 text-orange-600' },
  CALIBRATION: { label: '캘리브레이션', cls: 'bg-purple-500/10 text-purple-600' },
  COMPLETED: { label: '완료', cls: 'bg-muted/50 text-muted-foreground' },
  CLOSED: { label: '마감', cls: 'bg-muted text-muted-foreground/60' },
}

export function EvalCycleTab({
  companyId }: Props) {
//   const t = useTranslations('settings')
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    apiClient.get('/api/v1/performance/cycles?limit=20')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((res) => { const list = (res as any)?.data ?? res ?? []; setCycles(Array.isArray(list) ? list : []) })
      .catch(() => setCycles([]))
      .finally(() => setLoading(false))
  }, [companyId])

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-foreground">{'평가 주기'}</h3>
        <p className="text-sm text-muted-foreground">등록된 평가 사이클 {cycles.length}건</p>
      </div>
      {cycles.length > 0 ? (
        <div className={TABLE_STYLES.wrapper}>
          <table className={TABLE_STYLES.table}><thead><tr className={TABLE_STYLES.header}>
            <th className={TABLE_STYLES.headerCell}>{'사이클명'}</th>
            <th className={TABLE_STYLES.headerCell}>{'유형'}</th>
            <th className={TABLE_STYLES.headerCell}>{'상태'}</th>
            <th className={TABLE_STYLES.headerCell}>{'기간'}</th>
          </tr></thead><tbody className="divide-y divide-border">{cycles.map((c) => {
            const s = STATUS_MAP[c.status] ?? { label: c.status, cls: 'bg-muted/50 text-muted-foreground' }
            return (
              <tr key={c.id} className={TABLE_STYLES.row}>
                <td className={TABLE_STYLES.cell}>{c.name}</td>
                <td className={TABLE_STYLES.cellMuted}>{c.type}</td>
                <td className="px-4 py-3 text-center"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span></td>
                <td className={TABLE_STYLES.cellMuted}>{c.startDate?.slice(0,10)} ~ {c.endDate?.slice(0,10)}</td>
              </tr>
            )
          })}</tbody></table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <Calendar className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="text-sm font-medium text-foreground">{'등록된 평가 사이클이 없습니다'}</p>
        </div>
      )}
    </div>
  )
}
