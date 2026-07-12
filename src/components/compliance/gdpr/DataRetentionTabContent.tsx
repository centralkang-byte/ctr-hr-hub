'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Pencil, Play, Trash2 } from 'lucide-react'
import RetentionPolicyForm from './RetentionPolicyForm'
import { BUTTON_VARIANTS, TABLE_STYLES } from '@/lib/styles'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/hooks/use-toast'
import { formatDate } from '@/lib/format/date'
import { RETENTION_CATEGORY_LABELS, readApiError } from './gdpr-labels'

interface RetentionPolicy {
  id: string
  category: string
  retentionMonths: number
  description: string | null
  autoDelete: boolean
  anonymize: boolean
  lastRunAt: string | null
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
    fetch('/api/v1/compliance/gdpr/retention?page=1&limit=50')
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status))
        return res.json()
      })
      .then((json) => setPolicies(json.data ?? []))
      .catch(() => toast({ title: tc('loadFailed'), variant: 'destructive' }))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchPolicies()
  }, [])

  const handleRunPolicy = (id: string) => {
    confirm({ title: tc('confirmAction'), onConfirm: async () => {
      const res = await fetch('/api/v1/compliance/gdpr/retention/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policyId: id }),
      })
      if (!res.ok) toast({ title: await readApiError(res, tc('error')), variant: 'destructive' })
      fetchPolicies()
    }})
  }

  const handleDelete = (id: string) => {
    confirm({ title: tc('confirmDelete'), onConfirm: async () => {
      const res = await fetch(`/api/v1/compliance/gdpr/retention/${id}`, { method: 'DELETE' })
      if (!res.ok) toast({ title: await readApiError(res, tc('error')), variant: 'destructive' })
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
                      <div className="font-medium text-foreground">{RETENTION_CATEGORY_LABELS[p.category] ?? p.category}</div>
                      {p.description && (
                        <div className="text-xs text-muted-foreground mt-0.5 max-w-[200px] truncate">{p.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {p.retentionMonths}{tc('unitMonth')}
                      <span className="text-xs text-muted-foreground ml-1">({Math.round(p.retentionMonths / 12 * 10) / 10}{tc('unitYear')})</span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${p.autoDelete ? 'bg-emerald-500/15 text-emerald-700' : 'bg-background text-muted-foreground'}`}>
                        {p.autoDelete ? tc('yes') : tc('no')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${p.anonymize ? 'bg-primary/10 text-primary/90' : 'bg-background text-muted-foreground'}`}>
                        {p.anonymize ? tc('yes') : tc('no')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDate(p.lastRunAt)}
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
