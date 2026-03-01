import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { ROLE } from '@/lib/constants'
import { TeamsSettingsPage } from '@/components/teams/TeamsSettingsPage'

export default async function TeamsSettingsPageWrapper() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const user = session.user as SessionUser
  if (user.role !== ROLE.HR_ADMIN && user.role !== ROLE.SUPER_ADMIN) {
    redirect('/settings')
  }

  return <TeamsSettingsPage user={user} />
}
