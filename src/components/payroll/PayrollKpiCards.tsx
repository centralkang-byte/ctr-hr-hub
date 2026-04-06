'use client'

import { useTranslations } from 'next-intl'
import { Users, TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import { formatCurrency } from '@/lib/compensation'

const CARD_CONFIGS = [
  {
    labelKey: 'kpi.targetEmployees',
    icon: Users,
    color: 'text-primary',
    bg: 'bg-primary/10',
  },
  {
    labelKey: 'kpi.totalGrossPay',
    icon: TrendingUp,
    color: 'text-emerald-600',
    bg: 'bg-emerald-500/15',
  },
  {
    labelKey: 'kpi.totalDeductions',
    icon: TrendingDown,
    color: 'text-amber-600',
    bg: 'bg-amber-500/15',
  },
  {
    labelKey: 'kpi.totalNetPay',
    icon: Wallet,
    color: 'text-primary',
    bg: 'bg-indigo-500/15',
  },
]

interface PayrollKpiCardsProps {
  headcount: number
  totalGross: number
  totalDeductions: number
  totalNet: number
}

export default function PayrollKpiCards({
  headcount,
  totalGross,
  totalDeductions,
  totalNet,
}: PayrollKpiCardsProps) {
  const t = useTranslations('payroll')

  const values = [
    t('kpi.headcountValue', { count: headcount }),
    formatCurrency(totalGross),
    formatCurrency(totalDeductions),
    formatCurrency(totalNet),
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {CARD_CONFIGS.map((card, idx) => (
        <div
          key={card.labelKey}
          className="bg-card rounded-xl shadow-sm border border-border p-6"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className={`p-1.5 rounded-lg ${card.bg}`}>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
            <p className="text-xs text-muted-foreground">{t(card.labelKey)}</p>
          </div>
          <p className="text-2xl font-bold text-foreground">{values[idx]}</p>
        </div>
      ))}
    </div>
  )
}
