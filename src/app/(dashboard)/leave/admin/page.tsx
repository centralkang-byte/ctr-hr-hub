import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { getTranslations } from 'next-intl/server'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { LeaveAdminClient } from './LeaveAdminClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export async function generateMetadata() {
  const t = await getTranslations('leave')
  return { title: t('admin.title') }
}

export default async function LeaveAdminPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <LeaveAdminClient user={user} />
    </Suspense>
  )
}
