import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { getTranslations } from 'next-intl/server'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import AttendanceClient from './AttendanceClient'
import { ChartSkeleton } from '@/components/shared/PageSkeleton'

export async function generateMetadata() {
  const t = await getTranslations('analytics')
  return { title: t('attendanceAnalysis') }
}

export default async function AttendancePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }
  const user = session.user as SessionUser
  const t = await getTranslations('settings')

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{t('analytics_attendanceHeading')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('analytics_attendanceDescription')}</p>
      </div>
      <Suspense fallback={<ChartSkeleton />}>
        <AttendanceClient user={user} />
      </Suspense>
    </div>
  )
}
