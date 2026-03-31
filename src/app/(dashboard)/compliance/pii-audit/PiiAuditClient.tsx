'use client'

import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'
import { toast } from '@/hooks/use-toast'

import { useTranslations } from 'next-intl'
import { ShieldAlert } from 'lucide-react'
import PiiAccessDashboard from '@/components/compliance/gdpr/PiiAccessDashboard'
import PiiAccessLogTable from '@/components/compliance/gdpr/PiiAccessLogTable'
import type { SessionUser } from '@/types'

export default function PiiAuditClient({ user }: { user: SessionUser }) {
  const tCommon = useTranslations('common')

  const t = useTranslations('compliance')

  return (
    <div className="p-4 space-y-4">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-orange-500/15 rounded-xl flex items-center justify-center">
          <ShieldAlert className="w-5 h-5 text-orange-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-6">{t('gdpr.piiAudit')}</h1>
        </div>
      </div>

      {/* Dashboard Stats */}
      <PiiAccessDashboard />

      {/* Log Table */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Access Log</h2>
        <PiiAccessLogTable />
      </div>
    </div>
  )
}
