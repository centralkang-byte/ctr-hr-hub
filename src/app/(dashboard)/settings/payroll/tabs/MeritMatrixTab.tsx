'use client'

import { useEffect, useState } from 'react'
import { Loader2, Info } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { TABLE_STYLES } from '@/lib/styles'
import { useTranslations } from 'next-intl'

interface MatrixCell { id?: string; gradeKey: string; comparatioBand: string; minPct: number | null; maxPct: number | null; recommendedPct: number | null }
interface Props { companyId: string | null }

const GRADE_LABELS: Record<string,string> = { E: '탁월', M_PLUS: '우수', M: '보통', B: '미흡' }
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

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#5E81F4]" /></div>

  const grades = ['E', 'M_PLUS', 'M', 'B']
  const bands = ['LOW', 'MID', 'HIGH']
  const getCell = (g: string, b: string) => matrix.find((c) => c.gradeKey === g && c.comparatioBand === b)

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-[#1C1D21]">{t('kr_kec9db8ec_keba7a4ed')}</h3>
        <p className="text-sm text-[#8181A5]">{t('kr_keb93b1ea_kebb0b4eb_keab8b0eb_')}</p>
      </div>
      {matrix.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-[#F0F0F3]">
          <table className="w-full">
            <thead><tr className={TABLE_STYLES.header}>
              <th className={TABLE_STYLES.headerCell}>{t('kr_keb93b1ea')}</th>
              {bands.map((b) => <th key={b} className="px-4 py-3 text-center text-xs font-medium uppercase text-[#8181A5]">{BAND_LABELS[b]} ({b})</th>)}
            </tr></thead>
            <tbody className="divide-y divide-[#F0F0F3]">{grades.map((g) => (
              <tr key={g} className={TABLE_STYLES.row}>
                <td className={TABLE_STYLES.cell}>{GRADE_LABELS[g]} ({g})</td>
                {bands.map((b) => { const c = getCell(g, b); return (
                  <td key={b} className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1 text-sm">
                      <span className="text-[#8181A5]">{c?.minPct ?? '—'}</span>
                      <span className="text-[#8181A5]">~</span>
                      <span className="font-semibold text-[#5E81F4]">{c?.recommendedPct ?? '—'}</span>
                      <span className="text-[#8181A5]">~</span>
                      <span className="text-[#8181A5]">{c?.maxPct ?? '—'}</span>
                      <span className="text-xs text-[#8181A5]">%</span>
                    </div>
                  </td>
                )})}
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[#F0F0F3] py-12 text-center">
          <Info className="mx-auto mb-3 h-8 w-8 text-[#8181A5]" /><p className="text-sm font-medium text-[#1C1D21]">{t('kr_kec9db8ec_keba7a4ed_kec84a4ec_')}</p>
        </div>
      )}
    </div>
  )
}
