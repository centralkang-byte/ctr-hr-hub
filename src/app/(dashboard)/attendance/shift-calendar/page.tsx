import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { ShiftCalendarClient } from './ShiftCalendarClient'

export default async function ShiftCalendarPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser
  return <ShiftCalendarClient user={user} />
}
