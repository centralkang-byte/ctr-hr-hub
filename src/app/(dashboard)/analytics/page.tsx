import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import ExecutiveSummaryClient from './ExecutiveSummaryClient'
import { AnalyticsSkeleton } from '@/components/shared/PageSkeleton'

export default async function AnalyticsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }
  const user = session.user as SessionUser

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Executive Summary</h1>
        <p className="text-sm text-gray-500 mt-1">{'전사 인사 현황을 한눈에 파악하고 효율적으로 관리합니다.'}</p>
      </div>
      <Suspense fallback={<AnalyticsSkeleton />}>
        <ExecutiveSummaryClient user={user} />
      </Suspense>
    </div>
  )
}
