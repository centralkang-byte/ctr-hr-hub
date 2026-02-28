'use client'

import { Users, TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import { formatCurrency } from '@/lib/compensation'

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
  const cards = [
    {
      label: '대상 인원',
      value: `${headcount}명`,
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: '총 지급액',
      value: formatCurrency(totalGross),
      icon: TrendingUp,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: '총 공제액',
      value: formatCurrency(totalDeductions),
      icon: TrendingDown,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: '총 실지급액',
      value: formatCurrency(totalNet),
      icon: Wallet,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-white rounded-xl border border-slate-200 shadow-sm p-5"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className={`p-1.5 rounded-lg ${card.bg}`}>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
            <p className="text-xs text-slate-500">{card.label}</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">{card.value}</p>
        </div>
      ))}
    </div>
  )
}
