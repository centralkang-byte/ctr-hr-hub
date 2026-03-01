'use client'

import { useTranslations } from 'next-intl'
import { ShieldAlert } from 'lucide-react'
import PiiAccessDashboard from '@/components/compliance/gdpr/PiiAccessDashboard'
import PiiAccessLogTable from '@/components/compliance/gdpr/PiiAccessLogTable'

export default function PiiAuditClient() {
  const t = useTranslations('compliance')

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
          <ShieldAlert className="w-5 h-5 text-orange-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-6">{t('gdpr.piiAudit')}</h1>
        </div>
      </div>

      {/* Dashboard Stats */}
      <PiiAccessDashboard />

      {/* Log Table */}
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Access Log</h2>
        <PiiAccessLogTable />
      </div>
    </div>
  )
}
