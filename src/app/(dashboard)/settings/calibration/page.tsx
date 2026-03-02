import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import CalibrationSettingsClient from './CalibrationSettingsClient'

export default async function CalibrationSettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser
  return <CalibrationSettingsClient user={user} />
}
