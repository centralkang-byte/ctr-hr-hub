import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { OrgStudioClient } from './OrgStudioClient'
import { ChartSkeleton } from '@/components/shared/PageSkeleton'

export default async function OrgStudioPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser

  return (
    <Suspense fallback={<ChartSkeleton />}>
      <OrgStudioClient user={user} />
    </Suspense>
  )
}
