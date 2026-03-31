'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Pencil, Play, Trash2 } from 'lucide-react'
import RetentionPolicyForm from './RetentionPolicyForm'
import { BUTTON_VARIANTS, TABLE_STYLES } from '@/lib/styles'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'

interface RetentionPolicy {
  id: string
  category: string
  retention_months: number
  description: string
  auto_delete: boolean
  anonymize: boolean
  last_run_at: string | null
}

export default function DataRetentionTabContent() {
  const t = useTranslations('compliance')
  const tc = useTranslations('common')

  const [policies, setPolicies] = useState<RetentionPolicy[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<RetentionPolicy | null>(null)
  const { confirm, dialogProps } = useConfirmDialog()

  const fetchPolicies = () => {
    setLoading(true)
    fetch('/api/v1/compliance/gdpr/retention-policies?page=1&limit=50')
      .then((res) => res.json())
      .then((json) => {
        setPolicies(json.data ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchPolicies()
  }, [])

  const handleRunPolicy = (id: string) => {
    confirm({ title: tc('confirmAction'), onConfirm: async () => {
      await fetch(`/api/v1/compliance/gdpr/retention-policies/${id}/run`, { method: 'POST' })
      fetchPolicies()
    }})
  }

  const handleDelete = (id: string) => {
    confirm({ title: tc('confirmDelete'), onConfirm: async () => {
      await fetch(`/api/v1/compliance/gdpr/retention-policies/${id}`, { method: 'DELETE' })
      fetchPolicies()
    }})
  }

  return (
    <>
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{t('gdpr.retention')}</h2>
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
        ) : policies.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">{tc('noData')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className={TABLE_STYLES.table}>
              <thead>
                <tr className={TABLE_STYLES.header}>
                  <th className={TABLE_STYLES.headerCell}>{tc('category')}</th>
                  <th className={TABLE_STYLES.headerCell}>{t('gdpr.retentionMonths')}</th>
                  <th className={TABLE_STYLES.headerCell}>{t('gdpr.autoDelete')}</th>
                  <th className={TABLE_STYLES.headerCell}>{t('gdpr.anonymize')}</th>
                  <th className={TABLE_STYLES.headerCell}>{t('gdpr.lastRunAt')}</th>
                  <th className={TABLE_STYLES.headerCell}>{tc('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((p) => (
                  <tr key={p.id} className={TABLE_STYLES.row}>
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium text-foreground">{p.category}</div>
                      {p.description && (
                        <div className="text-xs text-muted-foreground mt-0.5 max-w-[200px] truncate">{p.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {p.retention_months} mo
                      <span className="text-xs text-muted-foreground ml-1">({Math.round(p.retention_months / 12 * 10) / 10} yr)</span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${p.auto_delete ? 'bg-emerald-500/15 text-emerald-700' : 'bg-background text-muted-foreground'}`}>
                        {p.auto_delete ? tc('yes') : tc('no')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${p.anonymize ? 'bg-primary/10 text-primary/90' : 'bg-background text-muted-foreground'}`}>
                        {p.anonymize ? tc('yes') : tc('no')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {p.last_run_at ? new Date(p.last_run_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setSelected(p); setShowForm(true) }}
                          className="text-muted-foreground hover:text-primary"
                          title={tc('edit')}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleRunPolicy(p.id)}
                          className="text-muted-foreground hover:text-emerald-600"
                          title={t('gdpr.runRetention')}
                        >
                          <Play className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="text-muted-foreground hover:text-destructive"
                          title={tc('delete')}
                        >
                          <Trash2 className="w-4 h-4" />
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
        <RetentionPolicyForm
          open={showForm}
          policy={selected}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchPolicies() }}
        />
      )}
    <ConfirmDialog {...dialogProps} />
    </div>
  </>
  )
}
