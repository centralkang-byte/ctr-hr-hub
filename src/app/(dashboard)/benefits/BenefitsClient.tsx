'use client'

import { useState } from 'react'
import { Inbox, List, PieChart } from 'lucide-react'
import type { SessionUser } from '@/types'
import { BenefitApprovalTab } from './BenefitApprovalTab'
import { BenefitBudgetTab } from './BenefitBudgetTab'

type Tab = 'pending' | 'all' | 'budget'

export function BenefitsClient({ user }: { user: SessionUser }) {
  const [activeTab, setActiveTab] = useState<Tab>('pending')

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'pending', label: '승인 대기', icon: <Inbox className="w-4 h-4" /> },
    { key: 'all', label: '전체 내역', icon: <List className="w-4 h-4" /> },
    { key: 'budget', label: '예산 관리', icon: <PieChart className="w-4 h-4" /> },
  ]

  return (
    <div className="p-6 space-y-6">
      <div>
        <nav className="text-xs text-[#999] mb-1">인재 관리</nav>
        <h1 className="text-2xl font-bold text-[#1A1A1A]">복리후생 관리</h1>
      </div>

      <div className="flex border-b border-[#E8E8E8]">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-[#00C853] text-[#00C853]'
                : 'border-transparent text-[#666] hover:text-[#333]'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'pending' && <BenefitApprovalTab user={user} view="pending" />}
      {activeTab === 'all' && <BenefitApprovalTab user={user} view="all" />}
      {activeTab === 'budget' && <BenefitBudgetTab user={user} />}
    </div>
  )
}
