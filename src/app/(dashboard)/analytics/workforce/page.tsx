import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import WorkforceClient from './WorkforceClient'
import { ChartSkeleton } from '@/components/shared/PageSkeleton'

export default async function WorkforcePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }
  const user = session.user as SessionUser

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{'인력 분석'}</h1>
        <p className="text-sm text-gray-500 mt-1">{'직급, 부서, 근속 구성을 분석합니다.'}</p>
      </div>
      <Suspense fallback={<ChartSkeleton />}>
        <WorkforceClient user={user} />
      </Suspense>
    </div>
  )
}
