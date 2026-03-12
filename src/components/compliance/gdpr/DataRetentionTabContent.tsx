'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Pencil, Play, Trash2 } from 'lucide-react'
import RetentionPolicyForm from './RetentionPolicyForm'

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
    if (!confirm(tc('confirmAction'))) return
    fetch(`/api/v1/compliance/gdpr/retention-policies/${id}/run`, { method: 'POST' }).then(() =>
      fetchPolicies()
    )
  }

  const handleDelete = (id: string) => {
    if (!confirm(tc('confirmDelete'))) return
    fetch(`/api/v1/compliance/gdpr/retention-policies/${id}`, { method: 'DELETE' }).then(() =>
      fetchPolicies()
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#1A1A1A]">{t('gdpr.retention')}</h2>
        <button
          onClick={() => { setSelected(null); setShowForm(true) }}
          className={`inline-flex items-center gap-2 ${BUTTON_VARIANTS.primary} px-4 py-2 rounded-lg font-medium text-sm`}
        >
          <Plus className="w-4 h-4" />
          {tc('create')}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-[#E8E8E8]">
        {loading ? (
          <div className="p-8 text-center text-[#666]">{tc('loading')}</div>
        ) : policies.length === 0 ? (
          <div className="p-8 text-center text-[#666]">{tc('noData')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#FAFAFA] border-b border-[#E8E8E8]">
                  <th className="px-4 py-3 text-left text-xs text-[#666] font-medium uppercase tracking-wider">{tc('category')}</th>
                  <th className="px-4 py-3 text-left text-xs text-[#666] font-medium uppercase tracking-wider">{t('gdpr.retentionMonths')}</th>
                  <th className="px-4 py-3 text-left text-xs text-[#666] font-medium uppercase tracking-wider">{t('gdpr.autoDelete')}</th>
                  <th className="px-4 py-3 text-left text-xs text-[#666] font-medium uppercase tracking-wider">{t('gdpr.anonymize')}</th>
                  <th className="px-4 py-3 text-left text-xs text-[#666] font-medium uppercase tracking-wider">{t('gdpr.lastRunAt')}</th>
                  <th className="px-4 py-3 text-left text-xs text-[#666] font-medium uppercase tracking-wider">{tc('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((p) => (
                  <tr key={p.id} className="border-b border-[#F5F5F5] hover:bg-[#FAFAFA]">
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium text-[#1A1A1A]">{p.category}</div>
                      {p.description && (
                        <div className="text-xs text-[#999] mt-0.5 max-w-[200px] truncate">{p.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#333]">
                      {p.retention_months} mo
                      <span className="text-xs text-[#999] ml-1">({Math.round(p.retention_months / 12 * 10) / 10} yr)</span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${p.auto_delete ? 'bg-[#D1FAE5] text-[#047857]' : 'bg-[#FAFAFA] text-[#666]'}`}>
                        {p.auto_delete ? tc('yes') : tc('no')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${p.anonymize ? 'bg-[#E8F5E9] text-[#00A844]' : 'bg-[#FAFAFA] text-[#666]'}`}>
                        {p.anonymize ? tc('yes') : tc('no')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#666]">
                      {p.last_run_at ? new Date(p.last_run_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setSelected(p); setShowForm(true) }}
                          className="text-[#666] hover:text-[#00C853]"
                          title={tc('edit')}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleRunPolicy(p.id)}
                          className="text-[#666] hover:text-[#059669]"
                          title={t('gdpr.runRetention')}
                        >
                          <Play className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="text-[#666] hover:text-[#DC2626]"
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
    </div>
  )
}
