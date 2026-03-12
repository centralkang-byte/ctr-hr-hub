'use client'

import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Database, Plus, Pencil, Play, Trash2 } from 'lucide-react'
import RetentionPolicyForm from '@/components/compliance/gdpr/RetentionPolicyForm'
import { BUTTON_VARIANTS,  TABLE_STYLES } from '@/lib/styles'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'

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
  const tCommon = useTranslations('common')

  const t = useTranslations('compliance')
  const tc = useTranslations('common')

  const [policies, setPolicies] = useState<RetentionPolicy[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<RetentionPolicy | null>(null)
  const { confirm, dialogProps } = useConfirmDialog()

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
    confirm({ title: tc('confirmAction'), onConfirm: async () =>
    fetch(`/api/v1/compliance/gdpr/retention-policies/${id}/run`, { method: 'POST' }).then(() =>
      fetchPolicies()
    )
  }

  const handleDelete = (id: string) => {
    confirm({ title: tc('confirmDelete'), onConfirm: async () =>
    fetch(`/api/v1/compliance/gdpr/retention-policies/${id}`, { method: 'DELETE' }).then(() =>
      fetchPolicies()
    )
  }

  return (
    <>
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#E0E7FF] rounded-xl flex items-center justify-center">
            <Database className="w-5 h-5 text-[#4F46E5]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1A1A1A] mb-6">{t('gdpr.retention')}</h1>
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
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <p className="text-xs text-[#666] mb-1">Total Policies</p>
          <p className="text-3xl font-bold text-[#1A1A1A]">{policies.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <p className="text-xs text-[#666] mb-1">{t('gdpr.autoDelete')} Enabled</p>
          <p className="text-3xl font-bold text-[#1A1A1A]">{policies.filter((p) => p.auto_delete).length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <p className="text-xs text-[#666] mb-1">{t('gdpr.anonymize')} Enabled</p>
          <p className="text-3xl font-bold text-[#1A1A1A]">{policies.filter((p) => p.anonymize).length}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#E8E8E8]">
        {loading ? (
          <div className="p-8 text-center text-[#666]">{tc('loading')}</div>
        ) : policies.length === 0 ? (
          <div className="p-8 text-center text-[#666]">{tc('noData')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={TABLE_STYLES.header}>
                  <th className={TABLE_STYLES.headerCell}>{tc('category')}</th>
                  <th className={TABLE_STYLES.headerCell}>{t('gdpr.retentionMonths')}</th>
                  <th className={TABLE_STYLES.headerCell}>{tc('description')}</th>
                  <th className={TABLE_STYLES.headerCell}>{t('gdpr.autoDelete')}</th>
                  <th className={TABLE_STYLES.headerCell}>{t('gdpr.anonymize')}</th>
                  <th className={TABLE_STYLES.headerCell}>{t('gdpr.lastRunAt')}</th>
                  <th className={TABLE_STYLES.headerCell}>{tc('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((p) => (
                  <tr key={p.id} className={TABLE_STYLES.header}>
                    <td className="px-4 py-3 text-sm font-medium text-[#1A1A1A]">{p.category}</td>
                    <td className="px-4 py-3 text-sm text-[#333]">
                      {p.retention_months} mo
                      <span className="text-xs text-[#999] ml-1">
                        ({Math.round((p.retention_months / 12) * 10) / 10} yr)
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#555] max-w-[200px] truncate">{p.description || '-'}</td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          p.auto_delete
                            ? 'bg-[#D1FAE5] text-[#047857] border border-[#A7F3D0]'
                            : 'bg-[#FAFAFA] text-[#555] border border-[#E8E8E8]'
                        }`}
                      >
                        {p.auto_delete ? tc('yes') : tc('no')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          p.anonymize
                            ? 'bg-[#E8F5E9] text-[#00A844] border border-[#E8F5E9]'
                            : 'bg-[#FAFAFA] text-[#555] border border-[#E8E8E8]'
                        }`}
                      >
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
                          className="p-1.5 text-[#666] hover:text-[#00C853] hover:bg-[#E8F5E9] rounded"
                          title={tc('edit')}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleRunPolicy(p.id)}
                          className="p-1.5 text-[#666] hover:text-[#059669] hover:bg-[#D1FAE5] rounded"
                          title={t('gdpr.runRetention')}
                        >
                          <Play className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="p-1.5 text-[#666] hover:text-[#DC2626] hover:bg-[#FEE2E2] rounded"
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
    <ConfirmDialog {...dialogProps} />
    </div>
  </>
  )
}
