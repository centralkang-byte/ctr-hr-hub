// ═══════════════════════════════════════════════════════════
// CTR HR Hub — /performance/admin (Server Page)
// ═══════════════════════════════════════════════════════════

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { PerformanceAdminHubClient } from './PerformanceAdminHubClient'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'

export default async function PerformanceAdminPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }
  const user = session.user as SessionUser

  // Suspense 필요: PerformanceAdminHubClient 내부에서 useSearchParams() 사용
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <PerformanceAdminHubClient user={user} />
    </Suspense>
  )
}
