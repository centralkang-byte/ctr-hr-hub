'use client'

import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

import { useTranslations } from 'next-intl'
import { ShieldAlert } from 'lucide-react'
import PiiAccessDashboard from '@/components/compliance/gdpr/PiiAccessDashboard'
import PiiAccessLogTable from '@/components/compliance/gdpr/PiiAccessLogTable'

export default function PiiAuditClient() {
  const tCommon = useTranslations('common')

  const t = useTranslations('compliance')

  return (
    <div className="p-4 space-y-4">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#FFEDD5] rounded-xl flex items-center justify-center">
          <ShieldAlert className="w-5 h-5 text-[#EA580C]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A] mb-6">{t('gdpr.piiAudit')}</h1>
        </div>
      </div>

      {/* Dashboard Stats */}
      <PiiAccessDashboard />

      {/* Log Table */}
      <div>
        <h2 className="text-lg font-semibold text-[#1A1A1A] mb-4">Access Log</h2>
        <PiiAccessLogTable />
      </div>
    </div>
  )
}
