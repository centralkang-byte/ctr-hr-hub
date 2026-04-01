'use client'

import { useTranslations } from 'next-intl'
import { Card } from '@/components/ui/card'
import { ClipboardCheck, CheckCircle2, Send, AlertTriangle } from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────

interface DashboardData {
  totalReviews: number
  completionRate: number
  statusDistribution: Record<string, number>
}

interface Props {
  data: DashboardData | null
}

// ─── Component ──────────────────────────────────────────────

export default function DashboardStatsBar({ data }: Props) {
  const t = useTranslations('performance.quarterlyReview.dashboard')

  if (!data) return null

  const employeeSubmitted =
    (data.statusDistribution?.EMPLOYEE_DONE ?? 0) +
    (data.statusDistribution?.MANAGER_DONE ?? 0) +
    (data.statusDistribution?.COMPLETED ?? 0)

  const overdue =
    (data.statusDistribution?.DRAFT ?? 0) +
    (data.statusDistribution?.IN_PROGRESS ?? 0)

  const kpis = [
    { label: t('totalReviews'), value: data.totalReviews, icon: ClipboardCheck },
    { label: t('completionRate'), value: `${Math.round(data.completionRate)}%`, icon: CheckCircle2 },
    { label: t('employeeSubmitted'), value: employeeSubmitted, icon: Send },
    { label: t('overdue'), value: overdue, icon: AlertTriangle },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {kpis.map((kpi) => {
        const Icon = kpi.icon
        return (
          <Card key={kpi.label} className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums font-mono">{kpi.value}</p>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
