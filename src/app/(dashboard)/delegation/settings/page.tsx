import { Suspense } from 'react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import type { SessionUser } from '@/types'
import { DelegationSettingsClient } from './DelegationSettingsClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export default async function DelegationSettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')
  const user = session.user as SessionUser

  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <DelegationSettingsClient user={user} />
    </Suspense>
  )
}
