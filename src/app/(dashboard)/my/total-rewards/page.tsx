// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /my/total-rewards (Server Page)
// 직원 본인 총 보상 명세
// ═══════════════════════════════════════════════════════════

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import TotalRewardsClient from './TotalRewardsClient'
import { HomeSkeleton } from '@/components/shared/PageSkeleton'

export const metadata = { title: '총 보상 명세 | CTR HR Hub' }

export default async function TotalRewardsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const user = session.user as SessionUser

  return (
    <Suspense fallback={<HomeSkeleton />}>
      <TotalRewardsClient user={user} />
    </Suspense>
  )
}
