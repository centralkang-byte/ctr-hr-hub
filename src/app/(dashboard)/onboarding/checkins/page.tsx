// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /onboarding/checkins (Server Page)
// HR 관리자 체크인 대시보드
// ═══════════════════════════════════════════════════════════

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { CheckinsAdminClient } from './CheckinsAdminClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export default async function OnboardingCheckinsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }

  const user = session.user as SessionUser

  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <CheckinsAdminClient user={user} />
    </Suspense>
  )
}
