import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PayrollSettingsClient } from './PayrollSettingsClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export const dynamic = 'force-dynamic'

export default async function PayrollSettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <PayrollSettingsClient />
    </Suspense>
  )
}
