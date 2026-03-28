import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import AttritionRiskClient from './AttritionRiskClient'
import { ChartSkeleton } from '@/components/shared/PageSkeleton'

export default async function AttritionRiskPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }
  const user = session.user as SessionUser

  return (
    <Suspense fallback={<ChartSkeleton />}>
      <AttritionRiskClient user={user} />
    </Suspense>
  )
}
