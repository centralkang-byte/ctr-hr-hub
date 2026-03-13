'use client'

import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { FileSearch, Plus, Pencil, Eye, AlertTriangle } from 'lucide-react'
import DpiaForm from '@/components/compliance/gdpr/DpiaForm'
import { BUTTON_VARIANTS,  TABLE_STYLES } from '@/lib/styles'

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

export default function DpiaClient() {
  const tCommon = useTranslations('common')

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
          <div className="w-10 h-10 bg-[#F3E8FF] rounded-xl flex items-center justify-center">
            <FileSearch className="w-5 h-5 text-[#9333EA]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1A1A1A] mb-6">{t('gdpr.dpia')}</h1>
          </div>
        </div>
        <button
          onClick={() => { setSelected(null); setShowForm(true) }}
          className={`inline-flex items-center gap-2 ${BUTTON_VARIANTS.primary} px-4 py-2 rounded-lg font-medium text-sm`}
        >
          <Plus className="w-4 h-4" />
          {tc('create')}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <p className="text-xs text-[#666] mb-1">Total DPIAs</p>
          <p className="text-3xl font-bold text-[#1A1A1A]">{dpias.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-[#FEE2E2] p-5">
          <p className="text-xs text-[#EF4444] mb-1">Critical Risk</p>
          <p className="text-3xl font-bold text-[#DC2626]">{riskCounts.critical}</p>
        </div>
        <div className="bg-white rounded-xl border border-[#FFEDD5] p-5">
          <p className="text-xs text-[#F97316] mb-1">High Risk</p>
          <p className="text-3xl font-bold text-[#EA580C]">{riskCounts.high}</p>
        </div>
        <div className="bg-white rounded-xl border border-[#FEF3C7] p-5">
          <p className="text-xs text-[#F59E0B] mb-1">Medium Risk</p>
          <p className="text-3xl font-bold text-[#D97706]">{riskCounts.medium}</p>
        </div>
      </div>

      {/* High Risk Alert */}
      {(riskCounts.critical > 0 || riskCounts.high > 0) && (
        <div className="flex items-start gap-3 p-4 bg-[#FFF7ED] border border-[#FED7AA] rounded-xl">
          <AlertTriangle className="w-5 h-5 text-[#EA580C] mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-[#9A3412]">
              {riskCounts.critical + riskCounts.high} high-risk DPIA(s) require attention
            </p>
            <p className="text-xs text-[#EA580C] mt-0.5">
              Review and ensure mitigations are in place for critical and high risk assessments.
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#E8E8E8]">
        {loading ? (
          <div className="p-8 text-center text-[#666]">{tc('loading')}</div>
        ) : dpias.length === 0 ? (
          <div className="p-8 text-center text-[#666]">{tc('noData')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={TABLE_STYLES.header}>
                  <th className={TABLE_STYLES.headerCell}>Title</th>
                  <th className={TABLE_STYLES.headerCell}>{t('gdpr.processingScope')}</th>
                  <th className={TABLE_STYLES.headerCell}>{t('gdpr.riskLevel')}</th>
                  <th className={TABLE_STYLES.headerCell}>{tc('status')}</th>
                  <th className={TABLE_STYLES.headerCell}>{tc('updatedAt')}</th>
                  <th className={TABLE_STYLES.headerCell}>{tc('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {!dpias?.length && <EmptyState title="데이터가 없습니다" description="조건을 변경하거나 새로운 데이터를 추가해보세요." />}
              {dpias?.map((d) => (
                  <tr key={d.id} className={TABLE_STYLES.header}>
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium text-[#1A1A1A]">{d.title}</div>
                      {d.description && (
                        <div className="text-xs text-[#999] mt-0.5 max-w-[200px] truncate">{d.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#555] max-w-[240px] truncate">{d.processing_scope}</td>
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
                      <button
                        onClick={() => { setSelected(d); setShowForm(true) }}
                        className="inline-flex items-center gap-1.5 text-[#4F46E5] hover:text-[#4338CA] text-sm font-medium"
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
