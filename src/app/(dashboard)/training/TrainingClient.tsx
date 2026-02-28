'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GraduationCap, ListChecks } from 'lucide-react'
import CoursesTab from '@/components/training/CoursesTab'
import EnrollmentsTab from '@/components/training/EnrollmentsTab'

export default function TrainingClient() {
  const [activeTab, setActiveTab] = useState('courses')

  return (
    <div className="p-6 space-y-6">
      {/* ─── 페이지 헤더 ─── */}
      <div className="flex items-center justify-between">
        <div>
          <nav className="text-xs text-slate-400 mb-1">인사관리 / 교육</nav>
          <h1 className="text-2xl font-bold text-slate-900">교육관리</h1>
        </div>
      </div>

      {/* ─── 탭 ─── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="courses">
            <GraduationCap className="mr-1.5 h-4 w-4" />
            교육과정
          </TabsTrigger>
          <TabsTrigger value="enrollments">
            <ListChecks className="mr-1.5 h-4 w-4" />
            수강현황
          </TabsTrigger>
        </TabsList>

        <TabsContent value="courses" className="mt-0">
          <CoursesTab />
        </TabsContent>

        <TabsContent value="enrollments" className="mt-0">
          <EnrollmentsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
