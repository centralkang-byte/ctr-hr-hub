import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { WorkScheduleSettingsClient } from './WorkScheduleSettingsClient'

export default async function WorkScheduleSettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser
  return <WorkScheduleSettingsClient user={user} />
}
