'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { FileSearch, Plus, Pencil, Eye, AlertTriangle } from 'lucide-react'
import DpiaForm from '@/components/compliance/gdpr/DpiaForm'

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

export default function DpiaClient() {
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

  const riskCounts = {
    critical: dpias.filter((d) => d.risk_level === 'critical').length,
    high: dpias.filter((d) => d.risk_level === 'high').length,
    medium: dpias.filter((d) => d.risk_level === 'medium').length,
    low: dpias.filter((d) => d.risk_level === 'low').length,
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
            <FileSearch className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 mb-6">{t('gdpr.dpia')}</h1>
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
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs text-slate-500 mb-1">Total DPIAs</p>
          <p className="text-3xl font-bold text-slate-900">{dpias.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-red-100 shadow-sm p-5">
          <p className="text-xs text-red-500 mb-1">Critical Risk</p>
          <p className="text-3xl font-bold text-red-600">{riskCounts.critical}</p>
        </div>
        <div className="bg-white rounded-xl border border-orange-100 shadow-sm p-5">
          <p className="text-xs text-orange-500 mb-1">High Risk</p>
          <p className="text-3xl font-bold text-orange-600">{riskCounts.high}</p>
        </div>
        <div className="bg-white rounded-xl border border-amber-100 shadow-sm p-5">
          <p className="text-xs text-amber-500 mb-1">Medium Risk</p>
          <p className="text-3xl font-bold text-amber-600">{riskCounts.medium}</p>
        </div>
      </div>

      {/* High Risk Alert */}
      {(riskCounts.critical > 0 || riskCounts.high > 0) && (
        <div className="flex items-start gap-3 p-4 bg-orange-50 border border-orange-200 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-orange-800">
              {riskCounts.critical + riskCounts.high} high-risk DPIA(s) require attention
            </p>
            <p className="text-xs text-orange-600 mt-0.5">
              Review and ensure mitigations are in place for critical and high risk assessments.
            </p>
          </div>
        </div>
      )}

      {/* Table */}
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
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium uppercase tracking-wider">{t('gdpr.processingScope')}</th>
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
                        <div className="text-xs text-slate-400 mt-0.5 max-w-[200px] truncate">{d.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 max-w-[240px] truncate">{d.processing_scope}</td>
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
                      <button
                        onClick={() => { setSelected(d); setShowForm(true) }}
                        className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        {d.status === 'draft' || d.status === 'in_review' ? (
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
            fetchDpias()
          }}
        />
      )}
    </div>
  )
}
