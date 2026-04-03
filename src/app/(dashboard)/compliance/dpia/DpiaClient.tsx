'use client'

import { EmptyState } from '@/components/ui/EmptyState'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { FileSearch, Plus, Pencil, Eye, AlertTriangle } from 'lucide-react'
import DpiaForm from '@/components/compliance/gdpr/DpiaForm'
import { BUTTON_VARIANTS,  TABLE_STYLES } from '@/lib/styles'
import { cn } from '@/lib/utils'
import type { SessionUser } from '@/types'

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
    low: 'bg-emerald-500/15 text-emerald-700 border border-emerald-200',
    medium: 'bg-amber-500/15 text-amber-700 border border-amber-300',
    high: 'bg-orange-500/10 text-orange-700 border border-orange-200',
    critical: 'bg-destructive/10 text-destructive border border-destructive/20',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${map[level] ?? map.medium}`}>
      {level}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: 'bg-background text-muted-foreground border border-border',
    in_review: 'bg-amber-500/15 text-amber-700 border border-amber-300',
    approved: 'bg-emerald-500/15 text-emerald-700 border border-emerald-200',
    rejected: 'bg-destructive/10 text-destructive border border-destructive/20',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status] ?? map.draft}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

export default function DpiaClient({ user: _user }: { user: SessionUser }) {
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
          <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center">
            <FileSearch className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-6">{t('gdpr.dpia')}</h1>
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
        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <p className="text-xs text-muted-foreground mb-1">Total DPIAs</p>
          <p className="text-3xl font-bold text-foreground">{dpias.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-destructive/15 p-5">
          <p className="text-xs text-red-500 mb-1">Critical Risk</p>
          <p className="text-3xl font-bold text-destructive">{riskCounts.critical}</p>
        </div>
        <div className="bg-card rounded-xl border border-orange-100 p-5">
          <p className="text-xs text-orange-500 mb-1">High Risk</p>
          <p className="text-3xl font-bold text-orange-600">{riskCounts.high}</p>
        </div>
        <div className="bg-card rounded-xl border border-amber-100 p-5">
          <p className="text-xs text-amber-500 mb-1">Medium Risk</p>
          <p className="text-3xl font-bold text-amber-600">{riskCounts.medium}</p>
        </div>
      </div>

      {/* High Risk Alert */}
      {(riskCounts.critical > 0 || riskCounts.high > 0) && (
        <div className="flex items-start gap-3 p-4 bg-orange-500/10 border border-orange-200 rounded-xl">
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
      <div className="bg-card rounded-xl border border-border">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">{tc('loading')}</div>
        ) : dpias.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">{tc('noData')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className={TABLE_STYLES.table}>
              <thead className={TABLE_STYLES.header}>
                <tr className={TABLE_STYLES.row}>
                  <th className={TABLE_STYLES.headerCell}>Title</th>
                  <th className={TABLE_STYLES.headerCell}>{t('gdpr.processingScope')}</th>
                  <th className={TABLE_STYLES.headerCell}>{t('gdpr.riskLevel')}</th>
                  <th className={TABLE_STYLES.headerCell}>{tc('status')}</th>
                  <th className={TABLE_STYLES.headerCell}>{tc('updatedAt')}</th>
                  <th className={TABLE_STYLES.headerCell}>{tc('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {!dpias?.length && <EmptyState />}
              {dpias?.map((d) => (
                  <tr key={d.id} className={TABLE_STYLES.row}>
                    <td className={TABLE_STYLES.cell}>
                      <div className="font-medium text-foreground">{d.title}</div>
                      {d.description && (
                        <div className="text-xs text-muted-foreground mt-0.5 max-w-[200px] truncate">{d.description}</div>
                      )}
                    </td>
                    <td className={cn(TABLE_STYLES.cell, 'text-muted-foreground max-w-[240px] truncate')}>{d.processing_scope}</td>
                    <td className={TABLE_STYLES.cell}>
                      <RiskBadge level={d.risk_level} />
                    </td>
                    <td className={TABLE_STYLES.cell}>
                      <StatusBadge status={d.status} />
                    </td>
                    <td className={cn(TABLE_STYLES.cell, 'text-muted-foreground')}>
                      {new Date(d.updated_at).toLocaleDateString()}
                    </td>
                    <td className={TABLE_STYLES.cell}>
                      <button
                        onClick={() => { setSelected(d); setShowForm(true) }}
                        className="inline-flex items-center gap-1.5 text-primary hover:text-primary/90 text-sm font-medium"
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
