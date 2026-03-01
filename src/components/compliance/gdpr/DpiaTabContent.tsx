'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Pencil, Eye } from 'lucide-react'
import DpiaForm from './DpiaForm'

interface Dpia {
  id: string
  title: string
  description: string
  processing_scope: string
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  mitigations: string
  status: string
  created_at: string
  updated_at: string
}

function RiskBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    low: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    medium: 'bg-amber-50 text-amber-700 border border-amber-200',
    high: 'bg-orange-50 text-orange-700 border border-orange-200',
    critical: 'bg-red-50 text-red-700 border border-red-200',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${map[level] ?? map.medium}`}>
      {level}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: 'bg-slate-50 text-slate-600 border border-slate-200',
    in_review: 'bg-amber-50 text-amber-700 border border-amber-200',
    approved: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    rejected: 'bg-red-50 text-red-700 border border-red-200',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status] ?? map.draft}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

export default function DpiaTabContent() {
  const t = useTranslations('compliance')
  const tc = useTranslations('common')

  const [dpias, setDpias] = useState<Dpia[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<Dpia | null>(null)

  const fetchDpias = () => {
    setLoading(true)
    fetch('/api/v1/compliance/gdpr/dpia?page=1&limit=20')
      .then((res) => res.json())
      .then((json) => {
        setDpias(json.data ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchDpias()
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">{t('gdpr.dpia')}</h2>
        <button
          onClick={() => { setSelected(null); setShowForm(true) }}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm"
        >
          <Plus className="w-4 h-4" />
          {tc('create')}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-slate-500">{tc('loading')}</div>
        ) : dpias.length === 0 ? (
          <div className="p-8 text-center text-slate-500">{tc('noData')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium uppercase tracking-wider">Title</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium uppercase tracking-wider">{t('gdpr.riskLevel')}</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium uppercase tracking-wider">{tc('status')}</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium uppercase tracking-wider">{tc('updatedAt')}</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium uppercase tracking-wider">{tc('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {dpias.map((d) => (
                  <tr key={d.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium text-slate-900">{d.title}</div>
                      {d.description && (
                        <div className="text-xs text-slate-400 mt-0.5 max-w-[280px] truncate">{d.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <RiskBadge level={d.risk_level} />
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <StatusBadge status={d.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {new Date(d.updated_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setSelected(d); setShowForm(true) }}
                          className="text-slate-500 hover:text-blue-600"
                          title={d.status === 'draft' || d.status === 'in_review' ? tc('edit') : tc('view')}
                        >
                          {d.status === 'draft' || d.status === 'in_review' ? (
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
          onSaved={() => { setShowForm(false); fetchDpias() }}
        />
      )}
    </div>
  )
}
