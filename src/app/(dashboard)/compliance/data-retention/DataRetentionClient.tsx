'use client'

import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Database, Plus, Pencil, Play, Trash2 } from 'lucide-react'
import RetentionPolicyForm from '@/components/compliance/gdpr/RetentionPolicyForm'
import { BUTTON_VARIANTS,  TABLE_STYLES } from '@/lib/styles'
import { cn } from '@/lib/utils'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'
import type { SessionUser } from '@/types'

interface RetentionPolicy {
  id: string
  category: string
  retention_months: number
  description: string
  auto_delete: boolean
  anonymize: boolean
  last_run_at: string | null
}

export default function DataRetentionClient({ user }: { user: SessionUser }) {
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
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-500/15 rounded-xl flex items-center justify-center">
            <Database className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-6">{t('gdpr.retention')}</h1>
          </div>
        </div>
        <button
          onClick={() => { setSelected(null); setShowForm(true) }}
          className={`inline-flex items-center gap-2 ${BUTTON_VARIANTS.primary} px-4 py-2 rounded-lg font-medium text-sm`}
        >
          <Plus className="w-4 h-4" />
          {tc('create')}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <p className="text-xs text-muted-foreground mb-1">Total Policies</p>
          <p className="text-3xl font-bold text-foreground">{policies.length}</p>
        </div>
        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <p className="text-xs text-muted-foreground mb-1">{t('gdpr.autoDelete')} Enabled</p>
          <p className="text-3xl font-bold text-foreground">{policies.filter((p) => p.auto_delete).length}</p>
        </div>
        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <p className="text-xs text-muted-foreground mb-1">{t('gdpr.anonymize')} Enabled</p>
          <p className="text-3xl font-bold text-foreground">{policies.filter((p) => p.anonymize).length}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">{tc('loading')}</div>
        ) : policies.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">{tc('noData')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className={TABLE_STYLES.table}>
              <thead className={TABLE_STYLES.header}>
                <tr className={TABLE_STYLES.row}>
                  <th className={TABLE_STYLES.headerCell}>{tc('category')}</th>
                  <th className={TABLE_STYLES.headerCell}>{t('gdpr.retentionMonths')}</th>
                  <th className={TABLE_STYLES.headerCell}>{tc('description')}</th>
                  <th className={TABLE_STYLES.headerCell}>{t('gdpr.autoDelete')}</th>
                  <th className={TABLE_STYLES.headerCell}>{t('gdpr.anonymize')}</th>
                  <th className={TABLE_STYLES.headerCell}>{t('gdpr.lastRunAt')}</th>
                  <th className={TABLE_STYLES.headerCell}>{tc('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {!policies?.length && <EmptyState />}
              {policies?.map((p) => (
                  <tr key={p.id} className={TABLE_STYLES.row}>
                    <td className={cn(TABLE_STYLES.cell, 'font-medium text-foreground')}>{p.category}</td>
                    <td className={cn(TABLE_STYLES.cell, 'text-foreground')}>
                      {p.retention_months} mo
                      <span className="text-xs text-muted-foreground ml-1">
                        ({Math.round((p.retention_months / 12) * 10) / 10} yr)
                      </span>
                    </td>
                    <td className={cn(TABLE_STYLES.cell, 'text-muted-foreground max-w-[200px] truncate')}>{p.description || '-'}</td>
                    <td className={TABLE_STYLES.cell}>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          p.auto_delete
                            ? 'bg-emerald-500/15 text-emerald-700 border border-emerald-200'
                            : 'bg-background text-muted-foreground border border-border'
                        }`}
                      >
                        {p.auto_delete ? tc('yes') : tc('no')}
                      </span>
                    </td>
                    <td className={TABLE_STYLES.cell}>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          p.anonymize
                            ? 'bg-primary/10 text-primary/90 border border-primary/20'
                            : 'bg-background text-muted-foreground border border-border'
                        }`}
                      >
                        {p.anonymize ? tc('yes') : tc('no')}
                      </span>
                    </td>
                    <td className={cn(TABLE_STYLES.cell, 'text-muted-foreground')}>
                      {p.last_run_at ? new Date(p.last_run_at).toLocaleDateString() : '-'}
                    </td>
                    <td className={TABLE_STYLES.cell}>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setSelected(p); setShowForm(true) }}
                          className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded"
                          title={tc('edit')}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleRunPolicy(p.id)}
                          className="p-1.5 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/15 rounded"
                          title={t('gdpr.runRetention')}
                        >
                          <Play className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded"
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
          onSaved={() => {
            setShowForm(false)
            fetchPolicies()
          }}
        />
      )}
    <ConfirmDialog {...dialogProps} />
    </div>
  </>
  )
}
