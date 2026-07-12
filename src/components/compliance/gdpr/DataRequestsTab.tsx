'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Eye, Clock } from 'lucide-react'
import DataRequestForm from './DataRequestForm'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { BUTTON_VARIANTS, TABLE_STYLES } from '@/lib/styles'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'

export interface DataRequest {
  id: string
  employee: { id: string; name: string; employeeNo: string }
  requestType: string
  status: 'GDPR_PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED' | 'EXPIRED'
  description: string | null
  deadline: string
  completedAt: string | null
  responseNote: string | null
  createdAt: string
}

const EDITABLE_STATUSES = new Set(['GDPR_PENDING', 'IN_PROGRESS'])

export default function DataRequestsTab() {
  const t = useTranslations('compliance')
  const tc = useTranslations('common')

  const STATUS_LABELS: Record<string, string> = {
    GDPR_PENDING: t('gdpr.statusPending'),
    IN_PROGRESS: t('gdpr.statusInProgress'),
    COMPLETED: t('gdpr.statusCompleted'),
    REJECTED: t('gdpr.statusRejected'),
    EXPIRED: t('gdpr.statusExpired'),
  }

  const REQUEST_TYPE_LABELS: Record<string, string> = {
    ACCESS: t('gdpr.requestAccess'),
    ERASURE: t('gdpr.requestErasure'),
    PORTABILITY: t('gdpr.requestPortability'),
    RECTIFICATION: t('gdpr.requestRectification'),
    RESTRICTION: t('gdpr.requestRestriction'),
    OBJECTION: t('gdpr.requestObjection'),
  }

  const [requests, setRequests] = useState<DataRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<DataRequest | null>(null)

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true)
      const res = await apiClient.getList<DataRequest>('/api/v1/compliance/gdpr/requests', { page: 1, limit: 20 })
      setRequests(res.data ?? [])
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
    void fetchRequests()
  }, [fetchRequests])

  const isOverdue = (deadline: string | null) => {
    if (!deadline) return false
    return new Date(deadline) < new Date()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{t('gdpr.requests')}</h2>
        <button
          onClick={() => { setSelected(null); setShowForm(true) }}
          className={`inline-flex items-center gap-2 ${BUTTON_VARIANTS.primary} px-4 py-2 rounded-lg font-medium text-sm`}
        >
          <Plus className="w-4 h-4" />
          {t('gdpr.newRequest')}
        </button>
      </div>

      <div className={TABLE_STYLES.wrapper}>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">{tc('loading')}</div>
        ) : requests.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">{tc('noData')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className={TABLE_STYLES.table}>
              <thead>
                <tr className={TABLE_STYLES.header}>
                  <th className={TABLE_STYLES.headerCell}>{tc('name')}</th>
                  <th className={TABLE_STYLES.headerCell}>{t('gdpr.requestType')}</th>
                  <th className={TABLE_STYLES.headerCell}>{tc('status')}</th>
                  <th className={TABLE_STYLES.headerCell}>{t('gdpr.deadline')}</th>
                  <th className={TABLE_STYLES.headerCell}>{tc('createdAt')}</th>
                  <th className={TABLE_STYLES.headerCell}>{tc('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id} className={TABLE_STYLES.row}>
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium text-foreground">{r.employee.name}</div>
                      <div className="text-xs text-muted-foreground">{r.employee.employeeNo}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {REQUEST_TYPE_LABELS[r.requestType] ?? r.requestType}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <StatusBadge status={r.status}>{STATUS_LABELS[r.status] ?? r.status}</StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {r.deadline ? (
                        <span className={`flex items-center gap-1 ${isOverdue(r.deadline) && r.status !== 'COMPLETED' ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                          {isOverdue(r.deadline) && r.status !== 'COMPLETED' ? (
                            <Clock className="w-3.5 h-3.5" />
                          ) : null}
                          {new Date(r.deadline).toLocaleDateString()}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => { setSelected(r); setShowForm(true) }}
                        className="inline-flex items-center gap-1 text-primary hover:text-primary/90 text-sm font-medium"
                      >
                        <Eye className="w-4 h-4" />
                        {EDITABLE_STATUSES.has(r.status) ? tc('edit') : tc('view')}
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
        <DataRequestForm
          open={showForm}
          request={selected}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false)
            void fetchRequests()
          }}
        />
      )}
    </div>
  )
}
