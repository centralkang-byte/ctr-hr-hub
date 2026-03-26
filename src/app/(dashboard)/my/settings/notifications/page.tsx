import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NotificationPreferenceClient } from './NotificationPreferenceClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export default async function NotificationSettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <NotificationPreferenceClient />
    </Suspense>
  )
}
