import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import AttendanceClient from './AttendanceClient'
import { ChartSkeleton } from '@/components/shared/PageSkeleton'

export default async function AttendancePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }
  const user = session.user as SessionUser

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{'근태/휴가 분석'}</h1>
        <p className="text-sm text-muted-foreground mt-1">{'초과근무, 52h 위반, 근태 패턴을 분석합니다.'}</p>
      </div>
      <Suspense fallback={<ChartSkeleton />}>
        <AttendanceClient user={user} />
      </Suspense>
    </div>
  )
}
