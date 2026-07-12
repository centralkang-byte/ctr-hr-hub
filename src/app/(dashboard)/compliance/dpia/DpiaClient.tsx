'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { FileSearch, Plus, Pencil, Eye, AlertTriangle } from 'lucide-react'
import DpiaForm from '@/components/compliance/gdpr/DpiaForm'
import type { Dpia } from '@/components/compliance/gdpr/DpiaTabContent'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { BUTTON_VARIANTS, TABLE_STYLES } from '@/lib/styles'
import { cn } from '@/lib/utils'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import type { SessionUser } from '@/types'

const EDITABLE_STATUSES = new Set(['DPIA_DRAFT', 'IN_REVIEW'])

export default function DpiaClient({ user: _user }: { user: SessionUser }) {
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

  const riskCounts = {
    critical: dpias.filter((d) => d.riskLevel === 'CRITICAL').length,
    high: dpias.filter((d) => d.riskLevel === 'HIGH').length,
    medium: dpias.filter((d) => d.riskLevel === 'MEDIUM').length,
    low: dpias.filter((d) => d.riskLevel === 'LOW').length,
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-wt-4/10 rounded-xl flex items-center justify-center">
            <FileSearch className="w-5 h-5 text-wt-4" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-6">{t('gdpr.dpia')}</h1>
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
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <p className="text-xs text-muted-foreground mb-1">{t('gdpr.dpia')}</p>
          <p className="text-3xl font-bold text-foreground">{dpias.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-destructive/15 p-5">
          <p className="text-xs text-red-500 mb-1">{t('gdpr.riskCritical')}</p>
          <p className="text-3xl font-bold text-destructive">{riskCounts.critical}</p>
        </div>
        <div className="bg-card rounded-xl border border-orange-100 p-5">
          <p className="text-xs text-orange-500 mb-1">{t('gdpr.riskHigh')}</p>
          <p className="text-3xl font-bold text-orange-600">{riskCounts.high}</p>
        </div>
        <div className="bg-card rounded-xl border border-amber-100 p-5">
          <p className="text-xs text-amber-500 mb-1">{t('gdpr.riskMedium')}</p>
          <p className="text-3xl font-bold text-amber-600">{riskCounts.medium}</p>
        </div>
      </div>

      {/* High Risk Alert */}
      {(riskCounts.critical > 0 || riskCounts.high > 0) && (
        <div className="flex items-start gap-3 p-4 bg-orange-500/10 border border-orange-200 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-orange-800">
              {t('gdpr.highRiskAlert', { count: riskCounts.critical + riskCounts.high })}
            </p>
            <p className="text-xs text-orange-600 mt-0.5">{t('gdpr.highRiskAlertDesc')}</p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-card rounded-xl border border-border">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">{tc('loading')}</div>
        ) : dpias.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">{tc('noData')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className={TABLE_STYLES.table}>
              <thead className={TABLE_STYLES.header}>
                <tr className={TABLE_STYLES.row}>
                  <th className={TABLE_STYLES.headerCell}>{tc('title')}</th>
                  <th className={TABLE_STYLES.headerCell}>{t('gdpr.processingScope')}</th>
                  <th className={TABLE_STYLES.headerCell}>{t('gdpr.riskLevel')}</th>
                  <th className={TABLE_STYLES.headerCell}>{tc('status')}</th>
                  <th className={TABLE_STYLES.headerCell}>{tc('updatedAt')}</th>
                  <th className={TABLE_STYLES.headerCell}>{tc('actions')}</th>
                </tr>
              </thead>
              <tbody>
              {dpias.map((d) => (
                  <tr key={d.id} className={TABLE_STYLES.row}>
                    <td className={TABLE_STYLES.cell}>
                      <div className="font-medium text-foreground">{d.title}</div>
                      {d.description && (
                        <div className="text-xs text-muted-foreground mt-0.5 max-w-[200px] truncate">{d.description}</div>
                      )}
                    </td>
                    <td className={cn(TABLE_STYLES.cell, 'text-muted-foreground max-w-[240px] truncate')}>{d.processingScope}</td>
                    <td className={TABLE_STYLES.cell}>
                      {d.riskLevel ? (
                        <StatusBadge variant={RISK_VARIANTS[d.riskLevel] ?? 'warning'}>
                          {RISK_LABELS[d.riskLevel] ?? d.riskLevel}
                        </StatusBadge>
                      ) : '-'}
                    </td>
                    <td className={TABLE_STYLES.cell}>
                      <StatusBadge status={d.status}>{STATUS_LABELS[d.status] ?? d.status}</StatusBadge>
                    </td>
                    <td className={cn(TABLE_STYLES.cell, 'text-muted-foreground')}>
                      {new Date(d.updatedAt).toLocaleDateString()}
                    </td>
                    <td className={TABLE_STYLES.cell}>
                      <button
                        onClick={() => { setSelected(d); setShowForm(true) }}
                        className="inline-flex items-center gap-1.5 text-primary hover:text-primary/90 text-sm font-medium"
                      >
                        {EDITABLE_STATUSES.has(d.status) ? (
                          <>
                            <Pencil className="w-4 h-4" />
                            {tc('edit')}
                          </>
                        ) : (
                          <>
                            <Eye className="w-4 h-4" />
                            {tc('view')}
                          </>
                        )}
                      </button>
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
          onSaved={() => {
            setShowForm(false)
            void fetchDpias()
          }}
        />
      )}
    </div>
  )
}
