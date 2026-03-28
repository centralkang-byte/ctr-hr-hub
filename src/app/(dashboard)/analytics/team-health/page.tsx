import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import TeamHealthClient from './TeamHealthClient'
import { ChartSkeleton } from '@/components/shared/PageSkeleton'

export default async function TeamHealthPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }
  const user = session.user as SessionUser

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{'팀 건강 대시보드'}</h1>
        <p className="text-sm text-gray-500 mt-1">{'직속 팀원의 초과근무, 연차, 성과, 이직 위험을 종합 분석합니다.'}</p>
      </div>
      <Suspense fallback={<ChartSkeleton />}>
        <TeamHealthClient user={user} />
      </Suspense>
    </div>
  )
}
