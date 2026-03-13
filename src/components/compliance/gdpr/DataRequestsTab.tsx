'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Eye, CheckCircle2, Clock } from 'lucide-react'
import DataRequestForm from './DataRequestForm'
import { BUTTON_VARIANTS } from '@/lib/styles'

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
    pending: 'bg-[#FEF3C7] text-[#B45309] border border-[#FCD34D]',
    in_progress: 'bg-[#EEF2FF] text-[#4338CA] border border-[#EEF2FF]',
    completed: 'bg-[#D1FAE5] text-[#047857] border border-[#A7F3D0]',
    rejected: 'bg-[#FEE2E2] text-[#B91C1C] border border-[#FECACA]',
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
        <h2 className="text-lg font-semibold text-[#1A1A1A]">{t('gdpr.requests')}</h2>
        <button
          onClick={() => { setSelected(null); setShowForm(true) }}
          className={`inline-flex items-center gap-2 ${BUTTON_VARIANTS.primary} px-4 py-2 rounded-lg font-medium text-sm`}
        >
          <Plus className="w-4 h-4" />
          {t('gdpr.newRequest')}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-[#E8E8E8]">
        {loading ? (
          <div className="p-8 text-center text-[#666]">{tc('loading')}</div>
        ) : requests.length === 0 ? (
          <div className="p-8 text-center text-[#666]">{tc('noData')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#FAFAFA] border-b border-[#E8E8E8]">
                  <th className="px-4 py-3 text-left text-xs text-[#666] font-medium uppercase tracking-wider">{tc('name')}</th>
                  <th className="px-4 py-3 text-left text-xs text-[#666] font-medium uppercase tracking-wider">{t('gdpr.requestType')}</th>
                  <th className="px-4 py-3 text-left text-xs text-[#666] font-medium uppercase tracking-wider">{tc('status')}</th>
                  <th className="px-4 py-3 text-left text-xs text-[#666] font-medium uppercase tracking-wider">{t('gdpr.deadline')}</th>
                  <th className="px-4 py-3 text-left text-xs text-[#666] font-medium uppercase tracking-wider">{tc('createdAt')}</th>
                  <th className="px-4 py-3 text-left text-xs text-[#666] font-medium uppercase tracking-wider">{tc('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id} className="border-b border-[#F5F5F5] hover:bg-[#FAFAFA]">
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium text-[#1A1A1A]">{r.employee_name}</div>
                      <div className="text-xs text-[#999]">{r.employee_no}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#333]">
                      {REQUEST_TYPE_LABELS[r.request_type] ?? r.request_type}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {r.deadline ? (
                        <span className={`flex items-center gap-1 ${isOverdue(r.deadline) && r.status !== 'completed' ? 'text-[#DC2626] font-medium' : 'text-[#555]'}`}>
                          {isOverdue(r.deadline) && r.status !== 'completed' ? (
                            <Clock className="w-3.5 h-3.5" />
                          ) : null}
                          {new Date(r.deadline).toLocaleDateString()}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#555]">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => { setSelected(r); setShowForm(true) }}
                        className="inline-flex items-center gap-1 text-[#4F46E5] hover:text-[#4338CA] text-sm font-medium"
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
