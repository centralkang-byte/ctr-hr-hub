import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { AttendanceTeamClient } from './AttendanceTeamClient'

export default async function AttendanceTeamPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser
  return <AttendanceTeamClient user={user} />
}
