import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { LeaveSettingsClient } from './LeaveSettingsClient'

export const metadata = { title: '휴가 설정 | CTR HR Hub' }

export default async function LeaveSettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser
  return <LeaveSettingsClient user={user} />
}
