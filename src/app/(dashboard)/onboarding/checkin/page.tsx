// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /onboarding/checkin (Server Page)
// 신입사원 주간 체크인 제출 페이지
// ═══════════════════════════════════════════════════════════

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { CheckinFormClient } from './CheckinFormClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export default async function OnboardingCheckinPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }

  const user = session.user as SessionUser

  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <CheckinFormClient user={user} />
    </Suspense>
  )
}
