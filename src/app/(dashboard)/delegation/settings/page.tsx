import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import type { SessionUser } from '@/types'
import { DelegationSettingsClient } from './DelegationSettingsClient'

export default async function DelegationSettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')
  const user = session.user as SessionUser

  return <DelegationSettingsClient user={user} />
}
