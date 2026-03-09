import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { ShiftRosterBoard } from '@/components/attendance/ShiftRosterBoard'

export default async function ShiftRosterPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col p-6">
      <ShiftRosterBoard user={user} />
    </div>
  )
}
