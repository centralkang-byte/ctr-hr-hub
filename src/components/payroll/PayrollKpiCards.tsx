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
      color: 'text-[#00C853]',
      bg: 'bg-[#E8F5E9]',
    },
    {
      label: '총 지급액',
      value: formatCurrency(totalGross),
      icon: TrendingUp,
      color: 'text-[#059669]',
      bg: 'bg-[#D1FAE5]',
    },
    {
      label: '총 공제액',
      value: formatCurrency(totalDeductions),
      icon: TrendingDown,
      color: 'text-[#D97706]',
      bg: 'bg-[#FEF3C7]',
    },
    {
      label: '총 실지급액',
      value: formatCurrency(totalNet),
      icon: Wallet,
      color: 'text-[#4F46E5]',
      bg: 'bg-[#E0E7FF]',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className={}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className={`p-1.5 rounded-lg ${card.bg}`}>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
            <p className="text-xs text-[#666]">{card.label}</p>
          </div>
          <p className="text-2xl font-bold text-[#1A1A1A]">{card.value}</p>
        </div>
      ))}
    </div>
  )
}
