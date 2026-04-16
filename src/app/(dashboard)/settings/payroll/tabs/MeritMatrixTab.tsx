'use client'

import { useEffect, useState } from 'react'
import { Loader2, Info } from 'lucide-react'
import { apiClient } from '@/lib/api'
// import { Input } from '@/components/ui/input'
import { TABLE_STYLES } from '@/lib/styles'
import { useTranslations } from 'next-intl'

interface MatrixCell { id?: string; gradeKey: string; comparatioBand: string; minPct: number | null; maxPct: number | null; recommendedPct: number | null }
interface Props { companyId: string | null }

const GRADE_LABELS: Record<string,string> = { O: '탁월', E: '우수', M: '보통', S: '미흡' }
const BAND_LABELS: Record<string,string> = { LOW: '하위', MID: '중위', HIGH: '상위' }

export function MeritMatrixTab({
  companyId }: Props) {
  const t = useTranslations('settings')
  const [matrix, setMatrix] = useState<MatrixCell[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = companyId ? `?companyId=${companyId}` : ''
    apiClient.get(`/api/v1/settings/performance/merit-matrix${params}`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((res) => { const d = (res as any)?.data ?? res; setMatrix(d?.matrix ?? []) })
      .catch(() => setMatrix([]))
      .finally(() => setLoading(false))
  }, [companyId])

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>

  const grades = ['O', 'E', 'M', 'S']
  const bands = ['LOW', 'MID', 'HIGH']
  const getCell = (g: string, b: string) => matrix.find((c) => c.gradeKey === g && c.comparatioBand === b)

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-foreground">{t('kr_kec9db8ec_keba7a4ed')}</h3>
        <p className="text-sm text-muted-foreground">{t('kr_keb93b1ea_kebb0b4eb_keab8b0eb_')}</p>
      </div>
      {matrix.length > 0 ? (
        <div className={TABLE_STYLES.wrapper}>
          <table className={TABLE_STYLES.table}>
            <thead className={TABLE_STYLES.header}><tr>
              <th className={TABLE_STYLES.headerCell}>{t('kr_keb93b1ea')}</th>
              {bands.map((b) => <th key={b} className={`${TABLE_STYLES.headerCell} text-center`}>{BAND_LABELS[b]} ({b})</th>)}
            </tr></thead>
            <tbody>{grades.map((g) => (
              <tr key={g} className={TABLE_STYLES.row}>
                <td className={TABLE_STYLES.cell}>{GRADE_LABELS[g]} ({g})</td>
                {bands.map((b) => { const c = getCell(g, b); return (
                  <td key={b} className={`${TABLE_STYLES.cell} text-center`}>
                    <div className="flex items-center justify-center gap-1 text-sm">
                      <span className="text-muted-foreground">{c?.minPct ?? '—'}</span>
                      <span className="text-muted-foreground">~</span>
                      <span className="font-semibold text-primary">{c?.recommendedPct ?? '—'}</span>
                      <span className="text-muted-foreground">~</span>
                      <span className="text-muted-foreground">{c?.maxPct ?? '—'}</span>
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                  </td>
                )})}
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <Info className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="text-sm font-medium text-foreground">{t('kr_kec9db8ec_keba7a4ed_kec84a4ec_')}</p>
        </div>
      )}
    </div>
  )
}
