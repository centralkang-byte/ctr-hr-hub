// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Attendance (Server Page)
// ═══════════════════════════════════════════════════════════

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { getTranslations } from 'next-intl/server'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { AttendanceClient } from './AttendanceClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'
import { prisma } from '@/lib/prisma'
import { resolveEffectiveAttendanceSettings } from '@/lib/attendance/timezone-resolver'
import { formatToTz } from '@/lib/timezone'

export async function generateMetadata() {
  const t = await getTranslations('attendance')
  return { title: t('pageTitle') }
}

export default async function AttendancePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser
  const { timezone } = await resolveEffectiveAttendanceSettings(prisma, user.companyId)
  const [initialYear, initialMonth] = formatToTz(new Date(), timezone, 'yyyy-M')
    .split('-')
    .map(Number)

  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <AttendanceClient
        user={user}
        companyTimezone={timezone}
        initialYear={initialYear}
        initialMonth={initialMonth}
      />
    </Suspense>
  )
}
