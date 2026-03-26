import { Suspense } from 'react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import PayrollAnomaliesClient from './PayrollAnomaliesClient'
import type { SessionUser } from '@/types'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export const metadata = { title: '급여 이상 탐지 | CTR HR Hub' }

export default async function PayrollAnomaliesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <PayrollAnomaliesClient user={session.user as SessionUser} />
    </Suspense>
  )
}
