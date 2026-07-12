'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Pencil, Eye } from 'lucide-react'
import DpiaForm from './DpiaForm'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { BUTTON_VARIANTS, TABLE_STYLES } from '@/lib/styles'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'

export interface Dpia {
  id: string
  title: string
  description: string | null
  processingScope: string | null
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null
  mitigations: string | null
  status: 'DPIA_DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED'
  createdAt: string
  updatedAt: string
}

const EDITABLE_STATUSES = new Set(['DPIA_DRAFT', 'IN_REVIEW'])

export default function DpiaTabContent() {
  const t = useTranslations('compliance')
  const tc = useTranslations('common')

  const RISK_LABELS: Record<string, string> = {
    LOW: t('gdpr.riskLow'),
    MEDIUM: t('gdpr.riskMedium'),
    HIGH: t('gdpr.riskHigh'),
    CRITICAL: t('gdpr.riskCritical'),
  }
  const RISK_VARIANTS: Record<string, 'success' | 'warning' | 'error'> = {
    LOW: 'success',
    MEDIUM: 'warning',
    HIGH: 'warning',
    CRITICAL: 'error',
  }
  const STATUS_LABELS: Record<string, string> = {
    DPIA_DRAFT: t('gdpr.statusDraft'),
    IN_REVIEW: t('gdpr.statusInReview'),
    APPROVED: t('gdpr.statusApproved'),
    REJECTED: t('gdpr.statusRejected'),
  }

  const [dpias, setDpias] = useState<Dpia[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<Dpia | null>(null)

  const fetchDpias = useCallback(async () => {
    try {
      setLoading(true)
      const res = await apiClient.getList<Dpia>('/api/v1/compliance/gdpr/dpia', { page: 1, limit: 20 })
      setDpias(res.data ?? [])
    } catch (err) {
      toast({
        title: tc('loadFailed'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [tc])

  useEffect(() => {
    void fetchDpias()
  }, [fetchDpias])

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
                  <th className={TABLE_STYLES.headerCell}>{tc('title')}</th>
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
                      {d.riskLevel ? (
                        <StatusBadge variant={RISK_VARIANTS[d.riskLevel] ?? 'warning'}>
                          {RISK_LABELS[d.riskLevel] ?? d.riskLevel}
                        </StatusBadge>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <StatusBadge status={d.status}>{STATUS_LABELS[d.status] ?? d.status}</StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(d.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setSelected(d); setShowForm(true) }}
                          className="text-muted-foreground hover:text-primary"
                          title={EDITABLE_STATUSES.has(d.status) ? tc('edit') : tc('view')}
                        >
                          {EDITABLE_STATUSES.has(d.status) ? (
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
          onSaved={() => { setShowForm(false); void fetchDpias() }}
        />
      )}
    </div>
  )
}
