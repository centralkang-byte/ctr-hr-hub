import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { AttendanceAdminClient } from './AttendanceAdminClient'

export default async function AttendanceAdminPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser
  return <AttendanceAdminClient user={user} />
}
