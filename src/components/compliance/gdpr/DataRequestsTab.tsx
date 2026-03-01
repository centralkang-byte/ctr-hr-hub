'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Eye, CheckCircle2, Clock } from 'lucide-react'
import DataRequestForm from './DataRequestForm'

interface DataRequest {
  id: string
  employee_name: string
  employee_no: string
  request_type: string
  status: 'pending' | 'in_progress' | 'completed' | 'rejected'
  description: string
  deadline: string | null
  completed_at: string | null
  response_note: string | null
  created_at: string
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 border border-amber-200',
    in_progress: 'bg-blue-50 text-blue-700 border border-blue-200',
    completed: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    rejected: 'bg-red-50 text-red-700 border border-red-200',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status] ?? map.pending}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

const REQUEST_TYPE_LABELS: Record<string, string> = {
  ACCESS: 'Right to Access',
  ERASURE: 'Right to Erasure',
  PORTABILITY: 'Data Portability',
  RECTIFICATION: 'Rectification',
  RESTRICTION: 'Restriction',
  OBJECTION: 'Objection',
}

export default function DataRequestsTab() {
  const t = useTranslations('compliance')
  const tc = useTranslations('common')

  const [requests, setRequests] = useState<DataRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<DataRequest | null>(null)

  const fetchRequests = () => {
    setLoading(true)
    fetch('/api/v1/compliance/gdpr/requests?page=1&limit=20')
      .then((res) => res.json())
      .then((json) => {
        setRequests(json.data ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchRequests()
  }, [])

  const isOverdue = (deadline: string | null) => {
    if (!deadline) return false
    return new Date(deadline) < new Date()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">{t('gdpr.requests')}</h2>
        <button
          onClick={() => { setSelected(null); setShowForm(true) }}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm"
        >
          <Plus className="w-4 h-4" />
          {t('gdpr.newRequest')}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-slate-500">{tc('loading')}</div>
        ) : requests.length === 0 ? (
          <div className="p-8 text-center text-slate-500">{tc('noData')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium uppercase tracking-wider">{tc('name')}</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium uppercase tracking-wider">{t('gdpr.requestType')}</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium uppercase tracking-wider">{tc('status')}</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium uppercase tracking-wider">{t('gdpr.deadline')}</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium uppercase tracking-wider">{tc('createdAt')}</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium uppercase tracking-wider">{tc('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium text-slate-900">{r.employee_name}</div>
                      <div className="text-xs text-slate-400">{r.employee_no}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {REQUEST_TYPE_LABELS[r.request_type] ?? r.request_type}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {r.deadline ? (
                        <span className={`flex items-center gap-1 ${isOverdue(r.deadline) && r.status !== 'completed' ? 'text-red-600 font-medium' : 'text-slate-600'}`}>
                          {isOverdue(r.deadline) && r.status !== 'completed' ? (
                            <Clock className="w-3.5 h-3.5" />
                          ) : null}
                          {new Date(r.deadline).toLocaleDateString()}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => { setSelected(r); setShowForm(true) }}
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        <Eye className="w-4 h-4" />
                        {r.status === 'pending' || r.status === 'in_progress' ? tc('edit') : tc('view')}
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
            fetchRequests()
          }}
        />
      )}
    </div>
  )
}
