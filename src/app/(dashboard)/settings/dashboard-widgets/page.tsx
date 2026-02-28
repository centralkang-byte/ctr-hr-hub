import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { DashboardWidgetsClient } from './DashboardWidgetsClient'

export default async function DashboardWidgetsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser
  return <DashboardWidgetsClient user={user} />
}
