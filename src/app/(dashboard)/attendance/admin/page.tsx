import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { getTranslations } from 'next-intl/server'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { AttendanceAdminClient } from './AttendanceAdminClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export async function generateMetadata() {
  const t = await getTranslations('attendance')
  return { title: t('adminAttendance') }
}

export default async function AttendanceAdminPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <AttendanceAdminClient user={user} />
    </Suspense>
  )
}
