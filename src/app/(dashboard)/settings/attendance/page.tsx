import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { getTranslations } from 'next-intl/server'
import { authOptions } from '@/lib/auth'
import { AttendanceSettingsV2Client } from './AttendanceSettingsV2Client'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  const t = await getTranslations('settings')
  return { title: t('attendanceSettings') }
}

export default async function AttendanceSettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <AttendanceSettingsV2Client />
    </Suspense>
  )
}
