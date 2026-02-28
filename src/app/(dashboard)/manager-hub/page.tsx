import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ROLE } from '@/lib/constants'
import type { SessionUser } from '@/types'
import { ManagerInsightsHub } from '@/components/manager-hub/ManagerInsightsHub'

export default async function ManagerHubPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser

  // Only managers and above can access
  if (
    user.role !== ROLE.MANAGER &&
    user.role !== ROLE.HR_ADMIN &&
    user.role !== ROLE.SUPER_ADMIN
  ) {
    redirect('/')
  }

  return <ManagerInsightsHub user={user} />
}
