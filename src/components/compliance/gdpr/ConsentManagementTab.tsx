'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, ShieldCheck, XCircle } from 'lucide-react'
import ConsentForm from './ConsentForm'

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
    active: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    revoked: 'bg-red-50 text-red-700 border border-red-200',
    expired: 'bg-slate-50 text-slate-600 border border-slate-200',
    pending: 'bg-amber-50 text-amber-700 border border-amber-200',
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
    if (!confirm(tc('confirmAction'))) return
    fetch(`/api/v1/compliance/gdpr/consents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'revoked' }),
    }).then(() => fetchConsents())
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">{t('gdpr.consents')}</h2>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm"
        >
          <Plus className="w-4 h-4" />
          {t('gdpr.consentForm')}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-slate-500">{tc('loading')}</div>
        ) : consents.length === 0 ? (
          <div className="p-8 text-center text-slate-500">{tc('noData')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium uppercase tracking-wider">{tc('name')}</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium uppercase tracking-wider">{t('gdpr.purpose')}</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium uppercase tracking-wider">{t('gdpr.legalBasis')}</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium uppercase tracking-wider">{tc('status')}</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium uppercase tracking-wider">{t('gdpr.consentedAt')}</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium uppercase tracking-wider">{t('gdpr.expiresAt')}</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium uppercase tracking-wider">{tc('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {consents.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium text-slate-900">{c.employee_name}</div>
                      <div className="text-xs text-slate-400">{c.employee_no}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{c.purpose}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 max-w-[200px] truncate">{c.legal_basis}</td>
                    <td className="px-4 py-3 text-sm">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {c.consented_at ? new Date(c.consented_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {c.expires_at ? new Date(c.expires_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {c.status === 'active' && (
                        <button
                          onClick={() => handleRevoke(c.id)}
                          className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 text-sm font-medium"
                        >
                          <XCircle className="w-4 h-4" />
                          {t('gdpr.revokeConsent')}
                        </button>
                      )}
                      {c.status !== 'active' && (
                        <span className="text-slate-400 text-xs flex items-center gap-1">
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
    </div>
  )
}
