import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { getTranslations } from 'next-intl/server'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { ShiftCalendarClient } from './ShiftCalendarClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export async function generateMetadata() {
  const t = await getTranslations('shift')
  return { title: t('calendarTitle') }
}

export default async function ShiftCalendarPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <ShiftCalendarClient user={user} />
    </Suspense>
  )
}
