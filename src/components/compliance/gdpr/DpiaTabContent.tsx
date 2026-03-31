'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Pencil, Eye } from 'lucide-react'
import DpiaForm from './DpiaForm'
import { BUTTON_VARIANTS, TABLE_STYLES } from '@/lib/styles'

interface Dpia {
  id: string
  title: string
  description: string
  processing_scope: string
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  mitigations: string
  status: string
  created_at: string
  updated_at: string
}

function RiskBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    low: 'bg-emerald-500/15 text-emerald-700 border border-emerald-200',
    medium: 'bg-amber-500/15 text-amber-700 border border-amber-300',
    high: 'bg-orange-500/10 text-orange-700 border border-orange-200',
    critical: 'bg-destructive/10 text-destructive border border-destructive/20',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${map[level] ?? map.medium}`}>
      {level}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: 'bg-background text-muted-foreground border border-border',
    in_review: 'bg-amber-500/15 text-amber-700 border border-amber-300',
    approved: 'bg-emerald-500/15 text-emerald-700 border border-emerald-200',
    rejected: 'bg-destructive/10 text-destructive border border-destructive/20',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status] ?? map.draft}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

export default function DpiaTabContent() {
  const t = useTranslations('compliance')
  const tc = useTranslations('common')

  const [dpias, setDpias] = useState<Dpia[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<Dpia | null>(null)

  const fetchDpias = () => {
    setLoading(true)
    fetch('/api/v1/compliance/gdpr/dpia?page=1&limit=20')
      .then((res) => res.json())
      .then((json) => {
        setDpias(json.data ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchDpias()
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{t('gdpr.dpia')}</h2>
        <button
          onClick={() => { setSelected(null); setShowForm(true) }}
          className={`inline-flex items-center gap-2 ${BUTTON_VARIANTS.primary} px-4 py-2 rounded-lg font-medium text-sm`}
        >
          <Plus className="w-4 h-4" />
          {tc('create')}
        </button>
      </div>

      <div className={TABLE_STYLES.wrapper}>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">{tc('loading')}</div>
        ) : dpias.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">{tc('noData')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className={TABLE_STYLES.table}>
              <thead>
                <tr className={TABLE_STYLES.header}>
                  <th className={TABLE_STYLES.headerCell}>Title</th>
                  <th className={TABLE_STYLES.headerCell}>{t('gdpr.riskLevel')}</th>
                  <th className={TABLE_STYLES.headerCell}>{tc('status')}</th>
                  <th className={TABLE_STYLES.headerCell}>{tc('updatedAt')}</th>
                  <th className={TABLE_STYLES.headerCell}>{tc('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {dpias.map((d) => (
                  <tr key={d.id} className={TABLE_STYLES.row}>
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium text-foreground">{d.title}</div>
                      {d.description && (
                        <div className="text-xs text-muted-foreground mt-0.5 max-w-[280px] truncate">{d.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <RiskBadge level={d.risk_level} />
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <StatusBadge status={d.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(d.updated_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setSelected(d); setShowForm(true) }}
                          className="text-muted-foreground hover:text-primary"
                          title={d.status === 'draft' || d.status === 'in_review' ? tc('edit') : tc('view')}
                        >
                          {d.status === 'draft' || d.status === 'in_review' ? (
                            <Pencil className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <DpiaForm
          open={showForm}
          dpia={selected}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchDpias() }}
        />
      )}
    </div>
  )
}
