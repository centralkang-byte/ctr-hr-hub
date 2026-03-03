import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NotificationPreferenceClient } from './NotificationPreferenceClient'

export default async function NotificationSettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  return <NotificationPreferenceClient />
}
