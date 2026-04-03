'use client'


import { useTranslations } from 'next-intl'

import { useState } from 'react'
import { Inbox, List, PieChart } from 'lucide-react'
import type { SessionUser } from '@/types'
import { BenefitApprovalTab } from './BenefitApprovalTab'
import { BenefitBudgetTab } from './BenefitBudgetTab'

type Tab = 'pending' | 'all' | 'budget'

export function BenefitsClient({ user }: { user: SessionUser }) {
  const t = useTranslations('benefits')

  const [activeTab, setActiveTab] = useState<Tab>('pending')

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'pending', label: t('pendingApproval'), icon: <Inbox className="w-4 h-4" /> },
    { key: 'all', label: t('allHistory'), icon: <List className="w-4 h-4" /> },
    { key: 'budget', label: t('budgetMgmt'), icon: <PieChart className="w-4 h-4" /> },
  ]

  return (
    <div className="p-6 space-y-6">
      <div>
        <nav className="text-xs text-muted-foreground mb-1">{t('breadcrumb')}</nav>
        <h1 className="text-2xl font-bold text-foreground">{t('pageTitle')}</h1>
      </div>

      <div className="flex border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
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
