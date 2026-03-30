import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import PayrollClient from './PayrollClient'
import { ChartSkeleton } from '@/components/shared/PageSkeleton'

export default async function PayrollPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }
  const user = session.user as SessionUser

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{'급여 분석'}</h1>
        <p className="text-sm text-muted-foreground mt-1">{'인건비 추이와 법인별 비교를 분석합니다.'}</p>
      </div>
      <Suspense fallback={<ChartSkeleton />}>
        <PayrollClient user={user} />
      </Suspense>
    </div>
  )
}
