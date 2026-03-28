import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'
import { DashboardClient } from './DashboardClient'
import { HomeSkeleton } from '@/components/shared/PageSkeleton'

export const metadata = { title: 'Executive Dashboard | CTR HR Hub' }

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const user = session.user as SessionUser
  const allowedRoles = [ROLE.HR_ADMIN, ROLE.SUPER_ADMIN, ROLE.EXECUTIVE]
  if (!allowedRoles.includes(user.role as never)) redirect('/')

  return (
    <Suspense fallback={<HomeSkeleton />}>
      <DashboardClient user={user} />
    </Suspense>
  )
}
