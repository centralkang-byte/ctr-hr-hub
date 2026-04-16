import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ROLE_GROUPS } from '@/lib/rbac/rbac-spec'
import type { SessionUser } from '@/types'
import { ManagerInsightsHub } from '@/components/manager-hub/ManagerInsightsHub'
import { HomeSkeleton } from '@/components/shared/PageSkeleton'

export default async function ManagerHubPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser

  // Only direct team managers can access (EXECUTIVE excluded — strategic role, not team mgmt)
  if (!ROLE_GROUPS.MANAGER_ONLY.includes(user.role as typeof ROLE_GROUPS.MANAGER_ONLY[number])) {
    redirect('/')
  }

  return (
    <Suspense fallback={<HomeSkeleton />}>
      <ManagerInsightsHub user={user} />
    </Suspense>
  )
}
