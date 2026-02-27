import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { RecruitmentDashboardClient } from './RecruitmentDashboardClient'

export default async function RecruitmentDashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser
  return <RecruitmentDashboardClient user={user} />
}
