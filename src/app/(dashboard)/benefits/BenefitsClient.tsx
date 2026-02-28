'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Gift, ListChecks } from 'lucide-react'
import BenefitPoliciesTab from '@/components/benefits/BenefitPoliciesTab'
import BenefitEnrollmentsTab from '@/components/benefits/BenefitEnrollmentsTab'

export default function BenefitsClient() {
  const [activeTab, setActiveTab] = useState('policies')

  return (
    <div className="p-6 space-y-6">
      {/* ─── 페이지 헤더 ─── */}
      <div className="flex items-center justify-between">
        <div>
          <nav className="text-xs text-slate-400 mb-1">인사관리 / 복리후생</nav>
          <h1 className="text-2xl font-bold text-slate-900">복리후생 관리</h1>
        </div>
      </div>

      {/* ─── 탭 ─── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="policies">
            <Gift className="mr-1.5 h-4 w-4" />
            정책관리
          </TabsTrigger>
          <TabsTrigger value="enrollments">
            <ListChecks className="mr-1.5 h-4 w-4" />
            신청현황
          </TabsTrigger>
        </TabsList>

        <TabsContent value="policies" className="mt-0">
          <BenefitPoliciesTab />
        </TabsContent>

        <TabsContent value="enrollments" className="mt-0">
          <BenefitEnrollmentsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
