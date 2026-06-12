'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Calendar } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { TABLE_STYLES } from '@/lib/styles'
import { StatusBadge } from '@/components/ui/StatusBadge'

interface Cycle { id: string; name: string; type: string; status: string; startDate: string; endDate: string }
interface Props { companyId: string | null }

// CycleStatus enum (prisma schema, 9-state) 라벨 — exhaustive. 색은 StatusBadge(status.ts SSOT)가 담당.
// 미지 상태는 raw enum 노출 대신 '기타'(neutral)로 폴백.
const STATUS_LABELS: Record<string, string> = {
  DRAFT: '개시',
  ACTIVE: '목표 설정',
  EVAL_OPEN: '평가 실시',
  CALIBRATION: '캘리브레이션',
  CLOSED: '종료',
  CHECK_IN: '중간 체크인',
  FINALIZED: '결과 통보 대기',
  COMP_REVIEW: '보상 기획',
  COMP_COMPLETED: '보상 완료',
}

export function EvalCycleTab({
  companyId }: Props) {
  const t = useTranslations('settings')
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
        <h3 className="text-base font-semibold text-foreground">{t('evalCycle.title')}</h3>
        <p className="text-sm text-muted-foreground">{t('evalCycle.subtitle', { count: cycles.length })}</p>
      </div>
      {cycles.length > 0 ? (
        <div className={TABLE_STYLES.wrapper}>
          <table className={TABLE_STYLES.table}><thead><tr className={TABLE_STYLES.header}>
            <th className={TABLE_STYLES.headerCell}>{t('evalCycle.colName')}</th>
            <th className={TABLE_STYLES.headerCell}>{t('evalCycle.colType')}</th>
            <th className={TABLE_STYLES.headerCell}>{t('evalCycle.colStatus')}</th>
            <th className={TABLE_STYLES.headerCell}>{t('evalCycle.colPeriod')}</th>
          </tr></thead><tbody className="divide-y divide-border">{cycles.map((c) => {
            const statusLabel = STATUS_LABELS[c.status] ?? '기타'
            return (
              <tr key={c.id} className={TABLE_STYLES.row}>
                <td className={TABLE_STYLES.cell}>{c.name}</td>
                <td className={TABLE_STYLES.cellMuted}>{c.type}</td>
                <td className="px-4 py-3 text-center"><StatusBadge status={c.status}>{statusLabel}</StatusBadge></td>
                <td className={TABLE_STYLES.cellMuted}>{c.startDate?.slice(0,10)} ~ {c.endDate?.slice(0,10)}</td>
              </tr>
            )
          })}</tbody></table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <Calendar className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="text-sm font-medium text-foreground">{t('evalCycle.emptyState')}</p>
        </div>
      )}
    </div>
  )
}
