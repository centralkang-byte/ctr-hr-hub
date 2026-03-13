'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Pencil, Eye } from 'lucide-react'
import DpiaForm from './DpiaForm'
import { BUTTON_VARIANTS } from '@/lib/styles'

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
    low: 'bg-[#D1FAE5] text-[#047857] border border-[#A7F3D0]',
    medium: 'bg-[#FEF3C7] text-[#B45309] border border-[#FCD34D]',
    high: 'bg-[#FFF7ED] text-[#C2410C] border border-[#FED7AA]',
    critical: 'bg-[#FEE2E2] text-[#B91C1C] border border-[#FECACA]',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${map[level] ?? map.medium}`}>
      {level}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: 'bg-[#FAFAFA] text-[#555] border border-[#E8E8E8]',
    in_review: 'bg-[#FEF3C7] text-[#B45309] border border-[#FCD34D]',
    approved: 'bg-[#D1FAE5] text-[#047857] border border-[#A7F3D0]',
    rejected: 'bg-[#FEE2E2] text-[#B91C1C] border border-[#FECACA]',
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
        <h2 className="text-lg font-semibold text-[#1A1A1A]">{t('gdpr.dpia')}</h2>
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
        ) : dpias.length === 0 ? (
          <div className="p-8 text-center text-[#666]">{tc('noData')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#FAFAFA] border-b border-[#E8E8E8]">
                  <th className="px-4 py-3 text-left text-xs text-[#666] font-medium uppercase tracking-wider">Title</th>
                  <th className="px-4 py-3 text-left text-xs text-[#666] font-medium uppercase tracking-wider">{t('gdpr.riskLevel')}</th>
                  <th className="px-4 py-3 text-left text-xs text-[#666] font-medium uppercase tracking-wider">{tc('status')}</th>
                  <th className="px-4 py-3 text-left text-xs text-[#666] font-medium uppercase tracking-wider">{tc('updatedAt')}</th>
                  <th className="px-4 py-3 text-left text-xs text-[#666] font-medium uppercase tracking-wider">{tc('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {dpias.map((d) => (
                  <tr key={d.id} className="border-b border-[#F5F5F5] hover:bg-[#FAFAFA]">
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium text-[#1A1A1A]">{d.title}</div>
                      {d.description && (
                        <div className="text-xs text-[#999] mt-0.5 max-w-[280px] truncate">{d.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <RiskBadge level={d.risk_level} />
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <StatusBadge status={d.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-[#666]">
                      {new Date(d.updated_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setSelected(d); setShowForm(true) }}
                          className="text-[#666] hover:text-[#4F46E5]"
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
