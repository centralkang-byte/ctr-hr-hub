'use client'

import { useEffect, useState } from 'react'
import { Loader2, Info } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { useTranslations } from 'next-intl'

interface Grade { key: string; labelKo: string; labelEn: string; guidePct: number; description: string }
interface Props { companyId: string | null }

export function GradeScaleTab({
  companyId }: Props) {
  const t = useTranslations('settings')
  const [grades, setGrades] = useState<Grade[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = companyId ? `?companyId=${companyId}` : ''
    apiClient.get(`/api/v1/settings/performance/grade-scale${params}`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((res) => { const d = (res as any)?.data ?? res; setGrades(d?.grades ?? []) })
      .catch(() => setGrades([]))
      .finally(() => setLoading(false))
  }, [companyId])

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-foreground">{t('kr_keb93b1ea_kecb2b4ea')}</h3>
        <p className="text-sm text-muted-foreground">{t('gradeScale.subtitle', { count: grades.length })}</p>
      </div>
      {grades.length > 0 ? (
        <div className="space-y-3">
          {grades.map((g) => (
            <div key={g.key} className="flex items-center gap-4 rounded-xl border border-border p-4 hover:bg-muted transition-colors">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">{g.key}</div>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-foreground">{g.labelKo}</span>
                  <span className="text-xs text-muted-foreground">{g.labelEn}</span>
                </div>
                <p className="text-xs text-muted-foreground">{g.description}</p>
              </div>
              <div className="text-right">
                <span className="text-lg font-bold text-primary">{g.guidePct}%</span>
                <p className="text-xs text-muted-foreground">{t('kr_kebb0b0eb_keab080ec')}</p>
              </div>
            </div>
          ))}
          <div className="mt-2 text-right text-sm text-muted-foreground">{t('distribution.total', { pct: grades.reduce((s, g) => s + g.guidePct, 0) })}</div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <Info className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="text-sm font-medium text-foreground">{t('kr_keb93b1ea_kecb2b4ea_kec84a4ec_')}</p>
        </div>
      )}
    </div>
  )
}
