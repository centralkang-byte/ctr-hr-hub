import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import TurnoverClient from './TurnoverClient'
import { ChartSkeleton } from '@/components/shared/PageSkeleton'

export default async function TurnoverPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }
  const user = session.user as SessionUser

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{'이직 분석'}</h1>
        <p className="text-sm text-muted-foreground mt-1">{'이직률 추이, 사유 분석, 핵심 인재 이탈 현황을 파악합니다.'}</p>
      </div>
      <Suspense fallback={<ChartSkeleton />}>
        <TurnoverClient user={user} />
      </Suspense>
    </div>
  )
}
