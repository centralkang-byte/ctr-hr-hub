'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, ShieldCheck, XCircle } from 'lucide-react'
import ConsentForm from './ConsentForm'
import { BUTTON_VARIANTS, TABLE_STYLES } from '@/lib/styles'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/hooks/use-toast'
import { formatDate } from '@/lib/format/date'
import { CONSENT_PURPOSE_LABELS, readApiError } from './gdpr-labels'

interface Consent {
  id: string
  purpose: string
  legalBasis: string | null
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED'
  consentedAt: string | null
  revokedAt: string | null
  expiresAt: string | null
  employee: { id: string; name: string; employeeNo: string | null }
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACTIVE: 'bg-emerald-500/15 text-emerald-700 border border-emerald-200',
    REVOKED: 'bg-destructive/10 text-destructive border border-destructive/20',
    EXPIRED: 'bg-background text-muted-foreground border border-border',
  }
  const fallback = 'bg-amber-500/15 text-amber-700 border border-amber-300'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status] ?? fallback}`}>
      {status}
    </span>
  )
}

export default function ConsentManagementTab() {
  const t = useTranslations('compliance')
  const tc = useTranslations('common')

  const [consents, setConsents] = useState<Consent[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const { confirm, dialogProps } = useConfirmDialog()

  const fetchConsents = () => {
    setLoading(true)
    fetch('/api/v1/compliance/gdpr/consents?page=1&limit=20')
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status))
        return res.json()
      })
      .then((json) => setConsents(json.data ?? []))
      .catch(() => toast({ title: tc('loadFailed'), variant: 'destructive' }))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchConsents()
  }, [])

  const handleRevoke = (id: string) => {
    confirm({ title: tc('confirmAction'), onConfirm: async () => {
      const res = await fetch(`/api/v1/compliance/gdpr/consents/${id}/revoke`, { method: 'POST' })
      if (!res.ok) toast({ title: await readApiError(res, tc('error')), variant: 'destructive' })
      fetchConsents()
    }})
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{t('gdpr.consents')}</h2>
        <button
          onClick={() => setShowForm(true)}
          className={`inline-flex items-center gap-2 ${BUTTON_VARIANTS.primary} px-4 py-2 rounded-lg font-medium text-sm`}
        >
          <Plus className="w-4 h-4" />
          {t('gdpr.consentForm')}
        </button>
      </div>

      <div className={TABLE_STYLES.wrapper}>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">{tc('loading')}</div>
        ) : consents.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">{tc('noData')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className={TABLE_STYLES.table}>
              <thead>
                <tr className={TABLE_STYLES.header}>
                  <th className={TABLE_STYLES.headerCell}>{tc('name')}</th>
                  <th className={TABLE_STYLES.headerCell}>{t('gdpr.purpose')}</th>
                  <th className={TABLE_STYLES.headerCell}>{t('gdpr.legalBasis')}</th>
                  <th className={TABLE_STYLES.headerCell}>{tc('status')}</th>
                  <th className={TABLE_STYLES.headerCell}>{t('gdpr.consentedAt')}</th>
                  <th className={TABLE_STYLES.headerCell}>{t('gdpr.expiresAt')}</th>
                  <th className={TABLE_STYLES.headerCell}>{tc('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {consents.map((c) => (
                  <tr key={c.id} className={TABLE_STYLES.row}>
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium text-foreground">{c.employee.name}</div>
                      <div className="text-xs text-muted-foreground">{c.employee.employeeNo ?? '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">{CONSENT_PURPOSE_LABELS[c.purpose] ?? c.purpose}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground max-w-[200px] truncate">{c.legalBasis ?? '-'}</td>
                    <td className="px-4 py-3 text-sm">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDate(c.consentedAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDate(c.expiresAt)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {c.status === 'ACTIVE' && (
                        <button
                          onClick={() => handleRevoke(c.id)}
                          className="inline-flex items-center gap-1 text-destructive hover:text-destructive text-sm font-medium"
                        >
                          <XCircle className="w-4 h-4" />
                          {t('gdpr.revokeConsent')}
                        </button>
                      )}
                      {c.status !== 'ACTIVE' && (
                        <span className="text-muted-foreground text-xs flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          {c.status}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <ConsentForm
          open={showForm}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false)
            fetchConsents()
          }}
        />
      )}
      <ConfirmDialog {...dialogProps} />
    </div>
  )
}
