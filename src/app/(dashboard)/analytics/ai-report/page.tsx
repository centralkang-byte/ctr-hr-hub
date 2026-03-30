import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import AiReportClient from './AiReportClient'
import { ChartSkeleton } from '@/components/shared/PageSkeleton'

export default async function AiReportPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }
  const user = session.user as SessionUser

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{'AI 월간 리포트'}</h1>
        <p className="text-sm text-muted-foreground mt-1">{'AI가 분석한 인사 현황 보고서를 확인합니다.'}</p>
      </div>
      <Suspense fallback={<ChartSkeleton />}>
        <AiReportClient user={user} />
      </Suspense>
    </div>
  )
}
