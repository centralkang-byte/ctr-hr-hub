'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, ShieldCheck, XCircle } from 'lucide-react'
import ConsentForm from './ConsentForm'
import { BUTTON_VARIANTS } from '@/lib/styles'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'

interface Consent {
  id: string
  employee_name: string
  employee_no: string
  purpose: string
  legal_basis: string
  status: 'active' | 'revoked' | 'expired'
  consented_at: string | null
  revoked_at: string | null
  expires_at: string | null
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'bg-[#D1FAE5] text-[#047857] border border-[#A7F3D0]',
    revoked: 'bg-[#FEE2E2] text-[#B91C1C] border border-[#FECACA]',
    expired: 'bg-[#FAFAFA] text-[#555] border border-[#E8E8E8]',
    pending: 'bg-[#FEF3C7] text-[#B45309] border border-[#FCD34D]',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status] ?? map.pending}`}>
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
      .then((res) => res.json())
      .then((json) => {
        setConsents(json.data ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchConsents()
  }, [])

  const handleRevoke = (id: string) => {
    confirm({ title: tc('confirmAction'), onConfirm: async () => {
      await fetch(`/api/v1/compliance/gdpr/consents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'revoked' }),
      })
      fetchConsents()
    }})
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#1A1A1A]">{t('gdpr.consents')}</h2>
        <button
          onClick={() => setShowForm(true)}
          className={`inline-flex items-center gap-2 ${BUTTON_VARIANTS.primary} px-4 py-2 rounded-lg font-medium text-sm`}
        >
          <Plus className="w-4 h-4" />
          {t('gdpr.consentForm')}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-[#E8E8E8]">
        {loading ? (
          <div className="p-8 text-center text-[#666]">{tc('loading')}</div>
        ) : consents.length === 0 ? (
          <div className="p-8 text-center text-[#666]">{tc('noData')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#FAFAFA] border-b border-[#E8E8E8]">
                  <th className="px-4 py-3 text-left text-xs text-[#666] font-medium uppercase tracking-wider">{tc('name')}</th>
                  <th className="px-4 py-3 text-left text-xs text-[#666] font-medium uppercase tracking-wider">{t('gdpr.purpose')}</th>
                  <th className="px-4 py-3 text-left text-xs text-[#666] font-medium uppercase tracking-wider">{t('gdpr.legalBasis')}</th>
                  <th className="px-4 py-3 text-left text-xs text-[#666] font-medium uppercase tracking-wider">{tc('status')}</th>
                  <th className="px-4 py-3 text-left text-xs text-[#666] font-medium uppercase tracking-wider">{t('gdpr.consentedAt')}</th>
                  <th className="px-4 py-3 text-left text-xs text-[#666] font-medium uppercase tracking-wider">{t('gdpr.expiresAt')}</th>
                  <th className="px-4 py-3 text-left text-xs text-[#666] font-medium uppercase tracking-wider">{tc('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {consents.map((c) => (
                  <tr key={c.id} className="border-b border-[#F5F5F5] hover:bg-[#FAFAFA]">
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium text-[#1A1A1A]">{c.employee_name}</div>
                      <div className="text-xs text-[#999]">{c.employee_no}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#333]">{c.purpose}</td>
                    <td className="px-4 py-3 text-sm text-[#555] max-w-[200px] truncate">{c.legal_basis}</td>
                    <td className="px-4 py-3 text-sm">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-[#555]">
                      {c.consented_at ? new Date(c.consented_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#555]">
                      {c.expires_at ? new Date(c.expires_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {c.status === 'active' && (
                        <button
                          onClick={() => handleRevoke(c.id)}
                          className="inline-flex items-center gap-1 text-[#DC2626] hover:text-[#B91C1C] text-sm font-medium"
                        >
                          <XCircle className="w-4 h-4" />
                          {t('gdpr.revokeConsent')}
                        </button>
                      )}
                      {c.status !== 'active' && (
                        <span className="text-[#999] text-xs flex items-center gap-1">
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
