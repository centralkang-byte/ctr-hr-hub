'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Crown, BarChart3 } from 'lucide-react'
import PlansTab from '@/components/succession/PlansTab'
import SuccessionDashboard from '@/components/succession/SuccessionDashboard'

export default function SuccessionClient() {
  const [activeTab, setActiveTab] = useState('plans')

  return (
    <div className="p-6 space-y-6">
      {/* ─── 페이지 헤더 ─── */}
      <div className="flex items-center justify-between">
        <div>
          <nav className="text-xs text-slate-400 mb-1">인사관리 / 후계자 관리</nav>
          <h1 className="text-2xl font-bold text-slate-900">후계자 관리</h1>
        </div>
      </div>

      {/* ─── 탭 ─── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="plans">
            <Crown className="mr-1.5 h-4 w-4" />
            핵심직책
          </TabsTrigger>
          <TabsTrigger value="dashboard">
            <BarChart3 className="mr-1.5 h-4 w-4" />
            대시보드
          </TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="mt-0">
          <PlansTab />
        </TabsContent>

        <TabsContent value="dashboard" className="mt-0">
          <SuccessionDashboard />
        </TabsContent>
      </Tabs>
    </div>
  )
}
