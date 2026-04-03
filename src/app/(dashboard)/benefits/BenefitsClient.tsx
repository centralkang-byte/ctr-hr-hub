'use client'


import { useTranslations } from 'next-intl'

import { Inbox, List, PieChart } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { SessionUser } from '@/types'
import { BenefitApprovalTab } from './BenefitApprovalTab'
import { BenefitBudgetTab } from './BenefitBudgetTab'

export function BenefitsClient({ user }: { user: SessionUser }) {
  const t = useTranslations('benefits')

  return (
    <div className="p-6 space-y-6">
      <div>
        <nav className="text-xs text-muted-foreground mb-1">{t('breadcrumb')}</nav>
        <h1 className="text-2xl font-bold text-foreground">{t('pageTitle')}</h1>
      </div>

      <Tabs defaultValue="pending">
        <TabsList className="mb-4">
          <TabsTrigger value="pending">
            <Inbox className="mr-1.5 h-4 w-4" />
            {t('pendingApproval')}
          </TabsTrigger>
          <TabsTrigger value="all">
            <List className="mr-1.5 h-4 w-4" />
            {t('allHistory')}
          </TabsTrigger>
          <TabsTrigger value="budget">
            <PieChart className="mr-1.5 h-4 w-4" />
            {t('budgetMgmt')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-0">
          <BenefitApprovalTab user={user} view="pending" />
        </TabsContent>
        <TabsContent value="all" className="mt-0">
          <BenefitApprovalTab user={user} view="all" />
        </TabsContent>
        <TabsContent value="budget" className="mt-0">
          <BenefitBudgetTab user={user} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
