// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /onboarding/me (Server Page)
// 내 온보딩 셀프 뷰
// ═══════════════════════════════════════════════════════════

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { OnboardingMeClient } from './OnboardingMeClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export default async function OnboardingMePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }

  const user = session.user as SessionUser

  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <OnboardingMeClient user={user} />
    </Suspense>
  )
}
