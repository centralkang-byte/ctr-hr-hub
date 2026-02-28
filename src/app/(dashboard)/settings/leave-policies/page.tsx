import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { LeavePolicySettingsClient } from './LeavePolicySettingsClient'

export default async function LeavePolicySettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser
  return <LeavePolicySettingsClient user={user} />
}
