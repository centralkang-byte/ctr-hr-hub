'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Database, Plus, Pencil, Play, Trash2 } from 'lucide-react'
import RetentionPolicyForm from '@/components/compliance/gdpr/RetentionPolicyForm'

interface RetentionPolicy {
  id: string
  category: string
  retention_months: number
  description: string
  auto_delete: boolean
  anonymize: boolean
  last_run_at: string | null
}

export default function DataRetentionClient() {
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
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
            <Database className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 mb-6">{t('gdpr.retention')}</h1>
          </div>
        </div>
        <button
          onClick={() => { setSelected(null); setShowForm(true) }}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm"
        >
          <Plus className="w-4 h-4" />
          {tc('create')}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs text-slate-500 mb-1">Total Policies</p>
          <p className="text-3xl font-bold text-slate-900">{policies.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs text-slate-500 mb-1">{t('gdpr.autoDelete')} Enabled</p>
          <p className="text-3xl font-bold text-slate-900">{policies.filter((p) => p.auto_delete).length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs text-slate-500 mb-1">{t('gdpr.anonymize')} Enabled</p>
          <p className="text-3xl font-bold text-slate-900">{policies.filter((p) => p.anonymize).length}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-slate-500">{tc('loading')}</div>
        ) : policies.length === 0 ? (
          <div className="p-8 text-center text-slate-500">{tc('noData')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium uppercase tracking-wider">{tc('category')}</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium uppercase tracking-wider">{t('gdpr.retentionMonths')}</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium uppercase tracking-wider">{tc('description')}</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium uppercase tracking-wider">{t('gdpr.autoDelete')}</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium uppercase tracking-wider">{t('gdpr.anonymize')}</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium uppercase tracking-wider">{t('gdpr.lastRunAt')}</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium uppercase tracking-wider">{tc('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{p.category}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {p.retention_months} mo
                      <span className="text-xs text-slate-400 ml-1">
                        ({Math.round((p.retention_months / 12) * 10) / 10} yr)
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 max-w-[200px] truncate">{p.description || '-'}</td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          p.auto_delete
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-50 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {p.auto_delete ? tc('yes') : tc('no')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          p.anonymize
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-slate-50 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {p.anonymize ? tc('yes') : tc('no')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {p.last_run_at ? new Date(p.last_run_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setSelected(p); setShowForm(true) }}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title={tc('edit')}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleRunPolicy(p.id)}
                          className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded"
                          title={t('gdpr.runRetention')}
                        >
                          <Play className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded"
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
    </div>
  )
}
